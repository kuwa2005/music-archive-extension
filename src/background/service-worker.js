import { defaultSettings } from '../types.js';
import { upsertEntry, searchEntries, getLinkedEntries, upsertLink, deleteLink, exportAll, importAll, countEntries, deleteEntry, getEntry, previewCleanup, bulkDeleteByCleanupFilters, setEntryProtected } from '../db/repository.js';
import { autoLinkSunoEntry, autoLinkAiEntry } from './linker.js';
import { isAiSource } from '../lib/ai-sources.js';
import { isSunoEntrySource } from '../lib/suno-sources.js';

const SETTINGS_KEY = 'settings';

/**
 * @returns {Promise<import('../types.js').Settings>}
 */
async function getSettings() {
  const result = await chrome.storage.local.get([SETTINGS_KEY]);
  const raw = result[SETTINGS_KEY] || {};
  const defaults = defaultSettings();
  const autoSaveAI = raw.autoSaveAI ?? raw.autoSaveChatGPT ?? defaults.autoSaveAI;
  return {
    ...defaultSettings(),
    ...raw,
    autoSaveAI,
    autoSaveChatGPT: autoSaveAI,
  };
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
 */
async function saveEntriesWithLink(items) {
  const settings = await getSettings();
  for (const item of items) {
    const entry = await upsertEntry(item);
    if (isSunoEntrySource(entry.source)) {
      await autoLinkSunoEntry(entry, settings);
    } else if (isAiSource(entry.source)) {
      await autoLinkAiEntry(entry, settings);
    }
  }
}

/**
 * @param {Partial<import('../types.js').Entry>} data
 */
async function saveEntryWithLink(data) {
  const settings = await getSettings();
  const entry = await upsertEntry(data);
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
      title: '楽曲制作アーカイブ',
      message: `「${entry.title || '無題'}」に ${links.length} 件の関連を自動リンクしました`,
    });
  }

  return { entry, links };
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
    case 'saveEntry':
      return { success: true, ...(await saveEntryWithLink(request.data)) };
    case 'saveEntries': {
      await saveEntriesWithLink(request.data || []);
      return { success: true, count: (request.data || []).length };
    }
    case 'search':
      return { success: true, results: await searchEntries(request.options || {}) };
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
    console.info(
      '[music-archive] extension updated to',
      chrome.runtime.getManifest().version,
      '— reload open Suno/AI tabs if cleanup preview fails',
    );
  }

  chrome.contextMenus.create({
    id: 'save-suno-song',
    title: 'この Suno 曲を保存',
    contexts: ['page'],
    documentUrlPatterns: ['https://suno.com/song/*', 'https://*.suno.com/song/*'],
  });
  chrome.contextMenus.create({
    id: 'save-suno-list',
    title: 'このページの曲リストを保存',
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
    title: 'この AI 会話を保存',
    contexts: ['page'],
    documentUrlPatterns: [
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://copilot.microsoft.com/*',
      'https://copilot.com/*',
      'https://www.perplexity.ai/*',
      'https://perplexity.ai/*',
      'https://poe.com/*',
    ],
  });
  chrome.contextMenus.create({
    id: 'open-dashboard',
    title: 'アーカイブを検索',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === 'open-dashboard') {
    chrome.runtime.openOptionsPage();
    return;
  }

  const actionMap = {
    'save-suno-song': 'captureSunoSong',
    'save-suno-list': 'captureSunoList',
    'save-ai-chat': 'captureAI',
  };
  const action = actionMap[info.menuItemId];
  if (!action) return;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action });
    if (response?.data) {
      if (Array.isArray(response.data)) {
        await saveEntriesWithLink(response.data);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: '楽曲制作アーカイブ',
          message: `${response.data.length} 件を保存しました`,
        });
      } else {
        await saveEntryWithLink(response.data);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: '楽曲制作アーカイブ',
          message: '保存しました',
        });
      }
    }
  } catch (err) {
    console.error(err);
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
