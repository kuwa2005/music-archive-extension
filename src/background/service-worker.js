import { defaultSettings } from '../types.js';
import { upsertEntry, searchEntries, getLinkedEntries, upsertLink, deleteLink, exportAll, importAll, countEntries, deleteEntry, getEntry } from '../db/repository.js';
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

chrome.runtime.onInstalled.addListener(() => {
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

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'getSettings':
          sendResponse({ success: true, settings: await getSettings() });
          break;
        case 'saveSettings':
          await saveSettings(request.settings || {});
          sendResponse({ success: true, settings: await getSettings() });
          break;
        case 'saveEntry':
          sendResponse({ success: true, ...(await saveEntryWithLink(request.data)) });
          break;
        case 'saveEntries': {
          await saveEntriesWithLink(request.data || []);
          sendResponse({ success: true, count: (request.data || []).length });
          break;
        }
        case 'search':
          sendResponse({ success: true, results: await searchEntries(request.options || {}) });
          break;
        case 'getLinked':
          sendResponse({ success: true, ...(await getLinkedEntries(request.entryId)) });
          break;
        case 'createLink':
          sendResponse({
            success: true,
            link: await upsertLink({
              chatgptEntryId: request.chatgptEntryId,
              sunoEntryId: request.sunoEntryId,
              linkType: 'manual',
              score: 1,
            }),
          });
          break;
        case 'deleteLink':
          await deleteLink(request.linkId);
          sendResponse({ success: true });
          break;
        case 'deleteEntry':
          await deleteEntry(request.entryId);
          sendResponse({ success: true });
          break;
        case 'getEntry':
          sendResponse({ success: true, entry: await getEntry(request.entryId) });
          break;
        case 'exportAll':
          sendResponse({ success: true, data: await exportAll() });
          break;
        case 'importAll':
          sendResponse({ success: true, ...(await importAll(request.data || {})) });
          break;
        case 'countEntries':
          sendResponse({ success: true, count: await countEntries() });
          break;
        default:
          sendResponse({ success: false, error: 'unknown action' });
      }
    } catch (err) {
      sendResponse({ success: false, error: String(err) });
    }
  })();
  return true;
});
