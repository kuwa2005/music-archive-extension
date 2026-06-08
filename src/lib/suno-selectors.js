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

/** 日本語ロケールの絶対日時（例: 2026年5月10日 12:10） */
export const JAPANESE_DATETIME_RE = /(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/;

/** 英語ロケール（例: April 11, 2026 at 7:01 AM） */
export const ENGLISH_DATE_HINT_RE = /[A-Za-z]{3,}.*\d{4}|\d{4}.*[A-Za-z]{3,}/;

const ENGLISH_MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** 2026 UI: Custom 付近の生成日時（text-sm / title 属性が最も安定） */
export const SUNO_JA_DATE_SELECTORS = [
  'span.text-sm.text-foreground-secondary[title*="年"]',
  'span[class*="text-sm"][class*="foreground-secondary"][title*="年"]',
  'p.text-sm.text-foreground-secondary[title*="年"]',
  'div.text-sm.text-foreground-secondary[title*="年"]',
  'span.text-sm.text-foreground-secondary',
  'span[class*="text-sm"][class*="foreground-secondary"]',
  'p.text-xs.text-foreground-secondary[title*="年"]',
  'span.text-xs.text-foreground-secondary[title*="年"]',
  'p.text-xs.text-foreground-secondary',
  'span.text-xs.text-foreground-secondary',
  'span.text-foreground-secondary[title*="年"]',
  'p.text-foreground-secondary[title*="年"]',
  'span.text-foreground-secondary',
  'p.text-foreground-secondary',
  'div.text-foreground-secondary',
];

const SUNO_CLIP_API = 'https://studio-api.prod.suno.com/api/clips';

/** RSC / 埋め込み JSON の created_at（プレーン・エスケープ両方） */
const CREATED_AT_JSON_RES = [
  /"created_at"\s*:\s*"([^"]+)"/g,
  /\\"created_at\\":\\"([^"\\]+)\\"/g,
];

/**
 * @param {Element|null} el
 * @param {number} [maxSteps]
 * @returns {Element|null}
 */
function climbAncestors(el, maxSteps = 8) {
  let node = el;
  for (let i = 0; i < maxSteps && node; i += 1) {
    node = node.parentElement;
    if (!node) break;
    const tag = node.tagName;
    if (
      tag === 'MAIN' ||
      tag === 'ARTICLE' ||
      tag === 'SECTION' ||
      node.getAttribute('role') === 'main' ||
      node.dataset?.testid === 'song-page'
    ) {
      return node;
    }
  }
  let fallback = el;
  for (let i = 0; i < 6 && fallback?.parentElement; i += 1) {
    fallback = fallback.parentElement;
  }
  return fallback;
}

/**
 * @param {string} text
 * @param {string} [clipId]
 * @returns {string|null} ISO 8601
 */
export function extractCreatedAtFromText(text, clipId) {
  if (!text || !text.includes('created_at')) return null;

  /** @type {string[]} */
  const regions = [];
  if (clipId && text.includes(clipId)) {
    const idx = text.indexOf(clipId);
    regions.push(text.slice(Math.max(0, idx - 1500), idx + 1500));
  }
  regions.push(text);

  for (const region of regions) {
    for (const re of CREATED_AT_JSON_RES) {
      const matches = [...region.matchAll(re)];
      for (const match of matches) {
        const raw = match[1];
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
      }
    }
  }
  return null;
}

/**
 * @param {Element} root
 * @returns {string|null} ISO 8601
 */
function extractJapaneseDateFromTextNodes(root) {
  if (!root) return null;
  const doc = root.ownerDocument || root;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.textContent || '').normalize('NFKC').replace(/\u00a0/g, ' ').trim();
    if (!text || text.length > 60) continue;
    const parsed = parseJapaneseDateTimeToIso(text);
    if (parsed) return parsed;
  }
  return null;
}

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
 * 日本語表示の日時文字列を ISO 8601 に変換（ブラウザのローカルタイムゾーンとして解釈）。
 * @param {string} text
 * @returns {string|null}
 */
/**
 * 英語表示の日時（Suno title 属性等）を ISO 8601 に変換。
 * @param {string} text
 * @returns {string|null}
 */
export function parseEnglishDateTimeToIso(text) {
  if (!text || JAPANESE_DATETIME_RE.test(text)) return null;
  const normalized = text.normalize('NFKC').replace(/\u00a0/g, ' ').trim();
  const m = normalized.match(
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})(?:\s+at\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i,
  );
  if (m) {
    const month = ENGLISH_MONTHS[m[1].toLowerCase()];
    if (month === undefined) return null;
    let hour = Number(m[4] ?? 0);
    const minute = Number(m[5] ?? 0);
    const ampm = (m[7] || '').toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const d = new Date(Number(m[3]), month, Number(m[2]), hour, minute);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (!ENGLISH_DATE_HINT_RE.test(normalized)) return null;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function parseJapaneseDateTimeToIso(text) {
  if (!text) return null;
  const normalized = text.normalize('NFKC').replace(/\u00a0/g, ' ').trim();
  const m = normalized.match(JAPANESE_DATETIME_RE);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  const d = new Date(year, month - 1, day, hour, minute);
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
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
      addBtn.closest('[data-testid="song-page"]') ||
      addBtn.closest('main') ||
      addBtn.closest('article') ||
      addBtn.closest('section') ||
      climbAncestors(addBtn, 10)
    );
  }
  const h1 = doc.querySelector('h1, [data-testid="song-title"]');
  if (h1) {
    return (
      h1.closest('[data-testid="song-page"]') ||
      h1.closest('main') ||
      h1.closest('article') ||
      h1.closest('section') ||
      climbAncestors(h1, 8)
    );
  }
  return doc.querySelector('[data-testid="song-page"], main, [role="main"]');
}

/**
 * @param {Element} root
 * @returns {string|null} ISO 8601
 */
/**
 * @param {Element} el
 * @returns {string|null}
 */
function parseDateFromElement(el) {
  if (!el) return null;
  const title = el.getAttribute('title') || '';
  const titleParsed =
    parseJapaneseDateTimeToIso(title) || parseEnglishDateTimeToIso(title);
  if (titleParsed) return titleParsed;
  const text = (el.textContent || '').normalize('NFKC').replace(/\u00a0/g, ' ').trim();
  if (!text || text.length > 60) return null;
  return parseJapaneseDateTimeToIso(text) || parseEnglishDateTimeToIso(text);
}

export function extractDateFromScope(root) {
  if (!root) return null;

  for (const sel of SUNO_JA_DATE_SELECTORS) {
    for (const el of root.querySelectorAll(sel)) {
      const parsed = parseDateFromElement(el);
      if (parsed) return parsed;
    }
  }

  const fromTextNodes = extractJapaneseDateFromTextNodes(root);
  if (fromTextNodes) return fromTextNodes;

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

  const jaDateSelectors = [
    'p.text-xs.text-foreground-secondary',
    'p[class*="text-xs"][class*="foreground-secondary"]',
    'span.text-xs.text-foreground-secondary',
    'span[class*="text-xs"][class*="foreground-secondary"]',
    'div.text-xs.text-foreground-secondary',
    'div[class*="text-xs"][class*="foreground-secondary"]',
    'p.text-foreground-secondary',
    'span.text-foreground-secondary',
    'div.text-foreground-secondary',
    '[class*="foreground-secondary"]',
  ];

  for (const sel of jaDateSelectors) {
    for (const el of root.querySelectorAll(sel)) {
      const text = (el.textContent || '').trim();
      if (!text || text.length > 40) continue;
      const parsed = parseJapaneseDateTimeToIso(text);
      if (parsed) return parsed;
      const titleParsed = parseJapaneseDateTimeToIso(el.getAttribute('title') || '');
      if (titleParsed) return titleParsed;
    }
  }

  for (const badge of root.querySelectorAll('span, p, div')) {
    const badgeText = (badge.textContent || '').trim();
    if (badgeText !== 'Custom' && !/^Custom$/i.test(badgeText)) continue;
    let container =
      badge.closest('[class*="flex"]') ||
      badge.parentElement?.parentElement ||
      badge.parentElement;
    for (let depth = 0; depth < 6 && container; depth += 1) {
      for (const el of container.querySelectorAll('span, p, div, time')) {
        const parsed = parseDateFromElement(el);
        if (parsed) return parsed;
      }
      container = container.parentElement;
    }
  }

  for (const el of root.querySelectorAll('span, p, div, time')) {
    const text = (el.textContent || '').trim();
    if (!JAPANESE_DATETIME_RE.test(text) || text.length > 40) continue;
    const parsed = parseJapaneseDateTimeToIso(text);
    if (parsed) return parsed;
  }

  const scopeText = (root.innerText || root.textContent || '').normalize('NFKC');
  const scopeMatch = scopeText.match(JAPANESE_DATETIME_RE);
  if (scopeMatch) {
    const parsed = parseJapaneseDateTimeToIso(scopeMatch[0]);
    if (parsed) return parsed;
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
 * @param {Document} doc
 * @param {string} [clipId]
 * @returns {string|null} ISO 8601
 */
export function extractCreatedAtFromPageState(doc, clipId) {
  try {
    const view = doc.defaultView;
    if (view?.__next_f && Array.isArray(view.__next_f)) {
      const chunkText = view.__next_f
        .map((chunk) => (typeof chunk === 'string' ? chunk : JSON.stringify(chunk)))
        .join('\n');
      const fromNextF = extractCreatedAtFromText(chunkText, clipId);
      if (fromNextF) return fromNextF;
    }
  } catch {
    /* ignore */
  }

  for (const script of doc.querySelectorAll('script')) {
    const text = script.textContent || '';
    if (!text.includes('created_at') && !text.includes('__next_f')) continue;
    const fromScript = extractCreatedAtFromText(text, clipId);
    if (fromScript) return fromScript;
  }

  const html = doc.documentElement?.innerHTML || doc.body?.innerHTML || '';
  return extractCreatedAtFromText(html, clipId);
}

/**
 * DOM から Suno 曲の生成日時を抽出する。
 * 曲ページのヒーロー付近 → main → ページ内 JSON の順。取得不可時は null。
 * @param {Document} doc
 * @param {string} [clipId]
 * @returns {string|null} ISO 8601
 */
export function extractSunoCreatedAtFromDom(doc, clipId) {
  // バックグラウンドタブでは DOM 日時が描画されないことがあるため、
  // clipId がある場合は RSC / script 埋め込みを先に試す。
  if (clipId) {
    const fromState = extractCreatedAtFromPageState(doc, clipId);
    if (fromState) return fromState;
  }

  const scopes = [
    findSongHeroRoot(doc),
    doc.querySelector('[data-testid="song-page"]'),
    doc.querySelector('main'),
    doc.querySelector('[role="main"]'),
    doc.body,
  ].filter(Boolean);

  const seen = new Set();
  for (const scope of scopes) {
    if (seen.has(scope)) continue;
    seen.add(scope);
    const found = extractDateFromScope(scope);
    if (found) return found;
  }

  return extractCreatedAtFromPageState(doc, clipId);
}

/**
 * ハイドレーション前後のタイミング差を吸収して生成日時を取得する。
 * @param {Document} doc
 * @param {string} [clipId]
 * @param {{ attempts?: number, intervalMs?: number }} [options]
 * @returns {Promise<string|null>} ISO 8601
 */
export async function waitForSunoCreatedAt(doc, clipId, options = {}) {
  const { attempts = 30, intervalMs = 150 } = options;
  for (let i = 0; i < attempts; i += 1) {
    const found = extractSunoCreatedAtFromDom(doc, clipId);
    if (found) return found;
    if (i < attempts - 1) await sleep(intervalMs);
  }
  return null;
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
