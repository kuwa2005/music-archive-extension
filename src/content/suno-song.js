import {
  TITLE_SELECTORS,
  LYRICS_SELECTORS,
  parseClipIdFromUrl,
  pickLongestText,
  extractStyleFromRoot,
  clickLyricsTab,
  sleep,
} from '../lib/suno-selectors.js';
import { extractLyricsFromPageText } from '../lib/normalize.js';

/**
 * @returns {Promise<Partial<import('../types.js').Entry>>}
 */
async function extractSunoSongData() {
  const sourceUrl = window.location.href.split('?')[0].split('#')[0];
  const clipId = parseClipIdFromUrl(sourceUrl);

  await clickLyricsTab(document);
  await sleep(300);

  let title = pickLongestText(document, TITLE_SELECTORS);
  if (!title) {
    title = document.title.replace(/\s*\|\s*Suno\s*$/i, '').trim();
  }

  let lyrics = pickLongestText(document, LYRICS_SELECTORS);
  if (!lyrics || lyrics.length < 20) {
    const fromBody = extractLyricsFromPageText(document.body?.innerText || '', title);
    if (fromBody.lyrics.length > lyrics.length) {
      lyrics = fromBody.lyrics;
      if (!title && fromBody.title) title = fromBody.title;
    }
  }

  let stylePrompt = extractStyleFromRoot(document.body);
  if (!stylePrompt) {
    stylePrompt = pickLongestText(document, ['div[title]', 'a[href^="/style/"]']);
  }

  return {
    source: 'suno_song',
    title: title.replace(/^★\s*/, '').trim(),
    lyrics: lyrics.trim(),
    stylePrompt: stylePrompt.trim(),
    sourceUrl,
    clipId: clipId || undefined,
    capturedAt: new Date().toISOString(),
  };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?._target === 'background') return false;
  if (request.action !== 'captureSunoSong') return false;
  (async () => {
    sendResponse({ success: true, data: await extractSunoSongData() });
  })();
  return true;
});
