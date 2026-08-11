const MAX_STORY_WORDS = 20000;
/** Safety cap so extremely long tokens cannot bypass word limits. */
const MAX_STORY_CHARACTERS = 200000;

const countWords = (text) => {
  if (!text || !String(text).trim()) return 0;
  return String(text).trim().split(/\s+/).length;
};

const truncateToMaxWords = (text, maxWords = MAX_STORY_WORDS) => {
  const value = String(text || "");
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return words.slice(0, maxWords).join(" ");
};

const storyWordLimitRule = (value, helpers) => {
  const text = String(value || "");
  if (text.length > MAX_STORY_CHARACTERS) {
    return helpers.error("string.maxChars");
  }
  if (countWords(text) > MAX_STORY_WORDS) {
    return helpers.error("string.maxWords");
  }
  return value;
};

const storyWordLimitMessages = {
  "string.maxWords": `Story cannot exceed ${MAX_STORY_WORDS.toLocaleString()} words`,
  "string.maxChars": `Story is too long (maximum ${MAX_STORY_CHARACTERS.toLocaleString()} characters)`,
};

module.exports = {
  MAX_STORY_WORDS,
  MAX_STORY_CHARACTERS,
  countWords,
  truncateToMaxWords,
  storyWordLimitRule,
  storyWordLimitMessages,
};
