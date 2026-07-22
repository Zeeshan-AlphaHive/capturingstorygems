const Prompt = require("../models/prompt");
const Admin = require("../models/admin");
const MEMORY_CONVERSATION_PROMPT_DEFAULT = require("../data/prompts/memoryConversationPrompt");

const runSeeder = async () => {
  try {
    const promptCount = await Prompt.countDocuments();
    if (promptCount === 0) {
      await Prompt.insertMany([
        {
          name: "question-prompt",
          prompt: `You are a professional story enhancer. A user has shared their personal or emotional narrative. 
            Your task is to delve deeper into their experiences by generating a list of 10 insightful and 
            thought-provoking follow-up questions. These questions should aim to uncover deeper layers of meaning 
            and emotion within their story, enabling you to enhance it more effectively. The final question should 
            invite them to share any additional thoughts or details that may further enrich the narrative. Please return 
            the questions only, numbered 1 to 10, without any additional commentary. Below is the user's story or thoughts:`,
        },
        {
          name: "story-prompt",
          prompt: `You are an elite storytelling AI with the talent to transform real-life personal stories into emotionally powerful, genre-aware narratives.
            At the top, you will find the user's **original story**, followed by their **insightful responses** to reflective questions. These Q&A answers provide emotional and contextual depth — use them to fully understand the user’s personal journey.
            Your mission is to **rewrite and elevate the story** so it resonates deeply with readers — in a style that could rival literary legends like Fyodor Dostoevsky, Dante Alighieri, Leo Tolstoy, Victor Hugo, William Shakespeare, Goethe, Cervantes, and Italo Calvino.

            ### Additional Instruction:
            First, understand the **tone and genre** of the story:  
            Is it serious, romantic, humorous, heartbreaking, dramatic, psychological, philosophical, or criminal in nature?

            Then choose the **most fitting literary voice** — for example:
            - Tragic or romantic? Write in the tone of **Shakespeare** or **Victor Hugo**.
            - Philosophical or darkly emotional? Use **Dostoevsky** or **Tolstoy**’s style.
            - Magical or imaginative? Channel **Calvino** or **Goethe**.
            - Humorous or satirical? Think **Cervantes**.

            Adapt your tone, rhythm, and language style to match that classic literary voice — so that the story not only conveys emotion, but also **feels like a masterpiece** in its own genre.

            ### Focus on the following:
            1. **Emotional Depth:** Weave the user’s feelings into the narrative — highlight their pain, courage, humor, hope, or growth.
            2. **Narrative Clarity:** Ensure a clear and graceful flow that pulls readers through the journey without confusion.
            3. **Authenticity:** Stay true to the user’s tone and truth. Do not invent or exaggerate events.
            4. **Genre-based Resonance:** The tone, pace, and choice of words should match the emotional genre of the story.
            5. **Reader Delight:** Make the final story feel *alive* — moving, gripping, inspiring, or even funny, depending on the user’s story.

            **Important Guidelines:**
            - Do NOT refer to the original story or Q&A explicitly.
            - Return only the enhanced version of the story.
            - Final output **must not exceed 1000 characters**, including spaces and punctuation.
            - The result should feel timeless, emotionally rich, and worthy of remembrance.`,
        },
        {
          name: "memory-conversation-prompt",
          prompt: MEMORY_CONVERSATION_PROMPT_DEFAULT,
        },
      ]);
      console.log("Prompts seeded successfully!");
    } else {
      console.log("Prompts already exist, skipping seeding");
    }

    const memoryPrompt = await Prompt.findOne({ name: "memory-conversation-prompt" });
    if (!memoryPrompt) {
      await Prompt.create({
        name: "memory-conversation-prompt",
        prompt: MEMORY_CONVERSATION_PROMPT_DEFAULT,
      });
      console.log("memory-conversation-prompt added to existing prompts");
    }

    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      await Admin.insertOne({
        email: "admin@example.com",
        password:
          "$2b$10$K2uzNSK9mCrdlXnA4KHEDO.KBBzqvc8d8AzxsTtCo9ZZRflGfPsAy",
      });
      console.log("Admin seeded successfully!");
    } else {
      console.log("Admin already exist, skipping seeding");
    }
  } catch (err) {
    console.error("Error seeding:", err);
  }
};

module.exports = {
  runSeeder,
};
