import { coerceSunoCreatedAt } from './suno-created-at.js';
import { debugLog, debugWarn } from './debug.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const CONNECTION_ERROR_RE =
  /Receiving end does not exist|Could not establish connection|message port closed/i;

/**
 * @param {unknown} err
 */
function isConnectionError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return CONNECTION_ERROR_RE.test(msg);
}

/**
 * @param {number} tabId
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ success?: boolean, data?: unknown, error?: string } | undefined>}
 */
export async function sendTabMessage(tabId, payload) {
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch (err) {
    if (isConnectionError(err)) {
      return { success: false, error: 'content_script_unavailable' };
    }
    throw err;
  }
}

/**
 * @typedef {{ activateTab?: boolean }} CaptureTabOptions
 */

/**
 * ポップアップ保存では activateTab=false とし、タブ前面化でポップアップが閉じて
 * saveCurrentTab の応答が届かなくなるのを防ぐ。右クリック保存は activateTab=true で DOM を確実に描画。
 * @param {number} tabId
 * @param {string} captureAction
 * @param {CaptureTabOptions} [options]
 * @returns {Promise<{ success?: boolean, data?: unknown, error?: string }>}
 */
export async function captureFromTab(tabId, captureAction, options = {}) {
  const { activateTab = true } = options;
  const message = { action: captureAction };

  debugLog('captureFromTab', { tabId, captureAction, activateTab });

  let response = await sendTabMessage(tabId, message);
  if (response?.success !== false && response != null) {
    debugLog('captureFromTab:ok', {
      tabId,
      hasData: response.data != null,
      sunoCreatedAt: response.data?.sunoCreatedAt ?? response.sunoCreatedAt,
    });
    return response;
  }

  if (!activateTab) {
    debugWarn('captureFromTab:failed', {
      tabId,
      activateTab,
      error: response?.error || 'capture failed',
    });
    return response ?? { success: false, error: 'capture failed' };
  }

  await chrome.tabs.update(tabId, { active: true });
  await sleep(250);
  response = await sendTabMessage(tabId, message);
  return response ?? { success: false, error: 'capture failed' };
}

/**
 * sunoCreatedAt 補完失敗時も呼び出し元の保存は継続する（title/lyrics 等はそのまま保存）。
 * @param {number} tabId
 * @param {Record<string, unknown>} data
 * @param {CaptureTabOptions} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function ensureSunoCreatedAt(tabId, data, options = {}) {
  const { activateTab = true } = options;
  if (data?.source !== 'suno_song') return data;

  const normalized = coerceSunoCreatedAt(data.sunoCreatedAt);
  if (normalized) {
    return { ...data, sunoCreatedAt: normalized };
  }

  try {
    if (activateTab) {
      await chrome.tabs.update(tabId, { active: true });
      await sleep(200);
    }
    const retry = await sendTabMessage(tabId, { action: 'getSunoCreatedAt' });
    const retryDate = coerceSunoCreatedAt(retry?.sunoCreatedAt);
    if (retry?.success && retryDate) {
      return { ...data, sunoCreatedAt: retryDate };
    }
  } catch (err) {
    debugWarn('ensureSunoCreatedAt failed', err);
  }
  return data;
}
