/** @typedef {'chatgpt' | 'claude' | 'gemini' | 'copilot' | 'perplexity' | 'poe'} AiSource */

/** @type {AiSource[]} */
export const AI_SOURCES = ['chatgpt', 'claude', 'gemini', 'copilot', 'perplexity', 'poe'];

/** @type {Record<AiSource, string>} */
export const AI_LABELS = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  copilot: 'Copilot',
  perplexity: 'Perplexity',
  poe: 'Poe',
};

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isAiSource(source) {
  return AI_SOURCES.includes(/** @type {AiSource} */ (source));
}

/**
 * @param {string} source
 * @returns {string}
 */
export function getAiLabel(source) {
  return AI_LABELS[/** @type {AiSource} */ (source)] || source;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isAiChatUrl(url) {
  return /chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|copilot\.com|perplexity\.ai|poe\.com/i.test(
    url,
  );
}

/**
 * @returns {Promise<import('../types.js').Entry[]>}
 */
export async function getAllAiEntries(getEntriesBySource, days) {
  const all = [];
  for (const source of AI_SOURCES) {
    const rows = await getEntriesBySource(source, days);
    all.push(...rows);
  }
  all.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  return all;
}
