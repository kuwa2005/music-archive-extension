const LYRIC_TAG_RE = /\[(?:intro|verse|chorus|bridge|outro|instrumental|pre-chorus|hook|refrain)\s*\d*\]/i;
const JP_LYRIC_TAG_RE = /【(?:A|B|C|S|サビ|メロ|イントロ|間奏|アウトロ|フック)[^\】]*】/;

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * @param {string} lyrics
 * @returns {string}
 */
export function normalizeLyrics(lyrics) {
  if (!lyrics) return '';
  return lyrics
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .replace(/\[([^\]]+)\]/gi, ' ')
    .replace(/【[^】]+】/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * @param {string} title
 * @returns {string}
 */
export function normalizeTitle(title) {
  if (!title) return '';
  return normalizeText(title.replace(/^★\s*/, '').replace(/\s*\|\s*Suno\s*$/i, ''));
}

/**
 * @param {import('../types.js').Entry} partial
 * @returns {Partial<import('../types.js').Entry>}
 */
export function enrichSearchFields(partial) {
  const lyricsNorm = normalizeLyrics(partial.lyrics || '');
  const titleNorm = normalizeTitle(partial.title || '');
  const parts = [
    partial.title,
    partial.lyrics,
    partial.stylePrompt,
    partial.gptName,
    partial.listContext,
    partial.sourceUrl,
  ].filter(Boolean);
  return {
    lyricsNorm,
    titleNorm,
    searchText: normalizeText(parts.join(' ')),
  };
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeLyrics(text) {
  if (!text || text.length < 20) return false;
  if (LYRIC_TAG_RE.test(text) || JP_LYRIC_TAG_RE.test(text)) return true;
  const lines = text.split(/\n/).filter((l) => l.trim().length > 0);
  if (lines.length >= 4 && text.length >= 80) return true;
  return false;
}

/**
 * @param {string} fullText
 * @param {string} [titleHint]
 * @returns {{ title: string, lyrics: string, musicalStyle: string }}
 */
export function extractLyricsFromPageText(fullText, titleHint = '') {
  if (!fullText || fullText.length < 20) {
    return { title: titleHint, lyrics: '', musicalStyle: '' };
  }

  const lyricStart = fullText.search(LYRIC_TAG_RE);
  const jpStart = fullText.search(JP_LYRIC_TAG_RE);
  const start = lyricStart >= 0 ? lyricStart : jpStart >= 0 ? jpStart : -1;
  const pre = start > 0 ? fullText.slice(0, start) : '';

  let title = titleHint;
  if (!title && pre) {
    const star = pre.match(/★\s*([^\n]+)/);
    if (star) title = star[1].trim();
  }

  let body = start >= 0 ? fullText.slice(start) : fullText;
  body = body.split('\n🔥\n')[0].split('\n😀\n')[0].trim();

  let lyrics = body
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^(Home|Explore|Create|Studio|Library|Search|Hooks|Labs|More|Sign In|Follow)$/i.test(t)) {
        return false;
      }
      if (/^v\d+\.\d+/.test(t)) return false;
      if (/^\d{4}年/.test(t)) return false;
      return true;
    })
    .join('\n')
    .trim();

  const again = lyrics.search(LYRIC_TAG_RE);
  if (again > 0) lyrics = lyrics.slice(again);

  return {
    title: title || titleHint || '',
    lyrics: lyrics.trim(),
    musicalStyle: '',
  };
}

/**
 * @param {string} text
 * @param {string} query
 * @returns {string}
 */
export function snippetAround(text, query, radius = 60) {
  if (!text || !query) return text?.slice(0, 160) || '';
  const normText = text.toLowerCase();
  const normQuery = query.toLowerCase();
  const idx = normText.indexOf(normQuery);
  if (idx < 0) return text.slice(0, 160);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  let s = text.slice(start, end);
  if (start > 0) s = '…' + s;
  if (end < text.length) s += '…';
  return s;
}

/**
 * @param {string} text
 * @param {string} query
 * @param {(s: string) => string} escape
 * @returns {string}
 */
export function highlightSnippet(text, query, escape) {
  const safe = escape || ((s) => s);
  if (!text) return '';
  if (!query?.trim()) return safe(text);

  const normText = text.toLowerCase();
  const normQuery = query.toLowerCase().trim();
  const idx = normText.indexOf(normQuery);
  if (idx < 0) return safe(text);

  const before = safe(text.slice(0, idx));
  const match = safe(text.slice(idx, idx + normQuery.length));
  const after = safe(text.slice(idx + normQuery.length));
  return `${before}<mark class="snippet-hit">${match}</mark>${after}`;
}
