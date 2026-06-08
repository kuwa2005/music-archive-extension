import { detectCaptureAction } from '../lib/capture-actions.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * ポップアップ表示中にタブがバックグラウンド化すると DOM 日時が描画されないため、
 * 保存前に対象タブを前面化してから capture する。
 * @param {number} tabId
 * @param {string} captureAction
 * @returns {Promise<{ success?: boolean, data?: unknown, error?: string }>}
 */
export async function captureFromTab(tabId, captureAction) {
  await chrome.tabs.update(tabId, { active: true });
  await sleep(250);
  return chrome.tabs.sendMessage(tabId, { action: captureAction });
}

/**
 * @param {number} tabId
 * @param {Record<string, unknown>} data
 * @returns {Promise<Record<string, unknown>>}
 */
export async function ensureSunoCreatedAt(tabId, data) {
  if (data?.source !== 'suno_song') return data;
  if (typeof data.sunoCreatedAt === 'string' && data.sunoCreatedAt) return data;

  try {
    await chrome.tabs.update(tabId, { active: true });
    await sleep(200);
    const retry = await chrome.tabs.sendMessage(tabId, { action: 'getSunoCreatedAt' });
    if (retry?.success && typeof retry.sunoCreatedAt === 'string' && retry.sunoCreatedAt) {
      return { ...data, sunoCreatedAt: retry.sunoCreatedAt };
    }
  } catch (err) {
    console.warn('[music-archive] ensureSunoCreatedAt failed', err);
  }
  return data;
}
