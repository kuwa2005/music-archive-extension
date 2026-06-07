/** Suno DOM セレクタ集（suno-download-cli / SunoExtension 由来） */

export const TITLE_SELECTORS = ['h1', '[data-testid="song-title"]', '.song-title'];

export const LYRICS_SELECTORS = [
  '[data-testid="lyrics"]',
  'textarea',
  'p.whitespace-pre-wrap',
  '.lyrics',
  '[class*="lyric"]',
  'pre',
];

export const STYLE_SELECTORS = [
  '[data-testid="style-prompt"]',
  'div[class*="ingj1g"]',
  'div[class*="emi8w7v14"]',
  '.style-prompt',
  '[class*="style"]',
  'a[href^="/style/"]',
];

export const LYRICS_TAB_NAMES = [/^Lyrics$/i, /^歌詞$/i];

/**
 * @param {string} url
 * @returns {string|null}
 */
export function parseClipIdFromUrl(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/song\/([a-f0-9-]{36})/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * @param {Document} doc
 * @param {string[]} selectors
 * @returns {string}
 */
export function pickLongestText(doc, selectors) {
  let best = '';
  for (const sel of selectors) {
    doc.querySelectorAll(sel).forEach((el) => {
      const t = (el.textContent || el.value || '').trim();
      if (t.length > best.length) best = t;
    });
  }
  return best;
}

/**
 * @param {Element} root
 * @returns {string}
 */
export function extractStyleFromRoot(root) {
  let best = '';
  root.querySelectorAll('div[title]').forEach((div) => {
    const t = div.getAttribute('title') || '';
    if (t.length > best.length && t.includes(',')) best = t;
  });
  if (best) return best;

  const parts = [];
  root.querySelectorAll('a[href^="/style/"]').forEach((a) => {
    const t = a.textContent.trim();
    if (t) parts.push(t);
  });
  if (parts.length) return parts.join(', ');

  for (const sel of STYLE_SELECTORS) {
    const el = root.querySelector(sel);
    if (el) {
      const t = el.textContent.trim();
      if (t.length > best.length) best = t;
    }
  }
  return best;
}

/**
 * @param {Document} doc
 * @returns {Promise<void>}
 */
export async function clickLyricsTab(doc) {
  const buttons = doc.querySelectorAll('[role="tab"], button');
  for (const btn of buttons) {
    const label = (btn.textContent || btn.getAttribute('aria-label') || '').trim();
    if (LYRICS_TAB_NAMES.some((re) => re.test(label))) {
      btn.click();
      await sleep(400);
      return;
    }
  }
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {string} pageUrl
 * @param {string} [pageTitle]
 * @returns {{ type: 'playlist' | 'workspace' | 'library' | 'unknown', label: string }}
 */
export function detectListContext(pageUrl, pageTitle = '') {
  try {
    const u = new URL(pageUrl);
    if (u.pathname.startsWith('/playlist/')) {
      return { type: 'playlist', label: `playlist:${u.pathname}` };
    }
    if (u.pathname.startsWith('/create')) {
      const wid = u.searchParams.get('wid') || '';
      const title = pageTitle.replace(/\s*\|\s*Suno\s*$/i, '').trim();
      const label = wid
        ? title && title !== 'Suno'
          ? `workspace:${wid}:${title}`
          : `workspace:${wid}`
        : title && title !== 'Suno'
          ? `workspace:${title}`
          : 'workspace';
      return { type: 'workspace', label };
    }
    if (u.pathname.startsWith('/me')) {
      return { type: 'library', label: 'library' };
    }
  } catch {
    /* ignore */
  }
  return { type: 'unknown', label: pageUrl };
}
