/**
 * インスト曲フィクスチャでの capture 抽出テスト
 * node scripts/test-instrumental-capture.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { parseHTML } from 'linkedom';
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
} from '../src/lib/suno-selectors.js';
import { extractLyricsFromPageText, looksLikeEmbeddedPageState } from '../src/lib/normalize.js';

const fixturePath = 'fixtures/song-209a2851-instrumental-fetch.html';
const clipId = '209a2851-497e-4570-ac3c-cdbf3b4ff6cf';
const CAPTURE_CREATED_AT_OPTIONS = { attempts: 5, intervalMs: 10 };

if (!existsSync(fixturePath)) {
  console.error('Missing fixture:', fixturePath);
  process.exit(1);
}

const html = readFileSync(fixturePath, 'utf8');
const { document, window } = parseHTML(html);
window.location = { href: `https://suno.com/song/${clipId}` };

async function extractSunoSongData() {
  const sourceUrl = window.location.href.split('?')[0].split('#')[0];
  const parsedClipId = parseClipIdFromUrl(sourceUrl);
  const clipMeta = extractClipFieldsFromPageState(document, parsedClipId);

  let sunoCreatedAt = await waitForSunoCreatedAt(document, parsedClipId, CAPTURE_CREATED_AT_OPTIONS);
  if (hasLyricsTab(document)) {
    await clickLyricsTab(document);
    await sleep(10);
  }

  let title = pickLongestText(document, TITLE_SELECTORS);
  if (!title) title = document.title.replace(/\s*\|\s*Suno\s*$/i, '').trim();
  title = normalizeSunoSongTitle(title);

  let lyrics = '';
  if (!clipMeta.makeInstrumental) {
    lyrics = pickLongestText(document, LYRICS_SELECTORS);
    if (!lyrics || lyrics.length < 20) {
      const fromBody = extractLyricsFromPageText(document.body?.innerText || '', title);
      if (fromBody.lyrics.length > lyrics.length) lyrics = fromBody.lyrics;
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
  if (!stylePrompt && clipMeta.styleTags) stylePrompt = clipMeta.styleTags;

  if (!sunoCreatedAt) sunoCreatedAt = extractSunoCreatedAtFromDom(document, parsedClipId);

  return {
    source: 'suno_song',
    title,
    lyrics: (lyrics || '').trim(),
    stylePrompt: (stylePrompt || '').trim(),
    clipId: parsedClipId,
    sunoCreatedAt: sunoCreatedAt || undefined,
  };
}

const clipMeta = extractClipFieldsFromPageState(document, clipId);
console.log('clipMeta:', clipMeta);
console.log('hasLyricsTab:', hasLyricsTab(document));

const data = await extractSunoSongData();
console.log('extracted:', data);

let failed = 0;
if (!clipMeta.makeInstrumental) {
  console.error('FAIL: makeInstrumental should be true');
  failed += 1;
}
if (!data.title.includes('Labyrinth')) {
  console.error('FAIL: title missing song name:', data.title);
  failed += 1;
}
if (data.title.includes(' by DeVvYnPM')) {
  console.error('FAIL: title still has artist suffix:', data.title);
  failed += 1;
}
if (looksLikeEmbeddedPageState(data.lyrics)) {
  console.error('FAIL: lyrics still looks like embedded JSON');
  failed += 1;
}
if (!data.stylePrompt) {
  console.error('FAIL: stylePrompt empty for instrumental');
  failed += 1;
}
if (!data.sunoCreatedAt) {
  console.error('FAIL: sunoCreatedAt missing');
  failed += 1;
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll instrumental capture checks passed.');
