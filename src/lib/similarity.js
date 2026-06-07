import { normalizeLyrics, normalizeTitle } from './normalize.js';

/**
 * @param {string} a
 * @param {string} b
 * @param {number} n
 * @returns {Set<string>}
 */
function ngrams(text, n = 3) {
  const set = new Set();
  if (text.length < n) {
    if (text) set.add(text);
    return set;
  }
  for (let i = 0; i <= text.length - n; i += 1) {
    set.add(text.slice(i, i + n));
  }
  return set;
}

/**
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {number}
 */
function jaccard(a, b) {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} 0-1
 */
export function lyricsSimilarity(a, b) {
  const na = normalizeLyrics(a);
  const nb = normalizeLyrics(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length);
    const longer = Math.max(na.length, nb.length);
    return Math.max(0.85, shorter / longer);
  }
  const gramsA = ngrams(na, 3);
  const gramsB = ngrams(nb, 3);
  return jaccard(gramsA, gramsB);
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} 0-1
 */
export function titleSimilarity(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  return lyricsSimilarity(na, nb);
}

/**
 * @param {import('../types.js').Entry} suno
 * @param {import('../types.js').Entry} chatgpt
 * @returns {{ score: number, linkType: 'auto_lyrics' | 'auto_title' | null }}
 */
export function scorePair(suno, chatgpt) {
  const titleScore = titleSimilarity(suno.title || '', chatgpt.title || '');
  if (titleScore >= 0.95) {
    return { score: titleScore, linkType: 'auto_title' };
  }
  const lyricScore = lyricsSimilarity(suno.lyrics || '', chatgpt.lyrics || '');
  if (lyricScore >= 0.75) {
    return { score: lyricScore, linkType: 'auto_lyrics' };
  }
  return { score: Math.max(titleScore, lyricScore), linkType: null };
}

/**
 * @param {string} haystack
 * @param {string} needle
 * @returns {boolean}
 */
export function matchesQuery(haystack, needle) {
  if (!needle) return true;
  const h = (haystack || '').toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return true;
  return h.includes(n);
}
