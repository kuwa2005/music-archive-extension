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

/** Suno が `title` に入れる GMT 日時（例: Fri, 05 Sep 2025 20:37:45 GMT） */
const GMT_TITLE_RE = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), /;

/** 相対日付テキスト（例: 4 hours ago） */
const RELATIVE_AGO_RE = /\bago\b/i;

const SUNO_CLIP_API = 'https://studio-api.prod.suno.com/api/clips';

/**
 * @param {string} [title]
 * @returns {string|null} ISO 8601
 */
export function parseGmtTitleToIso(title) {
  if (!title || !GMT_TITLE_RE.test(title)) return null;
  const d = new Date(title);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * @param {Document} doc
 * @returns {Element|null}
 */
export function findSongHeroRoot(doc) {
  const addBtn = doc.querySelector('button[title="Add to Playlist"]');
  if (addBtn) {
    return (
      addBtn.closest('main') ||
      addBtn.closest('article') ||
      addBtn.closest('section') ||
      addBtn.closest('[data-testid="song-page"]') ||
      addBtn.parentElement?.parentElement?.parentElement ||
      null
    );
  }
  const h1 = doc.querySelector('h1, [data-testid="song-title"]');
  if (h1) {
    return h1.closest('main') || h1.closest('article') || h1.parentElement?.parentElement || null;
  }
  return doc.querySelector('main, [role="main"]');
}

/**
 * @param {Element} root
 * @returns {string|null} ISO 8601
 */
export function extractDateFromScope(root) {
  if (!root) return null;

  for (const timeEl of root.querySelectorAll('time[datetime]')) {
    const iso = timeEl.getAttribute('datetime');
    if (iso && !Number.isNaN(new Date(iso).getTime())) {
      return new Date(iso).toISOString();
    }
  }

  const dateSelectors = [
    'p.text-xs.text-foreground-secondary[title]',
    'p[class*="text-xs"][class*="foreground-secondary"][title]',
    'span.text-xs.text-foreground-secondary[title]',
    '[title*="GMT"]',
  ];

  for (const sel of dateSelectors) {
    for (const el of root.querySelectorAll(sel)) {
      const title = el.getAttribute('title') || '';
      const text = (el.textContent || '').trim();
      const parsed = parseGmtTitleToIso(title);
      if (parsed && (RELATIVE_AGO_RE.test(text) || !text)) {
        return parsed;
      }
    }
  }

  for (const el of root.querySelectorAll('span, p, div, dt')) {
    const label = (el.textContent || '').trim();
    if (!/^Created$/i.test(label) && !/^作成/.test(label)) continue;
    const nearby =
      el.nextElementSibling ||
      el.parentElement?.querySelector('[title*="GMT"], time[datetime]');
    if (!nearby) continue;
    const fromTitle = parseGmtTitleToIso(nearby.getAttribute('title') || '');
    if (fromTitle) return fromTitle;
    const dt = nearby.getAttribute('datetime');
    if (dt && !Number.isNaN(new Date(dt).getTime())) {
      return new Date(dt).toISOString();
    }
  }

  return null;
}

/**
 * @param {string} text
 * @returns {string|null} ISO 8601
 */
export function extractCreatedAtFromText(text) {
  if (!text) return null;
  const m = text.match(/"created_at"\s*:\s*"([^"]+)"/);
  if (!m) return null;
  const d = new Date(m[1]);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * DOM から Suno 曲の生成日時を抽出する。
 * 曲ページのヒーロー付近 → main → ページ内 JSON の順。取得不可時は null。
 * @param {Document} doc
 * @returns {string|null} ISO 8601
 */
export function extractSunoCreatedAtFromDom(doc) {
  const scopes = [
    findSongHeroRoot(doc),
    doc.querySelector('main'),
    doc.querySelector('[role="main"]'),
  ].filter(Boolean);

  const seen = new Set();
  for (const scope of scopes) {
    if (seen.has(scope)) continue;
    seen.add(scope);
    const found = extractDateFromScope(scope);
    if (found) return found;
  }

  for (const script of doc.querySelectorAll('script')) {
    const fromScript = extractCreatedAtFromText(script.textContent || '');
    if (fromScript) return fromScript;
  }

  return extractCreatedAtFromText(doc.body?.innerHTML || '');
}

/**
 * Suno 公開 API から clip の created_at を取得（DOM に日時が無い場合のフォールバック）。
 * @param {string} clipId
 * @returns {Promise<string|null>} ISO 8601
 */
export async function fetchSunoClipCreatedAt(clipId) {
  if (!clipId) return null;
  try {
    const res = await fetch(`${SUNO_CLIP_API}/${clipId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.created_at;
    if (!raw || Number.isNaN(new Date(raw).getTime())) return null;
    return new Date(raw).toISOString();
  } catch {
    return null;
  }
}

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
