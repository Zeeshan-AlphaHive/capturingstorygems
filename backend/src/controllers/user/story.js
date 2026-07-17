const cron = require("node-cron");
const User = require("../../models/user.js");
const Story = require("../../models/story.js");
const Prompt = require("../../models/prompt.js");
const Subscription = require("../../models/subscription.js");
const { getOpenAI } = require("../../configs/openai.js");
const { generateStoryEmail } = require("../../data/emails.js");
const { sendMail } = require("../../utils/send-mail.js");
const cloudinary = require("../../configs/cloudinary.util.js");
const {
  assertCanUseStoriesOrRespond,
  evaluateStoryAccess,
} = require("../../utils/storyAccess.js");

// ── Guided Memory Experience (conversation mode) ──────────────────
// Default operational prompt used when no "memory-conversation-prompt" exists in the DB.
// Admins can override this by creating/editing a Prompt named "memory-conversation-prompt".
const DEFAULT_MEMORY_CONVERSATION_PROMPT = `
You are the gentle memory guide for Capturing Story Gems (CSG). You help a storyteller
rediscover a meaningful memory through a warm, unhurried conversation.

The Central Operating Question
Before every response silently ask:
"What experience will best serve this storyteller right now?"
Never ask: What question comes next? What information is missing? How do I keep the conversation going?
Instead ask: What would help them reconnect? What would help this memory become clearer?
What would help them notice something meaningful? What would build confidence?
What would help them preserve authenticity?
Every response should improve the storyteller's experience.

Guided Memory Experience — every meaningful memory naturally moves through five gentle stages:
Notice → Reconnect → Explore → Recognize → Preserve.
Do not force movement. Follow the storyteller's pace.

Conversation Style — every conversation should feel like walking beside someone, not interviewing them:
- Observe before questioning.
- Reflect before exploring.
- Invite before directing.
- Recognize before summarizing.
- Offer choices frequently.
- Allow pauses, unfinished thoughts, and silence.
- Thoughtful observations are often more valuable than additional questions.
- Keep replies short, warm, and human (usually 2–5 sentences). Ask at most one gentle question at a time.

Throughout the experience, quietly notice whether Story Gems are beginning to emerge.
Allow the storyteller to discover them first. If appropriate, gently reflect what seems to be emerging.
When the memory feels rich and complete, gently let them know it seems ready, and remind them
they can select "Create My Story" whenever they feel ready — never pressure them.
`.trim();

const MEMORY_STATUS_INSTRUCTION = `
After your conversational reply, append a private machine-readable status block in EXACTLY this format:
<STORY_STATUS>{"progress":35,"covered":["setting"],"remaining":["emotions","meaning"],"ready":false,"summary":"The setting is clear; the emotional meaning still needs exploration."}</STORY_STATUS>

Status rules:
- progress must be an integer from 0 to 100 representing how ready the memory is to become a complete story.
- Assess people, setting, sequence of events, sensory details, emotions, meaning/reflection, and a satisfying ending.
- Create covered and remaining dynamically from the actual memory topic and details shared.
- Every tag must be story-specific, such as "Grandmother's kitchen setting", "the train station farewell", or "why the blue bicycle mattered".
- Never return generic category tags such as "people and setting", "events", "emotions", "meaning", or "ending".
- Use an empty covered array if the storyteller has not provided enough information yet.
- ready should be true only when the conversation contains enough authentic detail for a complete story.
- summary must be one short, encouraging sentence explaining the current state.
- Do not mention this status block in the conversational reply.
`.trim();

function parseMemoryReply(rawReply, userMessageCount) {
  const statusMatch = rawReply.match(
    /<STORY_STATUS>([\s\S]*?)<\/STORY_STATUS>/i
  );
  const reply = rawReply
    .replace(/<STORY_STATUS>[\s\S]*?<\/STORY_STATUS>/gi, "")
    .trim();

  const fallbackProgress = Math.min(85, Math.max(10, userMessageCount * 12));
  const fallbackStatus = {
    progress: fallbackProgress,
    covered: [],
    remaining: [],
    ready: false,
    summary: "Your memory is taking shape as we continue exploring it together.",
  };

  if (!statusMatch) return { reply: reply || rawReply.trim(), status: fallbackStatus };

  try {
    const parsed = JSON.parse(statusMatch[1]);
    return {
      reply: reply || rawReply.trim(),
      status: {
        progress: Math.min(100, Math.max(0, Math.round(Number(parsed.progress) || 0))),
        covered: Array.isArray(parsed.covered)
          ? parsed.covered.map(String).slice(0, 8)
          : [],
        remaining: Array.isArray(parsed.remaining)
          ? parsed.remaining.map(String).slice(0, 8)
          : [],
        ready: parsed.ready === true,
        summary:
          typeof parsed.summary === "string" && parsed.summary.trim()
            ? parsed.summary.trim()
            : fallbackStatus.summary,
      },
    };
  } catch {
    return { reply: reply || rawReply.trim(), status: fallbackStatus };
  }
}

const createStory = async (req, res) => {
  const userId = req.decoded?.id;
  const { story } = req.body;

  try {
    const user = await User.findById(userId).select(
      "isPublic trialUsed trialStartDate trialEndDate createdAt"
    );
    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
        response: null,
        error: "User not found",
      });
    }

    const access = await assertCanUseStoriesOrRespond(res, user);
    if (!access.ok) return;

    const newStory = await Story.create({
      userId,
      user_story: story,
    });

    const promptDoc = await Prompt.findOne({ name: "question-prompt" });
    if (!promptDoc) {
      return res.status(404).json({
        message: "Prompt not found",
        response: null,
        error: "Prompt not found",
      });
    }
    const prompt = `${promptDoc.prompt}\n"${story}"`;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const gptResponse = completion.choices[0]?.message?.content;
    if (!gptResponse) {
      return res.status(500).json({
        message: "Failed to generate questions from AI",
        response: null,
        error: "Failed to generate questions from AI",
      });
    }
    const questionLines = gptResponse
      .split("\n")
      .filter((line) => line.trim().match(/^\d+\.\s+/))
      .map((line) => line.replace(/^\d+\.\s*/, "").trim());

    return res.status(201).json({
      message: "Story and questions created successfully",
      response: {
        storyId: newStory._id,
        questions: questionLines,
      },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: error.message,
    });
  }
};

const generateStory = async (req, res) => {
  const { id, email } = req.decoded;
  const { story_id } = req.query;
  const { qa } = req.body;

  try {
    const user = await User.findById(id).select(
      "isPublic trialUsed trialStartDate trialEndDate createdAt"
    );
    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
        response: null,
        error: "User not found",
      });
    }

    const access = await assertCanUseStoriesOrRespond(res, user);
    if (!access.ok) return;

    const storyDoc = await Story.findById(story_id);
    if (!storyDoc) {
      return res.status(404).json({
        message: "Story not found",
        response: null,
        error: "Story not found",
      });
    }
    if (storyDoc.userId.toString() !== id) {
      return res.status(404).json({
        message: "Story not found",
        response: null,
        error: "Story not found",
      });
    }

    if (Array.isArray(qa)) {
      storyDoc.qa = qa.map((item) => ({
        question: item.question,
        answer: item.answer || "",
      }));
    }
    await storyDoc.save();

    const answeredQAs = storyDoc.qa
      .filter((item) => item.answer && item.answer.trim().length > 0)
      .map(
        (item, index) =>
          `${index + 1}. Q: ${item.question}\n   A: ${item.answer}`
      )
      .join("\n");

    const promptDoc = await Prompt.findOne({ name: "story-prompt" });
    if (!promptDoc) {
      return res.status(404).json({
        message: "Prompt not found",
        response: null,
        error: "Prompt not found",
      });
    }

    const basePrompt = promptDoc.prompt;
    const storyPart = `User’s Story:\n${storyDoc.user_story}`;
    const qaPart = `User’s Reflections:\n${answeredQAs}`;
    const frameworkPrompt = `
      Return the output in EXACTLY this format (single line, comma separated):
      <Title>, <Genre>, <Time to read>, <Full Story Body>

      Rules:
      - Do not include labels like "Title:" or "Genre:" or "Time to read:".
      - Title should be catchy but relevant.
      - Title must NOT be wrapped in quotation marks or quotes.
      - Genre should be ONE word only (e.g., Fantasy, Romance, Drama).
      - Time to read should be like the time you think would be enough for a reader to read your story for example "2 min read" for a story you think 2 minutes will be enough to read.
      - After the third comma, give the full story narrative.
      - Do not add extra line breaks or commentary before or after.
      - DO not include potential story tiitles.
    `.trim();

    const enhancementPrompt =
      `${storyPart}\n\n${qaPart}\n\nNarrative Instructions:${basePrompt}\n\nLayout & Framework Instructions:${frameworkPrompt}`.trim();

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: enhancementPrompt }],
      temperature: 0.8,
    });

    let enhancedStory = completion.choices?.[0]?.message?.content;
    if (!enhancedStory) {
      return res.status(500).json({
        message: "AI failed to return enhanced story",
        response: null,
        error: "AI returned no content",
      });
    }

    if (enhancedStory.startsWith(`"`)) enhancedStory = enhancedStory.slice(1);
    if (enhancedStory.endsWith(`"`)) enhancedStory = enhancedStory.slice(0, -1);

    const parts = enhancedStory.split(",");
    const title = (parts[0]?.trim() || "")?.replace(/^["']|["']$/g, "");
    const genre = (parts[1]?.trim() || "")?.replace(/^["']|["']$/g, "");
    const timeRead = (parts[2]?.trim() || "")?.replace(/^["']|["']$/g, "");
    const storyBody = parts.slice(3).join(",").trim();

    storyDoc.story_title = title;
  
    storyDoc.read_time = timeRead;
    storyDoc.genre = genre;
    storyDoc.enhanced_story = storyBody;
    if (!storyDoc.book_version_title) {
      storyDoc.book_version_title = title;
    }
    await storyDoc.save();

    if (!user.isPublic) {
      // Only increment usage when a paid subscription is active.
      if (access.subscription) {
        await Subscription.findOneAndUpdate(
          { userId: user._id },
          { $inc: { storiesCreated: 1 } }
        );
      }

      const generatedStory = storyBody
        .replace(/\n\n/g, "<br /><br />")
        .replace(/\n/g, "<br />");
      const dynamicData = {
        subject: "Story generated successfully",
        to_email: email,
      };
      const emailTemplate = await generateStoryEmail(generatedStory);
      await sendMail(emailTemplate, dynamicData);
    }

    return res.status(200).json({
      message: "Story generated successfully",
      response: null,
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: error.message,
    });
  }
};
const resendStory = async (req, res) => {
  const { id, email } = req.decoded;
  const { story_id } = req.query;

  try {
    const storyDoc = await Story.findById(story_id);
    if (!storyDoc) {
      return res.status(404).json({
        message: "Story not found",
        response: null,
        error: "Story not found",
      });
    }
    if (storyDoc.userId.toString() !== id) {
      return res.status(404).json({
        message: "Story not found",
        response: null,
        error: "Story not found",
      });
    }





    const generatedStory = storyDoc.enhanced_story
      .replace(/\n\n/g, "<br /><br />")
      .replace(/\n/g, "<br />");

    const dynamicData = {
      subject: "Your Story Has Been Sent",
      to_email: email,
    };
    const emailTemplate = await generateStoryEmail(generatedStory);
    await sendMail(emailTemplate, dynamicData);

    return res.status(200).json({
      message: "Story resent successfully",
      response: null,
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: error.message,
    });
  }
};

const getUserStories = async (req, res) => {
  try {
    const { id: userId } = req.decoded;

    const stories = await Story.find({ userId, enhanced_story: { $ne: null } })
      .select("story_title book_version_title read_time genre enhanced_story user_story heroImageUrl heroImageAlignment")
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      message: "Stories fetched successfully",
      response: {
        data: stories,
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: err.message,
    });
  }
};

const reviseStory = async (req, res) => {
  const { id } = req.decoded;
  console.log("Req body in reviseStory:", req.body);
  const { storyId } = req.params;
  const { story, story_title, book_version_title, heroImageUrl, heroImageAlignment } = req.body;

  try {
    const storyDoc = await Story.findById(storyId);
    if (!storyDoc) {
      return res.status(404).json({
        message: "Story not found",
        response: null,
        error: "Story not found",
      });
    }
    if (storyDoc.userId.toString() !== id) {
      return res.status(403).json({
        message: "You are not authorized to update this story",
        response: null,
        error: "You are not authorized to update this story",
      });
    }
     
   
    // storyDoc.enhanced_story = story;
    if (typeof story === "string") storyDoc.enhanced_story = story;
    if (typeof story_title === "string") storyDoc.story_title = story_title;
    if (typeof book_version_title === "string")
      storyDoc.book_version_title = book_version_title;
    // allow clearing hero image when null is sent
    if (heroImageUrl === null) {
      storyDoc.heroImageUrl = null;
    } else if (typeof heroImageUrl === "string") {
      storyDoc.heroImageUrl = heroImageUrl;
    }
    if (typeof heroImageAlignment === "string" && ["left","center","right"].includes(heroImageAlignment)) {
      storyDoc.heroImageAlignment = heroImageAlignment;
    }

    await storyDoc.save();

    return res.status(200).json({
      message: "Story revised successfully",
      response: null,
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: error.message,
    });
  }
};

const deleteStory = async (req, res) => {
  const { id } = req.decoded;
  const { storyId } = req.params;

  try {
    const storyDoc = await Story.findById(storyId);
    if (!storyDoc) {
      return res.status(404).json({
        message: "Story not found",
        response: null,
        error: "Story not found",
      });
    }

    if (storyDoc.userId.toString() !== id) {
      return res.status(403).json({
        message: "You are not authorized to delete this story",
        response: null,
        error: "You are not authorized to delete this story",
      });
    }
    await Story.findByIdAndDelete(storyId);

    const user = await User.findById(id).select("isPublic");
    if (!user?.isPublic) {
      const subscription = await Subscription.findOne({ userId: id }).select(
        "storiesCreated"
      );
      if (subscription && subscription.storiesCreated > 0) {
        await Subscription.findByIdAndUpdate(
          subscription._id,
          { $inc: { storiesCreated: -1 } }
        );
      }
    }

    return res.status(200).json({
      message: "Story deleted successfully",
      response: null,
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: error.message,
    });
  }
};

const uploadHeroImage = async (req, res) => {
  const { id } = req.decoded;
  const { storyId } = req.params;
  const { image, url, alignment } = req.body;

  try {
    const storyDoc = await Story.findById(storyId);
    if (!storyDoc) {
      return res.status(404).json({ message: "Story not found", response: null, error: "Story not found" });
    }
    if (storyDoc.userId.toString() !== id) {
      return res.status(403).json({ message: "You are not authorized to update this story", response: null, error: "You are not authorized to update this story" });
    }

    let finalUrl = null;
    if (typeof image === "string" && image.trim().length > 0) {
      // image should be a data URI (base64) or a normal URL
      try {
        const uploadRes = await cloudinary.uploader.upload(image, { folder: "hero_images" });
        finalUrl = uploadRes.secure_url;
      } catch (err) {
        return res.status(500).json({ message: "Failed to upload image", response: null, error: err.message });
      }
    } else if (typeof url === "string" && url.trim().length > 0) {
      finalUrl = url;
    }

    if (finalUrl) storyDoc.heroImageUrl = finalUrl;
    if (typeof alignment === "string" && ["left", "center", "right"].includes(alignment)) {
      storyDoc.heroImageAlignment = alignment;
    }

    await storyDoc.save();

    return res.status(200).json({ message: "Hero image saved", response: { heroImageUrl: storyDoc.heroImageUrl, heroImageAlignment: storyDoc.heroImageAlignment }, error: null });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error", response: null, error: err.message });
  }
};

const deleteExpiredPublicStories = async () => {
  try {
    const now = new Date();
    const publicUsers = await User.find({
      isPublic: true,
      storyExpiryDate: { $ne: null },
    }).select("_id storyExpiryDate");

    if (!publicUsers.length) {
      console.log("No public users with storyExpiryDate found");
      return;
    }

    for (const user of publicUsers) {
      if (user.storyExpiryDate < now) {
        const result = await Story.deleteMany({ userId: user._id });
        console.log(
          `Deleted ${result.deletedCount} stories for user ${user._id}`
        );
      }
    }
  } catch (err) {
    console.error("Error deleting old public stories:", err.message);
  }
};

const clearExpiredPublicUserPasswords = async () => {
  try {
    const now = new Date();

    const result = await User.updateMany(
      {
        isPublic: true,
        passwordExpiry: { $ne: null, $lt: now },
      },
      { $set: { password: null } }
    );

    console.log(
      `Cleared passwords for ${result.modifiedCount} expired public users`
    );
  } catch (err) {
    console.error(
      "Error clearing passwords for expired public users:",
      err.message
    );
  }
};

if (!process.env.VERCEL) {
  cron.schedule("0 */6 * * *", async () => {
    console.log(
      "Running scheduled job to clear old public user passwords & delete old stories..."
    );
    await deleteExpiredPublicStories();
    await clearExpiredPublicUserPasswords();
  });
}


const seedMockStoriesForMe = async (req, res) => {
  try {
    const { id: userId } = req.decoded;

    const user = await User.findById(userId).select(
      "isPublic trialUsed trialStartDate trialEndDate createdAt"
    );
    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
        response: null,
        error: "User not found",
      });
    }

    const access = await assertCanUseStoriesOrRespond(res, user);
    if (!access.ok) return;

    // Optional: agar pehle se stories hain to avoid duplicates
    const existing = await Story.countDocuments({ userId, enhanced_story: { $ne: null } });
    if (existing >= 2) {
      return res.status(200).json({
        message: "Already have stories. Seed skipped.",
        response: null,
        error: null,
      });
    }

    const storiesToCreate = [
      {
        userId,
        user_story: "I remember learning to ride my first bicycle in the summer lane near my home.",
        story_title: "The Blue Bicycle Summer",
        genre: "Memoir",
        read_time: "4 min read",
        enhanced_story:
          `It was the kind of summer that smelled like sun-warmed dust and mangoes.\n\n` +
          `I learned to ride on a blue bicycle that was too big for me. The seat pin never held, so it would slowly sink while I pedaled, like the bike was laughing at my confidence.\n\n` +
          `My father ran behind me at first—his hand steady on the back of the seat—until one moment he didn’t. I kept moving anyway, wobbling through the lane, my heart louder than the chain.\n\n` +
          `That day I discovered something: freedom isn’t a place you reach. It’s a moment you realize you’re already in motion.`,
        qa: [],
      },
      {
        userId,
        user_story: "I used to write letters to someone but never sent them.",
        story_title: "Letters I Never Sent",
        genre: "Drama",
        read_time: "6 min read",
        enhanced_story:
          `I wrote you a letter every time I couldn’t say the truth out loud.\n\n` +
          `They lived in a shoebox under my bed: apologies, gratitude, anger, and love—folded into neat squares like I could compress a whole storm into paper.\n\n` +
          `On the night you left, the house felt too quiet, like it had swallowed its own echo.\n\n` +
          `I didn’t send a single one.\n\n` +
          `Instead, I tore them carefully and watched the ink bleed into the water—until the words stopped owning me.\n\n` +
          `Some goodbyes don’t need an audience. They just need an ending.`,
        qa: [],
      },
    ];

    await Story.insertMany(storiesToCreate);

    return res.status(201).json({
      message: "2 mock stories saved for your account successfully",
      response: null,
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: error.message,
    });
  }
};

const transcribeAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No audio file provided",
        response: null,
        error: "No audio file provided",
      });
    }

    const { toFile } = require("openai");

    // Convert buffer to file object that openai expects
    const file = await toFile(req.file.buffer, "audio.webm");

    const response = await getOpenAI().audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "en",
    });

    return res.status(200).json({
      message: "Audio transcribed successfully",
      response: {
        text: response.text,
      },
      error: null,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return res.status(500).json({
      message: "Failed to transcribe audio",
      response: null,
      error: error.message,
    });
  }
};

// POST /user/story/conversation
// Deep memory discovery: takes the running conversation and returns the AI's next reply.
const chatMemory = async (req, res) => {
  const userId = req.decoded?.id;
  const { messages } = req.body;

  try {
    const user = await User.findById(userId).select(
      "isPublic trialUsed trialStartDate trialEndDate createdAt"
    );
    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
        response: null,
        error: "User not found",
      });
    }

    const access = await assertCanUseStoriesOrRespond(res, user);
    if (!access.ok) return;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        message: "Conversation messages are required",
        response: null,
        error: "Invalid messages",
      });
    }

    // Prefer an admin-managed prompt; fall back to the built-in operational prompt.
    const promptDoc = await Prompt.findOne({ name: "memory-conversation-prompt" });
    const systemPrompt = promptDoc?.prompt?.trim() || DEFAULT_MEMORY_CONVERSATION_PROMPT;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      { role: "system", content: MEMORY_STATUS_INSTRUCTION },
      ...messages
        .filter((m) => m && (m.role === "user" || m.role === "assistant"))
        .map((m) => ({ role: m.role, content: String(m.content || "") })),
    ];

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4",
      messages: chatMessages,
      temperature: 0.8,
    });

    const rawReply = completion.choices?.[0]?.message?.content?.trim();
    if (!rawReply) {
      return res.status(500).json({
        message: "AI failed to respond",
        response: null,
        error: "AI returned no content",
      });
    }

    const userMessageCount = messages.filter((m) => m?.role === "user").length;
    const { reply, status } = parseMemoryReply(rawReply, userMessageCount);

    return res.status(200).json({
      message: "Reply generated successfully",
      response: { reply, status },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: error.message,
    });
  }
};

// POST /user/story/conversation/generate
// Turns the completed memory conversation into a finished, refined story.
const generateStoryFromConversation = async (req, res) => {
  const { id, email } = req.decoded;
  const { messages } = req.body;

  try {
    const user = await User.findById(id).select(
      "isPublic trialUsed trialStartDate trialEndDate createdAt"
    );
    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
        response: null,
        error: "User not found",
      });
    }

    const access = await assertCanUseStoriesOrRespond(res, user);
    if (!access.ok) return;

    const normalizedMessages = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({ role: m.role, content: String(m.content || "") }));

    const userMessages = normalizedMessages.filter((m) => m.role === "user");
    if (userMessages.length === 0) {
      return res.status(400).json({
        message: "Please share some of your memory before creating the story",
        response: null,
        error: "No user input in conversation",
      });
    }

    const transcript = normalizedMessages
      .map((m) => `${m.role === "user" ? "Storyteller" : "Guide"}: ${m.content}`)
      .join("\n");

    // Reuse the existing narrative prompt; fall back gracefully if it's missing.
    const promptDoc = await Prompt.findOne({ name: "story-prompt" });
    const basePrompt =
      promptDoc?.prompt?.trim() ||
      "Write a warm, heartfelt first-person memory story based on the conversation below. Preserve the storyteller's authentic voice, details, and emotions.";

    const conversationPart = `Guided Memory Conversation Transcript:\n${transcript}`;
    const frameworkPrompt = `
      Return the output in EXACTLY this format (single line, comma separated):
      <Title>, <Genre>, <Time to read>, <Full Story Body>

      Rules:
      - Do not include labels like "Title:" or "Genre:" or "Time to read:".
      - Title should be catchy but relevant.
      - Title must NOT be wrapped in quotation marks or quotes.
      - Genre should be ONE word only (e.g., Fantasy, Romance, Drama).
      - Time to read should be like "2 min read".
      - After the third comma, give the full story narrative built from the conversation.
      - Do not add extra line breaks or commentary before or after.
      - Do not include potential story titles.
    `.trim();

    const enhancementPrompt =
      `${conversationPart}\n\nNarrative Instructions:${basePrompt}\n\nLayout & Framework Instructions:${frameworkPrompt}`.trim();

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: enhancementPrompt }],
      temperature: 0.8,
    });

    let enhancedStory = completion.choices?.[0]?.message?.content;
    if (!enhancedStory) {
      return res.status(500).json({
        message: "AI failed to return the story",
        response: null,
        error: "AI returned no content",
      });
    }

    if (enhancedStory.startsWith(`"`)) enhancedStory = enhancedStory.slice(1);
    if (enhancedStory.endsWith(`"`)) enhancedStory = enhancedStory.slice(0, -1);

    const parts = enhancedStory.split(",");
    const title = (parts[0]?.trim() || "")?.replace(/^["']|["']$/g, "");
    const genre = (parts[1]?.trim() || "")?.replace(/^["']|["']$/g, "");
    const timeRead = (parts[2]?.trim() || "")?.replace(/^["']|["']$/g, "");
    const storyBody = parts.slice(3).join(",").trim();

    // First shared memory becomes the seed user_story (required by the model).
    const seedStory = userMessages.map((m) => m.content).join("\n\n").slice(0, 10000);

    const newStory = await Story.create({
      userId: id,
      user_story: seedStory,
      source: "conversation",
      conversation: normalizedMessages,
      story_title: title,
      genre,
      read_time: timeRead,
      enhanced_story: storyBody,
      book_version_title: title,
    });

    if (!user.isPublic) {
      if (access.subscription) {
        await Subscription.findOneAndUpdate(
          { userId: user._id },
          { $inc: { storiesCreated: 1 } }
        );
      }

      const generatedStory = storyBody
        .replace(/\n\n/g, "<br /><br />")
        .replace(/\n/g, "<br />");
      const dynamicData = {
        subject: "Story generated successfully",
        to_email: email,
      };
      const emailTemplate = await generateStoryEmail(generatedStory);
      await sendMail(emailTemplate, dynamicData);
    }

    return res.status(201).json({
      message: "Story generated successfully",
      response: { storyId: newStory._id },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: error.message,
    });
  }
};

module.exports = {
  createStory,
  generateStory,
  resendStory,
  getUserStories,
  reviseStory,
  uploadHeroImage,
  deleteStory,
  seedMockStoriesForMe,
  transcribeAudio,
  chatMemory,
  generateStoryFromConversation,
};
