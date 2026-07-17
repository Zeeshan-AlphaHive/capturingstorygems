const { Router } = require("express");
const router = Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const {
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
} = require("../../controllers/user/story.js");
const { verifyUserToken } = require("../../middlewares/authMiddleware.js");
const { blockPublicUsers } = require("../../middlewares/blockPublicUsers.js");
const { bodyValidator } = require("../../middlewares/joi.js");

router.post("/", verifyUserToken, bodyValidator("storySchema"), createStory);

router.post("/transcribe", verifyUserToken, upload.single("audio"), transcribeAudio);

router.post("/generate", verifyUserToken, generateStory);

router.post(
  "/conversation",
  verifyUserToken,
  bodyValidator("storyChatSchema"),
  chatMemory
);

router.post(
  "/conversation/generate",
  verifyUserToken,
  bodyValidator("storyChatSchema"),
  generateStoryFromConversation
);

router.get("/resend", verifyUserToken, blockPublicUsers, resendStory);

router.get("/", verifyUserToken, getUserStories);

// router.put("/:storyId", verifyUserToken,  bodyValidator("storySchema"), reviseStory);
router.put("/:storyId", verifyUserToken, bodyValidator("reviseStorySchema"), reviseStory);

router.post('/:storyId/hero', verifyUserToken, uploadHeroImage);

router.delete("/:storyId", verifyUserToken, deleteStory);

router.post("/seed", verifyUserToken, seedMockStoriesForMe);

module.exports = router;
