/**
 * Suno 曲ページの生成日時抽出デバッグ（node scripts/test-suno-date.mjs [fixture.html] [clipId]）
 */
import { readFileSync, existsSync } from 'fs';
import { parseHTML } from 'linkedom';
import {
  extractSunoCreatedAtFromDom,
  extractDateFromScope,
  extractCreatedAtFromPageState,
  findSongHeroRoot,
  parseJapaneseDateTimeToIso,
  extractCreatedAtFromText,
  JAPANESE_DATETIME_RE,
  fetchSunoClipCreatedAt,
} from '../src/lib/suno-selectors.js';

const fixturePath =
  process.argv[2] || new URL('../fixtures/song-a4ed4df5.html', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const clipId = process.argv[3] || 'a4ed4df5-16b1-41e4-88f4-df0f14996aec';

function walkTextNodes(root, max = 50) {
  const hits = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  let n;
  while ((n = walker.nextNode()) && hits.length < max) {
    const t = (n.textContent || '').trim();
    if (!t) continue;
    if (JAPANESE_DATETIME_RE.test(t) || /created|Custom|GMT|ago/i.test(t)) {
      hits.push({
        text: t.slice(0, 80),
        parent: n.parentElement?.tagName,
        className: (n.parentElement?.className || '').slice(0, 120),
      });
    }
  }
  return hits;
}

async function main() {
  if (!existsSync(fixturePath)) {
    console.error('Fixture not found:', fixturePath);
    process.exit(1);
  }

  const html = readFileSync(fixturePath, 'utf8');
  console.log('=== Fixture ===');
  console.log('path:', fixturePath);
  console.log('bytes:', html.length);

  const checks = [
    'created_at',
    '2026年',
    'Custom',
    '映らない',
    'KURAGASHI',
    'foreground-secondary',
    'Add to Playlist',
    clipId,
    '__NEXT_DATA__',
  ];
  for (const p of checks) console.log(`  contains ${p}:`, html.includes(p));

  const jaInHtml = html.match(JAPANESE_DATETIME_RE);
  console.log('  JA regex in raw HTML:', jaInHtml?.[0] || '(none)');

  const createdMatches = [...html.matchAll(/"created_at"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
  const escapedMatches = [...html.matchAll(/\\"created_at\\":\\"([^"\\]+)\\"/g)].map((m) => m[1]);
  console.log('  created_at (plain):', createdMatches.length, createdMatches.slice(0, 3));
  console.log('  created_at (escaped):', escapedMatches.length, escapedMatches.slice(0, 3));

  const { document } = parseHTML(html);
  const hero = findSongHeroRoot(document);
  console.log('\n=== DOM extraction ===');
  console.log('hero root:', hero?.tagName, (hero?.className || '').slice(0, 80));

  const fromHero = hero ? extractDateFromScope(hero) : null;
  const fromState = extractCreatedAtFromPageState(document, clipId);
  const fromDoc = extractSunoCreatedAtFromDom(document, clipId);
  console.log('extractDateFromScope(hero):', fromHero);
  console.log('extractCreatedAtFromPageState:', fromState);
  console.log('extractSunoCreatedAtFromDom:', fromDoc);

  if (hero) {
    console.log('\n=== Hero text nodes (date-related) ===');
    for (const hit of walkTextNodes(hero)) {
      console.log(' -', hit);
    }
  }

  const scriptHits = [];
  for (const script of document.querySelectorAll('script')) {
    const fromScript = extractCreatedAtFromText(script.textContent || '', clipId);
    if (fromScript) scriptHits.push(fromScript);
  }
  console.log('\n=== Script created_at ===', scriptHits.slice(0, 5));

  const expected = '2026-05-10T03:10:49.430Z';
  if (fromDoc !== expected) {
    console.error('\nFAIL: expected', expected, 'got', fromDoc);
    process.exitCode = 1;
  } else {
    console.log('\nOK: fixture extraction matches embedded created_at');
  }

  console.log('\n=== API fallback ===');
  const apiIso = await fetchSunoClipCreatedAt(clipId);
  console.log('fetchSunoClipCreatedAt:', apiIso);

  const sample = '2026年5月10日 12:10';
  console.log('\n=== Parser sanity ===');
  console.log(sample, '→', parseJapaneseDateTimeToIso(sample));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
