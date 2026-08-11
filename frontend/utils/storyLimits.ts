export const MAX_STORY_WORDS = 20000;

export function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

export function formatWordCount(count: number): string {
  return count.toLocaleString();
}
