import {
  TITLE_SELECTORS,
  LYRICS_SELECTORS,
  parseClipIdFromUrl,
  pickLongestText,
  extractStyleFromRoot,
  clickLyricsTab,
  hasLyricsTab,
  extractClipFieldsFromPageState,
  normalizeSunoSongTitle,
  sleep,
  waitForSunoCreatedAt,
  extractSunoCreatedAtFromDom,
  fetchSunoClipCreatedAt,
} from '../lib/suno-selectors.js';
import { extractLyricsFromPageText, looksLikeEmbeddedPageState } from '../lib/normalize.js';
import { debugWarn, debugError } from '../lib/debug.js';

/** ポップアップ保存時は短め（詳細は ensureSunoCreatedAt / getSunoCreatedAt に委譲） */
const CAPTURE_CREATED_AT_OPTIONS = { attempts: 5, intervalMs: 100 };

/**
 * @returns {Promise<Partial<import('../types.js').Entry>>}
 */
async function extractSunoSongData() {
  const sourceUrl = window.location.href.split('?')[0].split('#')[0];
  const clipId = parseClipIdFromUrl(sourceUrl);
  const clipMeta = extractClipFieldsFromPageState(document, clipId);

  // 歌詞タブ切替でヒーロー付近の日時 DOM が消えることがあるため、先に取得する
  let sunoCreatedAt = await waitForSunoCreatedAt(document, clipId, CAPTURE_CREATED_AT_OPTIONS);
  if (!sunoCreatedAt && clipId) {
    sunoCreatedAt = await fetchSunoClipCreatedAt(clipId);
  }

  if (hasLyricsTab(document)) {
    await clickLyricsTab(document);
    await sleep(300);
  }

  let title = pickLongestText(document, TITLE_SELECTORS);
  if (!title) {
    title = document.title.replace(/\s*\|\s*Suno\s*$/i, '').trim();
  }
  title = normalizeSunoSongTitle(title);

  let lyrics = '';
  if (!clipMeta.makeInstrumental) {
    lyrics = pickLongestText(document, LYRICS_SELECTORS);
    if (!lyrics || lyrics.length < 20) {
      const fromBody = extractLyricsFromPageText(document.body?.innerText || '', title);
      if (fromBody.lyrics.length > lyrics.length) {
        lyrics = fromBody.lyrics;
        if (!title && fromBody.title) title = normalizeSunoSongTitle(fromBody.title);
      }
    }
  } else {
    lyrics = clipMeta.prompt || '';
  }

  if (looksLikeEmbeddedPageState(lyrics)) {
    lyrics = clipMeta.makeInstrumental ? clipMeta.prompt || '' : '';
  }

  let stylePrompt = extractStyleFromRoot(document.body);
  if (!stylePrompt) {
    stylePrompt = pickLongestText(document, ['div[title]', 'a[href^="/style/"]']);
  }
  if (!stylePrompt && clipMeta.styleTags) {
    stylePrompt = clipMeta.styleTags;
  }

  if (!sunoCreatedAt) {
    sunoCreatedAt = extractSunoCreatedAtFromDom(document, clipId);
    if (!sunoCreatedAt && clipId) {
      sunoCreatedAt = await fetchSunoClipCreatedAt(clipId);
    }
  }

  return {
    source: 'suno_song',
    title,
    lyrics: (lyrics || '').trim(),
    stylePrompt: (stylePrompt || '').trim(),
    sourceUrl,
    clipId: clipId || undefined,
    sunoCreatedAt: sunoCreatedAt || undefined,
    capturedAt: new Date().toISOString(),
  };
}

if (globalThis.__maSunoSongListenerRegistered) {
  debugWarn('suno-song content script already registered (reload the page after extension update)');
} else {
  globalThis.__maSunoSongListenerRegistered = true;

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?._target === 'background') return false;
  if (request.action === 'getSunoCreatedAt') {
    (async () => {
      try {
        const clipId = parseClipIdFromUrl(window.location.href.split('?')[0].split('#')[0]);
        const sunoCreatedAt = await waitForSunoCreatedAt(document, clipId, {
          attempts: 40,
          intervalMs: 150,
        });
        sendResponse({ success: true, sunoCreatedAt: sunoCreatedAt || undefined });
      } catch (err) {
        debugError('getSunoCreatedAt failed', err);
        sendResponse({ success: false, error: String(err) });
      }
    })();
    return true;
  }
  if (request.action !== 'captureSunoSong') return false;
  (async () => {
    try {
      sendResponse({ success: true, data: await extractSunoSongData() });
    } catch (err) {
      debugError('captureSunoSong failed', err);
      sendResponse({ success: false, error: String(err) });
    }
  })();
  return true;
});
}
