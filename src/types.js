/**
 * @typedef {'suno_song' | 'suno_list' | 'suno_workspace' | 'chatgpt' | 'claude' | 'gemini' | 'copilot' | 'perplexity' | 'poe'} EntrySource
 */

/**
 * @typedef {'auto_lyrics' | 'auto_title' | 'manual'} LinkType
 */

/**
 * @typedef {Object} Entry
 * @property {string} id
 * @property {EntrySource} source
 * @property {string} title
 * @property {string} [lyrics]
 * @property {string} [stylePrompt]
 * @property {string} sourceUrl
 * @property {string} [clipId]
 * @property {string} [gptName]
 * @property {string} [gptId]
 * @property {string} [conversationId]
 * @property {string} [listContext]
 * @property {string} [imageUrl]
 * @property {string} capturedAt
 * @property {string} [updatedAt]
 * @property {string} [lyricsNorm]
 * @property {string} [titleNorm]
 * @property {string} [searchText]
 */

/**
 * @typedef {Object} Link
 * @property {string} id
 * @property {string} chatgptEntryId
 * @property {string} sunoEntryId
 * @property {LinkType} linkType
 * @property {number} score
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Settings
 * @property {boolean} autoSaveSuno
 * @property {boolean} autoSaveAI
 * @property {boolean} autoSaveChatGPT
 * @property {boolean} autoSaveList
 * @property {number} linkThreshold
 * @property {number} linkWindowDays
 * @property {string[]} [gptNameFilter]
 */

/** @returns {Settings} */
export function defaultSettings() {
  return {
    autoSaveSuno: true,
    autoSaveAI: true,
    autoSaveChatGPT: true,
    autoSaveList: true,
    linkThreshold: 0.75,
    linkWindowDays: 30,
    gptNameFilter: [],
  };
}
