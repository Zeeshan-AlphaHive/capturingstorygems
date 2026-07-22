const salt = parseInt(process.env.USER_PASSWORD_SALT || 10);
const mongoDbUrl = process.env.MONGODB_URL;
const jwtSecret = process.env.JWT_SECRET;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const openAiKey = process.env.OPENAI_API_KEY;
const openAiChatModel = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const openAiStoryModel = process.env.OPENAI_STORY_MODEL || "gpt-4o";

const gmailUser = process.env.GMAIL_USER;
const gmailPassword = process.env.GMAIL_PASSWORD;
const supportEmail = process.env.SUPPORT_EMAIL

const frontendBaseUrl = process.env.FRONTEND_BASE_URL;
const configurations = {
  salt,
  mongoDbUrl,
  jwtSecret,
  stripeSecretKey,
  stripeWebhookSecret,
  googleClientId,
  openAiKey,
  openAiChatModel,
  openAiStoryModel,
  gmailUser,
  gmailPassword,
  supportEmail,
  frontendBaseUrl,
};

module.exports = {
  configurations,
};
