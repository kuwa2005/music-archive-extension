/**
 * Suno 曲ページの日本語日時抽出の簡易検証（node scripts/_tmp-parse-song-date.mjs）
 */
import { parseHTML } from 'linkedom';
import {
  parseJapaneseDateTimeToIso,
  extractDateFromScope,
  extractSunoCreatedAtFromDom,
  JAPANESE_DATETIME_RE,
} from '../src/lib/suno-selectors.js';

const SONG_FIXTURE = `
<main>
  <section data-testid="song-page">
    <h1>Test Song</h1>
    <div class="flex items-center gap-2">
      <a href="/style/pop">pop</a>
      <a href="/style/rock">rock</a>
    </div>
    <div class="flex items-center gap-2 mt-2">
      <p class="text-xs text-foreground-secondary">2026年5月10日 12:10</p>
      <span class="rounded px-2 text-xs bg-pink-500">Custom</span>
    </div>
    <button title="Add to Playlist">Add</button>
  </section>
</main>
`;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', msg);
}

// パーサー単体
assert(JAPANESE_DATETIME_RE.test('2026年5月10日 12:10'), 'regex matches Japanese datetime');
const parsed = parseJapaneseDateTimeToIso('2026年5月10日 12:10');
assert(parsed && !Number.isNaN(new Date(parsed).getTime()), `parseJapaneseDateTimeToIso → ${parsed}`);
assert(parseJapaneseDateTimeToIso('4 hours ago') === null, 'relative text rejected');
assert(parseJapaneseDateTimeToIso('') === null, 'empty rejected');

// DOM フィクスチャ
const { document } = parseHTML(SONG_FIXTURE);
const hero = document.querySelector('main');
const fromScope = extractDateFromScope(hero);
assert(fromScope === parsed, `extractDateFromScope matches parser (${fromScope})`);

const fromDoc = extractSunoCreatedAtFromDom(document);
assert(fromDoc === parsed, `extractSunoCreatedAtFromDom matches parser (${fromDoc})`);

if (process.exitCode) {
  console.error('\nSome checks failed.');
  process.exit(process.exitCode);
}
console.log('\nAll checks passed.');
