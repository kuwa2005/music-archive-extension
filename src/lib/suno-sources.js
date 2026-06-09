import { t } from './i18n.js';

/** @typedef {'suno_song' | 'suno_list' | 'suno_workspace' | 'chatgpt' | 'claude' | 'gemini' | 'copilot' | 'perplexity' | 'poe'} EntrySource */

/** @type {EntrySource[]} */
export const SUNO_ENTRY_SOURCES = ['suno_song', 'suno_list', 'suno_workspace'];

/** @type {Record<string, string>} */
const SUNO_SOURCE_MESSAGE_KEYS = {
  suno_song: 'sourceSunoSong',
  suno_workspace: 'sourceSunoWorkspace',
  suno_list: 'sourceSunoList',
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
  const key = SUNO_SOURCE_MESSAGE_KEYS[source];
  return key ? t(key) : source;
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
