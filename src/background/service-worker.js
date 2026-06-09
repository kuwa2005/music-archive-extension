import { defaultSettings } from '../types.js';
import { upsertEntry, searchEntries, getLinkedEntries, getLinkedEntryIds, getAllLinks, upsertLink, deleteLink, deleteLinksBetweenEntryIds, deleteAllLinksForEntry, exportAll, importAll, countEntries, deleteEntry, getEntry, previewCleanup, bulkDeleteByCleanupFilters, setEntryProtected } from '../db/repository.js';
import { autoLinkSunoEntry, autoLinkAiEntry } from './linker.js';
import { isAiSource } from '../lib/ai-sources.js';
import { isSunoEntrySource } from '../lib/suno-sources.js';
import { showTabDialog } from '../lib/tab-dialog.js';
import { detectCaptureAction } from '../lib/capture-actions.js';
import { captureFromTab, ensureSunoCreatedAt } from '../lib/capture-tab.js';
import { prepareSaveEntry, resolveSavePayload, unwrapCapturePayload } from '../lib/capture-payload.js';
import { debugLog, debugWarn, debugError, debugInfo } from '../lib/debug.js';
import { t } from '../lib/i18n.js';

const SETTINGS_KEY = 'settings';

/**
 * @returns {Promise<import('../types.js').Settings>}
 */
async function getSettings() {
  const result = await chrome.storage.local.get([SETTINGS_KEY]);
  const raw = result[SETTINGS_KEY] || {};
  const {
    autoSaveSuno: _suno,
    autoSaveAI: _ai,
    autoSaveChatGPT: _gpt,
    autoSaveList: _list,
    ...rest
  } = raw;
  return { ...defaultSettings(), ...rest };
}

/**
 * @param {Partial<import('../types.js').Settings>} patch
 */
async function saveSettings(patch) {
  const current = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...patch } });
}

/**
 * @param {Partial<import('../types.js').Entry>[]} items
 * @returns {Promise<{ count: number, isNew?: boolean }>}
 */
async function saveEntriesWithLink(items) {
  const settings = await getSettings();
  /** @type {boolean | undefined} */
  let isNew;
  for (const item of items) {
    const { entry, isNew: itemIsNew } = await upsertEntry(item);
    if (items.length === 1) {
      isNew = itemIsNew;
    }
    if (isSunoEntrySource(entry.source)) {
      await autoLinkSunoEntry(entry, settings);
    } else if (isAiSource(entry.source)) {
      await autoLinkAiEntry(entry, settings);
    }
  }
  return { count: items.length, ...(items.length === 1 ? { isNew } : {}) };
}

/**
 * @param {Partial<import('../types.js').Entry>} data
 */
/**
 * @param {number} tabId
 * @param {string} message
 */
async function notifySaveOnTab(tabId, message) {
  const { shown } = await showTabDialog(tabId, message);
  if (shown) return;
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: t('extName'),
    message,
  });
}

async function saveEntryWithLink(data) {
  const settings = await getSettings();
  const { entry, isNew } = await upsertEntry(data);
  debugLog('saved entry', {
    id: entry.id,
    source: entry.source,
    clipId: entry.clipId,
    sunoCreatedAt: entry.sunoCreatedAt,
    isNew,
  });
  let links = [];

  if (isSunoEntrySource(entry.source)) {
    links = await autoLinkSunoEntry(entry, settings);
  } else if (isAiSource(entry.source)) {
    links = await autoLinkAiEntry(entry, settings);
  }

  if (links.length > 0) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: t('extName'),
      message: t('notifyAutoLink', String(links.length), entry.title || t('untitled')),
    });
  }

  return { entry, links, isNew };
}

/**
 * capture 済みペイロードを ensureSunoCreatedAt → upsert する（popup / saveFromTab 共通）。
 * @param {number|undefined} tabId
 * @param {unknown} captured
 * @param {{ activateTab?: boolean, notifyOnTab?: boolean }} [options]
 */
async function persistCapturedData(tabId, captured, request = {}, options = {}) {
  if (Array.isArray(captured)) {
    return saveEntriesWithLink(captured);
  }

  let data = prepareSaveEntry(captured, request);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('invalid capture payload');
  }

  debugLog('persistCapturedData', {
    source: data.source,
    clipId: data.clipId,
    sunoCreatedAt: data.sunoCreatedAt,
    activateTab: options.activateTab,
  });

  if (tabId && data.source === 'suno_song') {
    data = await ensureSunoCreatedAt(tabId, data, options);
    debugLog('persistCapturedData:afterEnsure', {
      clipId: data.clipId,
      sunoCreatedAt: data.sunoCreatedAt,
    });
  }
  return saveEntryWithLink(data);
}

/**
 * 対象タブから capture し、Suno 曲は sunoCreatedAt を補完してから保存する。
 * @param {number} tabId
 * @param {{ activateTab?: boolean, notifyOnTab?: boolean, sunoCreatedAt?: unknown }} [options] — activateTab false: ポップアップ保存向け（タブ前面化しない）。notifyOnTab false: 呼び出し元がダイアログ表示
 * @returns {Promise<{ entry?: import('../types.js').Entry, links?: import('../types.js').Link[], count?: number }>}
 */
async function saveFromTab(tabId, options = {}) {
  const shouldNotifyOnTab = options.notifyOnTab !== false;
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url || '';
  const captureAction = detectCaptureAction(url);
  if (!captureAction) {
    throw new Error('unsupported page');
  }

  debugLog('saveFromTab:start', {
    tabId,
    url,
    captureAction,
    activateTab: options.activateTab === true,
  });

  const response = await captureFromTab(tabId, captureAction, options);
  if (!response?.success) {
    debugWarn('saveFromTab:captureFailed', {
      tabId,
      error: response?.error || 'capture failed',
    });
    throw new Error(response?.error || 'capture failed');
  }

  const payload = unwrapCapturePayload(response);
  if (payload == null) {
    debugWarn('saveFromTab:emptyPayload', { tabId });
    throw new Error('capture payload empty');
  }

  const request = { sunoCreatedAt: options.sunoCreatedAt };

  if (Array.isArray(payload)) {
    const result = await persistCapturedData(tabId, payload, request, options);
    if (shouldNotifyOnTab) {
      const message =
        payload.length > 1
          ? t('saveMultiple', String(payload.length))
          : result.isNew
            ? t('saveNew')
            : t('saveOverwrite');
      await notifySaveOnTab(tabId, message);
    }
    debugLog('saveFromTab:done', { tabId, count: payload.length, isNew: result.isNew });
    return result;
  }

  const result = await persistCapturedData(tabId, payload, request, options);
  if (shouldNotifyOnTab) {
    await notifySaveOnTab(tabId, result.isNew ? t('saveNew') : t('saveOverwrite'));
  }
  debugLog('saveFromTab:done', {
    tabId,
    clipId: result.entry?.clipId,
    sunoCreatedAt: result.entry?.sunoCreatedAt,
    isNew: result.isNew,
  });
  return result;
}

/**
 * @param {Record<string, unknown>} request
 * @returns {Promise<Record<string, unknown>>}
 */
async function dispatchAction(request) {
  switch (request.action) {
    case 'ping':
      return {
        success: true,
        pong: true,
        version: chrome.runtime.getManifest().version,
        supportsCleanup: true,
      };
    case 'getSettings':
      return { success: true, settings: await getSettings() };
    case 'saveSettings':
      await saveSettings(request.settings || {});
      return { success: true, settings: await getSettings() };
    case 'saveEntry': {
      const payload = resolveSavePayload(request);
      if (!payload || typeof payload !== 'object') {
        return { success: false, error: 'data required' };
      }
      return { success: true, ...(await saveEntryWithLink(payload)) };
    }
    case 'saveCapturedData': {
      const captured = resolveSavePayload(request);
      if (captured == null) {
        return { success: false, error: 'captured required' };
      }
      const activateTab = request.activateTab === true;
      try {
        debugLog('saveCapturedData:start', {
          tabId: request.tabId,
          activateTab,
          hasSunoCreatedAt: !!request.sunoCreatedAt,
        });
        const result = await persistCapturedData(request.tabId, captured, request, { activateTab });
        debugLog('saveCapturedData:done', {
          clipId: result.entry?.clipId,
          sunoCreatedAt: result.entry?.sunoCreatedAt,
          count: result.count,
        });
        return { success: true, ...result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        debugError('saveCapturedData:failed', message, err);
        return { success: false, error: message };
      }
    }
    case 'saveCurrentTab': {
      if (!request.tabId) {
        return { success: false, error: 'tabId required' };
      }
      // ポップアップ経由は既定でタブ前面化しない（前面化するとポップアップが閉じ応答が届かない）
      const activateTab = request.activateTab === true;
      debugLog('saveCurrentTab:start', {
        tabId: request.tabId,
        activateTab,
      });
      try {
        const result = await saveFromTab(request.tabId, {
          activateTab,
          sunoCreatedAt: request.sunoCreatedAt,
          notifyOnTab: false,
        });
        return { success: true, ...result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        debugError('saveCurrentTab:failed', { tabId: request.tabId, message }, err);
        return { success: false, error: message };
      }
    }
    case 'saveEntries': {
      await saveEntriesWithLink(request.data || []);
      return { success: true, count: (request.data || []).length };
    }
    case 'search': {
      const results = await searchEntries(request.options || {});
      const [linkedIds, links] = await Promise.all([getLinkedEntryIds(), getAllLinks()]);
      return { success: true, results, linkedIds: [...linkedIds], links };
    }
    case 'getLinked':
      return { success: true, ...(await getLinkedEntries(request.entryId)) };
    case 'createLink':
      return {
        success: true,
        link: await upsertLink({
          chatgptEntryId: request.chatgptEntryId,
          sunoEntryId: request.sunoEntryId,
          linkType: 'manual',
          score: 1,
        }),
      };
    case 'deleteLink':
      await deleteLink(request.linkId);
      return { success: true };
    case 'deleteLinksBetween': {
      const entryIds = Array.isArray(request.entryIds) ? request.entryIds : [];
      const deleted = await deleteLinksBetweenEntryIds(entryIds);
      return { success: true, deleted };
    }
    case 'deleteAllLinksForEntry': {
      if (!request.entryId) {
        return { success: false, error: 'entryId required' };
      }
      const deleted = await deleteAllLinksForEntry(request.entryId);
      return { success: true, deleted };
    }
    case 'deleteEntry':
      await deleteEntry(request.entryId);
      return { success: true };
    case 'getEntry':
      return { success: true, entry: await getEntry(request.entryId) };
    case 'exportAll':
      return { success: true, data: await exportAll() };
    case 'importAll':
      return {
        success: true,
        ...(await importAll(request.data || {}, request.mode || 'append')),
      };
    case 'countEntries':
      return { success: true, count: await countEntries() };
    case 'getExtensionInfo':
      return {
        success: true,
        version: chrome.runtime.getManifest().version,
        supportsCleanup: true,
      };
    case 'previewCleanup':
      return {
        success: true,
        ...(await previewCleanup(request.filters || {}, request.limit ?? 8)),
      };
    case 'bulkDeleteCleanup': {
      const deleted = await bulkDeleteByCleanupFilters(request.filters || {});
      return { success: true, ...deleted };
    }
    case 'setEntryProtected':
      return {
        success: true,
        entry: await setEntryProtected(request.entryId, !!request.protected),
      };
    default:
      return { success: false, error: 'unknown action' };
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') {
    debugInfo(
      'extension updated to',
      chrome.runtime.getManifest().version,
      '— reload open Suno/AI tabs if cleanup preview fails',
    );
  }

  chrome.contextMenus.create({
    id: 'save-suno-song',
    title: t('ctxSaveSunoSong'),
    contexts: ['page'],
    documentUrlPatterns: [
      'https://suno.com/song/*',
      'https://*.suno.com/song/*',
      'https://suno.com/s/*',
      'https://*.suno.com/s/*',
    ],
  });
  chrome.contextMenus.create({
    id: 'save-suno-list',
    title: t('ctxSaveSunoList'),
    contexts: ['page'],
    documentUrlPatterns: [
      'https://suno.com/create*',
      'https://*.suno.com/create*',
      'https://suno.com/playlist/*',
      'https://*.suno.com/playlist/*',
    ],
  });
  chrome.contextMenus.create({
    id: 'save-ai-chat',
    title: t('ctxSaveAiChat'),
    contexts: ['page'],
    documentUrlPatterns: [
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://copilot.microsoft.com/*',
      'https://copilot.com/*',
      'https://perplexity.ai/*',
      'https://*.perplexity.ai/*',
      'https://poe.com/*',
    ],
  });
  chrome.contextMenus.create({
    id: 'open-dashboard',
    title: t('ctxOpenDashboard'),
    contexts: ['page'],
    documentUrlPatterns: [
      'https://suno.com/*',
      'https://*.suno.com/*',
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://copilot.microsoft.com/*',
      'https://copilot.com/*',
      'https://perplexity.ai/*',
      'https://*.perplexity.ai/*',
      'https://poe.com/*',
    ],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === 'open-dashboard') {
    chrome.runtime.openOptionsPage();
    return;
  }

  const saveMenuIds = new Set(['save-suno-song', 'save-suno-list', 'save-ai-chat']);
  if (!saveMenuIds.has(String(info.menuItemId))) return;

  try {
    await saveFromTab(tab.id);
  } catch (err) {
    debugError('context menu save failed', err);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?._target !== 'background' && sender.tab) return false;

  (async () => {
    try {
      sendResponse(await dispatchAction(request));
    } catch (err) {
      sendResponse({ success: false, error: String(err) });
    }
  })();
  return true;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ma-background') return;

  port.onMessage.addListener((request) => {
    const requestId = request?.requestId;
    (async () => {
      try {
        const result = await dispatchAction(request);
        port.postMessage({ requestId, ...result });
      } catch (err) {
        port.postMessage({
          requestId,
          success: false,
          error: String(err),
        });
      }
    })();
  });
});
