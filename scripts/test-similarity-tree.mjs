/**
 * ツリー表示モードのユニットテスト（node scripts/test-similarity-tree.mjs）
 */
import {
  pairSimilarity,
  pairsAreSimilar,
  buildSimilarityClusters,
  SIMILARITY_TITLE_THRESHOLD,
  SIMILARITY_LYRICS_THRESHOLD,
} from '../src/lib/similarity-clusters.js';
import {
  buildLinkTreeGroups,
  normalizeViewMode,
} from '../src/lib/result-view-mode.js';

/** @param {string} msg */
function assert(msg, cond) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
}

/** @type {import('../src/types.js').Entry[]} */
const entries = [
  {
    id: 'a1',
    source: 'suno_song',
    title: 'ほぼ全九州 by KURAGASHI',
    lyrics: '九州の風が吹く',
    capturedAt: '2026-06-01T10:00:00Z',
    sourceUrl: '',
  },
  {
    id: 'a2',
    source: 'suno_song',
    title: 'ほぼ全九州（リミックス） by KURAGASHI',
    lyrics: '九州の風が吹く',
    capturedAt: '2026-06-02T10:00:00Z',
    sourceUrl: '',
  },
  {
    id: 'b1',
    source: 'chatgpt',
    title: 'ほぼ全九州',
    lyrics: '九州の風が吹く朝の光',
    gptName: 'LyricGPT',
    capturedAt: '2026-05-30T10:00:00Z',
    sourceUrl: '',
  },
  {
    id: 'solo',
    source: 'suno_song',
    title: 'まったく別の曲 by Other',
    lyrics: '全然違う歌詞コンテンツ',
    capturedAt: '2026-06-03T10:00:00Z',
    sourceUrl: '',
  },
];

const { title: t12 } = pairSimilarity(entries[0], entries[1]);
assert(`類似タイトル a1↔a2 score=${t12} >= ${SIMILARITY_TITLE_THRESHOLD}`, t12 >= SIMILARITY_TITLE_THRESHOLD);
assert('a1↔a2 は類似ペア', pairsAreSimilar(entries[0], entries[1]));

const { lyrics: l13 } = pairSimilarity(entries[0], entries[2]);
assert(`歌詞 a1↔b1 score=${l13} >= ${SIMILARITY_LYRICS_THRESHOLD}`, l13 >= SIMILARITY_LYRICS_THRESHOLD);
assert('a1↔b1 は類似ペア', pairsAreSimilar(entries[0], entries[2]));

assert('solo↔a1 は非類似', !pairsAreSimilar(entries[3], entries[0]));

const clusters = buildSimilarityClusters(entries);
let multiCluster = 0;
for (const members of clusters.values()) {
  if (members.size >= 2) multiCluster += 1;
}
assert('3 件クラスタは 1 つ（a1,a2,b1 が連結）', multiCluster === 1);

assert('旧 tree は tree-links へ移行', normalizeViewMode('tree') === 'tree-links');
assert('廃止 tree-similarity は tree-links へ移行', normalizeViewMode('tree-similarity') === 'tree-links');

const linkTree = buildLinkTreeGroups(entries, []);
const unlinkedOnly = linkTree.find((g) => g.id === 'unlinked-root');
assert('リンクツリー（リンクなし）: 全件が未リンク', unlinkedOnly?.entries?.length === 4);
assert('リンクツリー（リンクなし）: 類似クラスタ root なし', !linkTree.some((g) => g.id.startsWith('sim-')));
assert('リンクツリー: 類似 root なし', !linkTree.some((g) => g.id === 'similarity-root'));
assert('リンクツリー: Suno root なし', !linkTree.some((g) => g.id === 'suno-root'));

const linkedIds = new Set(['a1', 'b1']);
const linkedTree = buildLinkTreeGroups(entries, linkedIds);
const linkedCluster = linkedTree.find((g) => g.id.startsWith('sim-'));
const unlinkedSection = linkedTree.find((g) => g.id === 'unlinked-root');

assert('リンクツリー: リンク済みは類似クラスタ表示', linkedCluster?.entries?.length === 2);
assert(
  'リンクツリー: リンク済みクラスタに a1,b1',
  Boolean(
    linkedCluster?.entries?.some((e) => e.id === 'a1') &&
      linkedCluster?.entries?.some((e) => e.id === 'b1'),
  ),
);
assert('リンクツリー: 未リンクに a2 と solo', unlinkedSection?.entries?.length === 2);
assert(
  'リンクツリー: 未リンクに a2,solo',
  Boolean(
    unlinkedSection?.entries?.some((e) => e.id === 'a2') &&
      unlinkedSection?.entries?.some((e) => e.id === 'solo'),
  ),
);
assert('リンクツリー: リンク済みが未リンクに混ざらない', !unlinkedSection?.entries?.some((e) => linkedIds.has(e.id)));
assert('リンクツリー: 旧 link-root なし', !linkedTree.some((g) => g.id === 'link-root'));

// linkedIds（search API）と links 配列の整合: ID 集合で渡せば正しく分類
const linkedFromLinks = new Set(['a1', 'b1']);
assert(
  'linkedIds 渡しで a1 が未リンクに入らない',
  !buildLinkTreeGroups(entries, linkedFromLinks)
    .find((g) => g.id === 'unlinked-root')
    ?.entries?.some((e) => e.id === 'a1'),
);

console.log('\nAll similarity-tree tests passed.');
