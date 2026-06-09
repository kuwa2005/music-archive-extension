import { normalizeTitle } from './normalize.js';
import { titleSimilarity, lyricsSimilarity } from './similarity.js';
import { t } from './i18n.js';

/**
 * 類似ツリー分组の閾値（外部 API なし・ヒューリスティック）。
 *
 * アルゴリズム:
 * - 正規化タイトル: " by Artist"・括弧注釈除去後のベースタイトル比較 + 生タイトル fuzzy（titleSimilarity）
 * - 正規化歌詞の 3-gram Jaccard（lyricsSimilarity、両方に歌詞がある場合のみ）
 * - 上記いずれかが閾値以上のペアを Union-Find で連結し、2 件以上の連結成分を「類似グループ」とする
 *
 * 閾値は自動リンク（scorePair）よりやや緩め。タイトル 0.85 / 歌詞 0.75。
 * 計算量 O(n²)。数百件規模のアーカイブを想定。
 */

/** @type {number} タイトル類似度（0–1）がこの値以上なら同一クラスタ */
export const SIMILARITY_TITLE_THRESHOLD = 0.85;

/** @type {number} 歌詞類似度（0–1）がこの値以上なら同一クラスタ（両エントリに歌詞がある場合） */
export const SIMILARITY_LYRICS_THRESHOLD = 0.75;

/**
 * ツリー分组用: " by Artist" と括弧内注釈（リミックス等）を除いたベースタイトル。
 * @param {string} [title]
 * @returns {string}
 */
export function normalizeTitleForClustering(title) {
  let t = normalizeTitle(title || '');
  t = t.replace(/\s+by\s+.+$/i, '');
  t = t.replace(/[（(][^）)]*[）)]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * ベースタイトル同士の類似度（3-gram Jaccard / 部分一致）。
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function clusteringTitleSimilarity(a, b) {
  const baseA = normalizeTitleForClustering(a);
  const baseB = normalizeTitleForClustering(b);
  if (!baseA || !baseB) return 0;
  if (baseA === baseB) return 1;
  if (baseA.includes(baseB) || baseB.includes(baseA)) return 0.9;
  return lyricsSimilarity(baseA, baseB);
}

/**
 * 2 エントリ間の類似度（タイトル・歌詞）。
 * @param {import('../types.js').Entry} a
 * @param {import('../types.js').Entry} b
 * @returns {{ title: number, lyrics: number, score: number }}
 */
export function pairSimilarity(a, b) {
  const rawTitle = titleSimilarity(a.title || '', b.title || '');
  const baseTitle = clusteringTitleSimilarity(a.title || '', b.title || '');
  const title = Math.max(rawTitle, baseTitle);
  let lyrics = 0;
  if (a.lyrics?.trim() && b.lyrics?.trim()) {
    lyrics = lyricsSimilarity(a.lyrics, b.lyrics);
  }
  return { title, lyrics, score: Math.max(title, lyrics) };
}

/**
 * 2 エントリが類似クラスタに含めるべきか。
 * @param {import('../types.js').Entry} a
 * @param {import('../types.js').Entry} b
 * @returns {boolean}
 */
export function pairsAreSimilar(a, b) {
  const { title, lyrics } = pairSimilarity(a, b);
  if (title >= SIMILARITY_TITLE_THRESHOLD) return true;
  if (lyrics >= SIMILARITY_LYRICS_THRESHOLD) return true;
  return false;
}

/**
 * Union-Find で類似ペアをクラスタリング。
 * @param {import('../types.js').Entry[]} entries
 * @returns {Map<string, Set<string>>} rootId → member entry ids（単独も含む）
 */
export function buildSimilarityClusters(entries) {
  /** @type {Map<string, string>} */
  const parent = new Map();
  const ids = entries.map((e) => e.id);

  /** @param {string} id */
  function find(id) {
    let root = id;
    while (parent.has(root) && parent.get(root) !== root) {
      root = /** @type {string} */ (parent.get(root));
    }
    /** @param {string} node */
    function compress(node) {
      const p = parent.get(node);
      if (p && p !== node) parent.set(node, find(p));
    }
    compress(id);
    return root;
  }

  /** @param {string} a @param {string} b */
  function unite(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const id of ids) parent.set(id, id);

  /** @type {Map<string, import('../types.js').Entry>} */
  const byId = new Map(entries.map((e) => [e.id, e]));

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      if (pairsAreSimilar(a, b)) {
        unite(a.id, b.id);
      }
    }
  }

  /** @type {Map<string, Set<string>>} */
  const clusters = new Map();
  for (const id of ids) {
    const root = find(id);
    if (!clusters.has(root)) clusters.set(root, new Set());
    clusters.get(root)?.add(id);
  }
  return clusters;
}

/**
 * 類似クラスタの表示ラベル（最新 capturedAt のタイトルを短縮）。
 * @param {import('../types.js').Entry[]} clusterEntries
 * @returns {string}
 */
export function similarityClusterLabel(clusterEntries) {
  const sorted = [...clusterEntries].sort((a, b) =>
    (b.capturedAt || '').localeCompare(a.capturedAt || ''),
  );
  const title = sorted[0]?.title?.trim();
  if (!title) return t('similarClusterCount', clusterEntries.length);
  const short = title.length > 40 ? `${title.slice(0, 38)}…` : title;
  return t('similarClusterTitle', short, clusterEntries.length);
}
