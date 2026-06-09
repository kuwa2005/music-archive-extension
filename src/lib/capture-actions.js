/**
 * @param {string} url
 * @returns {'captureSunoSong' | 'captureSunoList' | 'captureAI' | null}
 */
export function detectCaptureAction(url) {
  if (/suno\.com\/(?:song|s)\//i.test(url)) return 'captureSunoSong';
  if (/suno\.com\/(create|playlist|me)/i.test(url)) return 'captureSunoList';
  if (
    /chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|copilot\.com|perplexity\.ai|poe\.com/i.test(
      url,
    )
  ) {
    return 'captureAI';
  }
  return null;
}
