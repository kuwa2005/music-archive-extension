import { looksLikeLyrics, extractLyricsFromPageText } from './normalize.js';

/**
 * @param {string[]} selectors
 * @returns {HTMLElement[]}
 */
export function collectAssistantBlocks(selectors) {
  const blocks = [];
  const seen = new Set();

  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((el) => {
      const node = el.closest('article, [class*="turn"], [class*="message"]') || el;
      if (!seen.has(node)) {
        seen.add(node);
        blocks.push(/** @type {HTMLElement} */ (node));
      }
    });
  }

  if (blocks.length) return blocks;

  document.querySelectorAll('div.markdown, .markdown.prose, .prose').forEach((el) => {
    const turn = el.closest('article, [class*="turn"], [class*="message"]') || el;
    if (!seen.has(turn)) {
      seen.add(turn);
      blocks.push(/** @type {HTMLElement} */ (turn));
    }
  });
  return blocks;
}

/**
 * @param {HTMLElement} block
 * @returns {string}
 */
export function blockText(block) {
  return (block.innerText || block.textContent || '').trim();
}

/**
 * @param {string[]} assistantSelectors
 * @param {string} titleHint
 * @returns {string}
 */
export function pickBestLyrics(assistantSelectors, titleHint = '') {
  const blocks = collectAssistantBlocks(assistantSelectors);
  let best = '';

  for (const block of blocks) {
    const text = blockText(block);
    if (looksLikeLyrics(text) && text.length > best.length) {
      best = text;
    }
  }
  if (best) return best;

  for (const block of blocks) {
    const text = blockText(block);
    if (text.length > best.length) best = text;
  }

  if (!best || best.length < 20) {
    const parsed = extractLyricsFromPageText(document.body?.innerText || '', titleHint);
    if (parsed.lyrics.length > best.length) best = parsed.lyrics;
  }

  return best;
}

/**
 * @param {RegExp[]} patterns
 * @returns {string|null}
 */
export function parseIdFromUrl(patterns) {
  for (const re of patterns) {
    const m = window.location.pathname.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * @param {string[]} titleSuffixes
 * @param {string} fallback
 * @returns {string}
 */
export function titleFromDocument(titleSuffixes, fallback) {
  let title = document.title.trim();
  for (const suffix of titleSuffixes) {
    title = title.replace(suffix, '').trim();
  }
  if (title && title.length > 1) return title;
  const h1 = document.querySelector('h1');
  if (h1?.textContent?.trim()) return h1.textContent.trim();
  return fallback;
}
