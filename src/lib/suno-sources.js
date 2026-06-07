/** @typedef {'suno_song' | 'suno_list' | 'suno_workspace' | 'chatgpt' | 'claude' | 'gemini' | 'copilot' | 'perplexity' | 'poe'} EntrySource */

/** @type {EntrySource[]} */
export const SUNO_ENTRY_SOURCES = ['suno_song', 'suno_list', 'suno_workspace'];

/** @type {Record<string, string>} */
export const SUNO_SOURCE_LABELS = {
  suno_song: 'Suno 曲',
  suno_workspace: 'Suno ワークスペース',
  suno_list: 'Suno プレイリスト等',
};

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isSunoEntrySource(source) {
  return SUNO_ENTRY_SOURCES.includes(/** @type {EntrySource} */ (source));
}

/**
 * @param {string} source
 * @returns {string}
 */
export function getSunoSourceLabel(source) {
  return SUNO_SOURCE_LABELS[source] || source;
}

/**
 * @param {{ type: string, label: string }} ctx
 * @returns {EntrySource}
 */
export function sourceFromListContext(ctx) {
  if (ctx.type === 'workspace') return 'suno_workspace';
  return 'suno_list';
}

/**
 * @returns {Promise<import('../types.js').Entry[]>}
 */
export async function getAllSunoListEntries(getEntriesBySource, days) {
  const list = await getEntriesBySource('suno_list', days);
  const workspace = await getEntriesBySource('suno_workspace', days);
  return [...list, ...workspace];
}
