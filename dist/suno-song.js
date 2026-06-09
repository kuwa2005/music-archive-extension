(() => {
  // src/lib/debug.js
  var MA_DEBUG = false;
  var PREFIX = "[music-archive]";
  var DETAIL_PREFIX = "[MA-DEBUG]";
  function debugWarn(scope, ...args) {
    if (!MA_DEBUG) return;
    console.warn(PREFIX, scope, ...args);
  }
  function debugError(scope, ...args) {
    if (!MA_DEBUG) return;
    console.error(PREFIX, scope, ...args);
  }
  function maDebug(...args) {
    if (!MA_DEBUG) return;
    console.log(DETAIL_PREFIX, ...args);
  }

  // src/lib/suno-selectors.js
  var TITLE_SELECTORS = ["h1", '[data-testid="song-title"]', ".song-title"];
  var LYRICS_SELECTORS = [
    '[data-testid="lyrics"]',
    "textarea",
    "p.whitespace-pre-wrap",
    ".lyrics",
    '[class*="lyric"]',
    "pre"
  ];
  var STYLE_SELECTORS = [
    '[data-testid="style-prompt"]',
    'div[class*="ingj1g"]',
    'div[class*="emi8w7v14"]',
    ".style-prompt",
    '[class*="style"]',
    'a[href^="/style/"]'
  ];
  var LYRICS_TAB_NAMES = [/^Lyrics$/i, /^歌詞$/i];
  var GMT_TITLE_RE = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), /;
  var RELATIVE_AGO_RE = /\bago\b/i;
  var JAPANESE_DATETIME_RE = /(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/;
  var ENGLISH_DATE_HINT_RE = /[A-Za-z]{3,}.*\d{4}|\d{4}.*[A-Za-z]{3,}/;
  var ENGLISH_MONTHS = {
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
    dec: 11
  };
  var SUNO_JA_DATE_SELECTORS = [
    'span.text-sm.text-foreground-secondary[title*="\u5E74"]',
    'span[class*="text-sm"][class*="foreground-secondary"][title*="\u5E74"]',
    'p.text-sm.text-foreground-secondary[title*="\u5E74"]',
    'div.text-sm.text-foreground-secondary[title*="\u5E74"]',
    "span.text-sm.text-foreground-secondary",
    'span[class*="text-sm"][class*="foreground-secondary"]',
    'p.text-xs.text-foreground-secondary[title*="\u5E74"]',
    'span.text-xs.text-foreground-secondary[title*="\u5E74"]',
    "p.text-xs.text-foreground-secondary",
    "span.text-xs.text-foreground-secondary",
    'span.text-foreground-secondary[title*="\u5E74"]',
    'p.text-foreground-secondary[title*="\u5E74"]',
    "span.text-foreground-secondary",
    "p.text-foreground-secondary",
    "div.text-foreground-secondary"
  ];
  var SUNO_CLIP_API = "https://studio-api.prod.suno.com/api/clips";
  var CREATED_AT_JSON_RES = [
    /"created_at"\s*:\s*"([^"]+)"/g,
    /\\"created_at\\":\\"([^"\\]+)\\"/g
  ];
  function climbAncestors(el, maxSteps = 8) {
    let node = el;
    for (let i = 0; i < maxSteps && node; i += 1) {
      node = node.parentElement;
      if (!node) break;
      const tag = node.tagName;
      if (tag === "MAIN" || tag === "ARTICLE" || tag === "SECTION" || node.getAttribute("role") === "main" || node.dataset?.testid === "song-page") {
        return node;
      }
    }
    let fallback = el;
    for (let i = 0; i < 6 && fallback?.parentElement; i += 1) {
      fallback = fallback.parentElement;
    }
    return fallback;
  }
  function extractCreatedAtFromText(text, clipId) {
    if (!text || !text.includes("created_at")) return null;
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
  function extractJapaneseDateFromTextNodes(root) {
    if (!root) return null;
    const doc = root.ownerDocument || root;
    const walker = doc.createTreeWalker(
      root,
      4
      /* NodeFilter.SHOW_TEXT */
    );
    let node;
    while (node = walker.nextNode()) {
      const text = (node.textContent || "").normalize("NFKC").replace(/\u00a0/g, " ").trim();
      if (!text || text.length > 60) continue;
      const parsed = parseJapaneseDateTimeToIso(text);
      if (parsed) return parsed;
    }
    return null;
  }
  function parseGmtTitleToIso(title) {
    if (!title || !GMT_TITLE_RE.test(title)) return null;
    const d = new Date(title);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  function parseEnglishDateTimeToIso(text) {
    if (!text || JAPANESE_DATETIME_RE.test(text)) return null;
    const normalized = text.normalize("NFKC").replace(/\u00a0/g, " ").trim();
    const m = normalized.match(
      /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})(?:\s+at\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i
    );
    if (m) {
      const month = ENGLISH_MONTHS[m[1].toLowerCase()];
      if (month === void 0) return null;
      let hour = Number(m[4] ?? 0);
      const minute = Number(m[5] ?? 0);
      const ampm = (m[7] || "").toUpperCase();
      if (ampm === "PM" && hour < 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      const d2 = new Date(Number(m[3]), month, Number(m[2]), hour, minute);
      if (!Number.isNaN(d2.getTime())) return d2.toISOString();
    }
    if (!ENGLISH_DATE_HINT_RE.test(normalized)) return null;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  function parseJapaneseDateTimeToIso(text) {
    if (!text) return null;
    const normalized = text.normalize("NFKC").replace(/\u00a0/g, " ").trim();
    const m = normalized.match(JAPANESE_DATETIME_RE);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }
    const d = new Date(year, month - 1, day, hour, minute);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return null;
    }
    return d.toISOString();
  }
  function findSongHeroRoot(doc) {
    const addBtn = doc.querySelector('button[title="Add to Playlist"]');
    if (addBtn) {
      return addBtn.closest('[data-testid="song-page"]') || addBtn.closest("main") || addBtn.closest("article") || addBtn.closest("section") || climbAncestors(addBtn, 10);
    }
    const h1 = doc.querySelector('h1, [data-testid="song-title"]');
    if (h1) {
      return h1.closest('[data-testid="song-page"]') || h1.closest("main") || h1.closest("article") || h1.closest("section") || climbAncestors(h1, 8);
    }
    return doc.querySelector('[data-testid="song-page"], main, [role="main"]');
  }
  function parseDateFromElement(el) {
    if (!el) return null;
    const title = el.getAttribute("title") || "";
    const titleParsed = parseJapaneseDateTimeToIso(title) || parseEnglishDateTimeToIso(title);
    if (titleParsed) return titleParsed;
    const text = (el.textContent || "").normalize("NFKC").replace(/\u00a0/g, " ").trim();
    if (!text || text.length > 60) return null;
    return parseJapaneseDateTimeToIso(text) || parseEnglishDateTimeToIso(text);
  }
  function extractDateFromScope(root) {
    if (!root) return null;
    for (const sel of SUNO_JA_DATE_SELECTORS) {
      for (const el of root.querySelectorAll(sel)) {
        const parsed = parseDateFromElement(el);
        if (parsed) return parsed;
      }
    }
    const fromTextNodes = extractJapaneseDateFromTextNodes(root);
    if (fromTextNodes) return fromTextNodes;
    for (const timeEl of root.querySelectorAll("time[datetime]")) {
      const iso = timeEl.getAttribute("datetime");
      if (iso && !Number.isNaN(new Date(iso).getTime())) {
        return new Date(iso).toISOString();
      }
    }
    const dateSelectors = [
      "p.text-xs.text-foreground-secondary[title]",
      'p[class*="text-xs"][class*="foreground-secondary"][title]',
      "span.text-xs.text-foreground-secondary[title]",
      '[title*="GMT"]'
    ];
    for (const sel of dateSelectors) {
      for (const el of root.querySelectorAll(sel)) {
        const title = el.getAttribute("title") || "";
        const text = (el.textContent || "").trim();
        const parsed = parseGmtTitleToIso(title);
        if (parsed && (RELATIVE_AGO_RE.test(text) || !text)) {
          return parsed;
        }
      }
    }
    const jaDateSelectors = [
      "p.text-xs.text-foreground-secondary",
      'p[class*="text-xs"][class*="foreground-secondary"]',
      "span.text-xs.text-foreground-secondary",
      'span[class*="text-xs"][class*="foreground-secondary"]',
      "div.text-xs.text-foreground-secondary",
      'div[class*="text-xs"][class*="foreground-secondary"]',
      "p.text-foreground-secondary",
      "span.text-foreground-secondary",
      "div.text-foreground-secondary",
      '[class*="foreground-secondary"]'
    ];
    for (const sel of jaDateSelectors) {
      for (const el of root.querySelectorAll(sel)) {
        const text = (el.textContent || "").trim();
        if (!text || text.length > 40) continue;
        const parsed = parseJapaneseDateTimeToIso(text);
        if (parsed) return parsed;
        const titleParsed = parseJapaneseDateTimeToIso(el.getAttribute("title") || "");
        if (titleParsed) return titleParsed;
      }
    }
    for (const badge of root.querySelectorAll("span, p, div")) {
      const badgeText = (badge.textContent || "").trim();
      if (badgeText !== "Custom" && !/^Custom$/i.test(badgeText)) continue;
      let container = badge.closest('[class*="flex"]') || badge.parentElement?.parentElement || badge.parentElement;
      for (let depth = 0; depth < 6 && container; depth += 1) {
        for (const el of container.querySelectorAll("span, p, div, time")) {
          const parsed = parseDateFromElement(el);
          if (parsed) return parsed;
        }
        container = container.parentElement;
      }
    }
    for (const el of root.querySelectorAll("span, p, div, time")) {
      const text = (el.textContent || "").trim();
      if (!JAPANESE_DATETIME_RE.test(text) || text.length > 40) continue;
      const parsed = parseJapaneseDateTimeToIso(text);
      if (parsed) return parsed;
    }
    const scopeText = (root.innerText || root.textContent || "").normalize("NFKC");
    const scopeMatch = scopeText.match(JAPANESE_DATETIME_RE);
    if (scopeMatch) {
      const parsed = parseJapaneseDateTimeToIso(scopeMatch[0]);
      if (parsed) return parsed;
    }
    for (const el of root.querySelectorAll("span, p, div, dt")) {
      const label = (el.textContent || "").trim();
      if (!/^Created$/i.test(label) && !/^作成/.test(label)) continue;
      const nearby = el.nextElementSibling || el.parentElement?.querySelector('[title*="GMT"], time[datetime]');
      if (!nearby) continue;
      const fromTitle = parseGmtTitleToIso(nearby.getAttribute("title") || "");
      if (fromTitle) return fromTitle;
      const dt = nearby.getAttribute("datetime");
      if (dt && !Number.isNaN(new Date(dt).getTime())) {
        return new Date(dt).toISOString();
      }
    }
    return null;
  }
  function extractCreatedAtFromPageState(doc, clipId) {
    try {
      const view = doc.defaultView;
      const nextFLen = view?.__next_f && Array.isArray(view.__next_f) ? view.__next_f.length : 0;
      maDebug("extractCreatedAtFromPageState:start", { clipId, nextFLen });
      if (view?.__next_f && Array.isArray(view.__next_f)) {
        const chunkText = view.__next_f.map((chunk) => typeof chunk === "string" ? chunk : JSON.stringify(chunk)).join("\n");
        const fromNextF = extractCreatedAtFromText(chunkText, clipId);
        maDebug("extractCreatedAtFromPageState:__next_f", { fromNextF });
        if (fromNextF) return fromNextF;
      }
    } catch (err) {
      maDebug("extractCreatedAtFromPageState:__next_f error", err);
    }
    let scriptHits = 0;
    for (const script of doc.querySelectorAll("script")) {
      const text = script.textContent || "";
      if (!text.includes("created_at") && !text.includes("__next_f")) continue;
      scriptHits += 1;
      const fromScript = extractCreatedAtFromText(text, clipId);
      if (fromScript) {
        maDebug("extractCreatedAtFromPageState:script", { scriptHits, fromScript });
        return fromScript;
      }
    }
    const html = doc.documentElement?.innerHTML || doc.body?.innerHTML || "";
    const fromHtml = extractCreatedAtFromText(html, clipId);
    maDebug("extractCreatedAtFromPageState:html", { scriptHits, fromHtml, htmlLen: html.length });
    return fromHtml;
  }
  function extractSunoCreatedAtFromDom(doc, clipId) {
    maDebug("extractSunoCreatedAtFromDom:start", { clipId, url: doc.defaultView?.location?.href });
    if (clipId) {
      const fromState = extractCreatedAtFromPageState(doc, clipId);
      if (fromState) {
        maDebug("extractSunoCreatedAtFromDom:fromState", fromState);
        return fromState;
      }
    }
    const scopes = [
      findSongHeroRoot(doc),
      doc.querySelector('[data-testid="song-page"]'),
      doc.querySelector("main"),
      doc.querySelector('[role="main"]'),
      doc.body
    ].filter(Boolean);
    const seen = /* @__PURE__ */ new Set();
    for (const scope of scopes) {
      if (seen.has(scope)) continue;
      seen.add(scope);
      const found = extractDateFromScope(scope);
      if (found) {
        maDebug("extractSunoCreatedAtFromDom:scope", {
          scopeTag: scope.tagName,
          scopeTestId: scope.getAttribute?.("data-testid"),
          found
        });
        return found;
      }
    }
    const selectorProbe = SUNO_JA_DATE_SELECTORS.slice(0, 4).map((sel) => ({
      sel,
      count: doc.querySelectorAll(sel).length,
      sample: [...doc.querySelectorAll(sel)].slice(0, 2).map((el) => ({
        text: (el.textContent || "").trim().slice(0, 40),
        title: el.getAttribute("title") || ""
      }))
    }));
    maDebug("extractSunoCreatedAtFromDom:selectorProbe", selectorProbe);
    const fallback = extractCreatedAtFromPageState(doc, clipId);
    maDebug("extractSunoCreatedAtFromDom:fallbackState", fallback);
    return fallback;
  }
  async function waitForSunoCreatedAt(doc, clipId, options = {}) {
    const { attempts = 30, intervalMs = 150 } = options;
    maDebug("waitForSunoCreatedAt:start", { clipId, attempts, intervalMs });
    for (let i = 0; i < attempts; i += 1) {
      const found = extractSunoCreatedAtFromDom(doc, clipId);
      if (found) {
        maDebug("waitForSunoCreatedAt:found", { attempt: i + 1, found });
        return found;
      }
      if (i === 0 || i === attempts - 1) {
        maDebug("waitForSunoCreatedAt:poll", { attempt: i + 1, found: null });
      }
      if (i < attempts - 1) await sleep(intervalMs);
    }
    maDebug("waitForSunoCreatedAt:timeout", { attempts });
    return null;
  }
  async function fetchSunoClipCreatedAt(clipId) {
    if (!clipId) return null;
    try {
      const url = `${SUNO_CLIP_API}/${clipId}`;
      const res = await fetch(url);
      if (!res.ok) {
        maDebug("fetchSunoClipCreatedAt:httpError", { clipId, status: res.status, url });
        return null;
      }
      const data = await res.json();
      const raw = data?.created_at;
      if (!raw || Number.isNaN(new Date(raw).getTime())) {
        maDebug("fetchSunoClipCreatedAt:invalidBody", { clipId, raw });
        return null;
      }
      const iso = new Date(raw).toISOString();
      maDebug("fetchSunoClipCreatedAt:ok", { clipId, iso });
      return iso;
    } catch (err) {
      maDebug("fetchSunoClipCreatedAt:error", { clipId, err: String(err) });
      return null;
    }
  }
  function parseClipIdFromUrl(url) {
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\/(?:song|s)\/([a-f0-9-]{36})/i);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }
  function pickLongestText(doc, selectors) {
    let best = "";
    for (const sel of selectors) {
      doc.querySelectorAll(sel).forEach((el) => {
        const t = (el.textContent || el.value || "").trim();
        if (t.length > best.length) best = t;
      });
    }
    return best;
  }
  function extractStyleFromRoot(root) {
    let best = "";
    root.querySelectorAll("div[title]").forEach((div) => {
      const t = div.getAttribute("title") || "";
      if (t.length > best.length && t.includes(",")) best = t;
    });
    if (best) return best;
    const parts = [];
    root.querySelectorAll('a[href^="/style/"]').forEach((a) => {
      const t = a.textContent.trim();
      if (t) parts.push(t);
    });
    if (parts.length) return parts.join(", ");
    for (const sel of STYLE_SELECTORS) {
      const el = root.querySelector(sel);
      if (el) {
        const t = el.textContent.trim();
        if (t.length > best.length) best = t;
      }
    }
    return best;
  }
  function hasLyricsTab(doc) {
    const buttons = doc.querySelectorAll('[role="tab"], button');
    for (const btn of buttons) {
      const label = (btn.textContent || btn.getAttribute("aria-label") || "").trim();
      if (LYRICS_TAB_NAMES.some((re) => re.test(label))) return true;
    }
    return false;
  }
  function pickClipMetadataRegion(text, clipId) {
    if (!text) return "";
    if (!clipId || !text.includes(clipId)) return text;
    const indices = [];
    let pos = text.indexOf(clipId);
    while (pos !== -1 && indices.length < 24) {
      indices.push(pos);
      pos = text.indexOf(clipId, pos + clipId.length);
    }
    const sliceAround = (idx) => text.slice(Math.max(0, idx - 2500), idx + 3500);
    const instrumentalRe = /"make_instrumental"\s*:\s*true|\\"make_instrumental\\":true/;
    for (let i = indices.length - 1; i >= 0; i -= 1) {
      const candidate = sliceAround(indices[i]);
      if (instrumentalRe.test(candidate)) return candidate;
    }
    const tagsRe = /display_tags|"tags"|\\"tags\\"|\\\\"tags\\\\"/;
    for (let i = indices.length - 1; i >= 0; i -= 1) {
      const candidate = sliceAround(indices[i]);
      if (tagsRe.test(candidate)) return candidate;
    }
    return text;
  }
  function extractClipFieldsFromPageState(doc, clipId) {
    const empty = { makeInstrumental: false, styleTags: "", prompt: "" };
    try {
      let text = "";
      const view = doc.defaultView;
      if (view?.__next_f && Array.isArray(view.__next_f)) {
        text = view.__next_f.map((chunk) => typeof chunk === "string" ? chunk : JSON.stringify(chunk)).join("\n");
      }
      if (!text) {
        for (const script of doc.querySelectorAll("script")) {
          const chunk = script.textContent || "";
          if (chunk.includes("make_instrumental") || clipId && chunk.includes(clipId)) {
            text += `
${chunk}`;
          }
        }
      }
      if (!text) text = doc.documentElement?.innerHTML || doc.body?.innerHTML || "";
      if (!text) return empty;
      const region = pickClipMetadataRegion(text, clipId);
      const instrumentalRe = /"make_instrumental"\s*:\s*true|\\"make_instrumental\\":true/;
      const makeInstrumental = instrumentalRe.test(region) || instrumentalRe.test(text);
      const displayTags = region.match(/\\\\"display_tags\\\\":\\\\"([^"\\]+)\\\\"/) || region.match(/\\"display_tags\\":\\"([^"\\]+)\\"/) || region.match(/"display_tags"\s*:\s*"([^"]+)"/);
      const metaTags = region.match(/\\\\"tags\\\\":\\\\"((?:[^"\\]|\\.)*)\\\\"/) || region.match(/\\"tags\\":\\"([^"\\]+)\\"/) || region.match(/"tags"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const promptMatch = region.match(/\\\\"prompt\\\\":\\\\"((?:[^"\\]|\\.)*)\\\\"/) || region.match(/\\"prompt\\":\\"([^"\\]*)\\"/) || region.match(/"prompt"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const decode = (s) => (s || "").replace(/\\\\"/g, '"').replace(/\\"/g, '"').replace(/\\n/g, "\n").trim();
      return {
        makeInstrumental,
        styleTags: decode(displayTags?.[1] || metaTags?.[1] || ""),
        prompt: decode(promptMatch?.[1] || "")
      };
    } catch {
      return empty;
    }
  }
  function normalizeSunoSongTitle(title) {
    return (title || "").replace(/^★\s*/, "").replace(/\s*\|\s*Suno\s*$/i, "").replace(/\s+by\s+[^|]+$/i, "").trim();
  }
  async function clickLyricsTab(doc) {
    if (!hasLyricsTab(doc)) return;
    const buttons = doc.querySelectorAll('[role="tab"], button');
    for (const btn of buttons) {
      const label = (btn.textContent || btn.getAttribute("aria-label") || "").trim();
      if (LYRICS_TAB_NAMES.some((re) => re.test(label))) {
        btn.click();
        await sleep(400);
        return;
      }
    }
  }
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // src/lib/normalize.js
  var LYRIC_TAG_RE = /\[(?:intro|verse|chorus|bridge|outro|instrumental|pre-chorus|hook|refrain)\s*\d*\]/i;
  var JP_LYRIC_TAG_RE = /【(?:A|B|C|S|サビ|メロ|イントロ|間奏|アウトロ|フック)[^\】]*】/;
  function looksLikeEmbeddedPageState(text) {
    if (!text || text.length < 80) return false;
    return /\\"play_count\\"|"play_count"\s*:|entity_type\\":\\"|"entity_type"\s*:|self\.__next_f\.push/.test(
      text
    ) || text.includes("created_at") && text.includes("audio_url");
  }
  function extractLyricsFromPageText(fullText, titleHint = "") {
    if (!fullText || fullText.length < 20) {
      return { title: titleHint, lyrics: "", musicalStyle: "" };
    }
    const lyricStart = fullText.search(LYRIC_TAG_RE);
    const jpStart = fullText.search(JP_LYRIC_TAG_RE);
    const start = lyricStart >= 0 ? lyricStart : jpStart >= 0 ? jpStart : -1;
    const pre = start > 0 ? fullText.slice(0, start) : "";
    let title = titleHint;
    if (!title && pre) {
      const star = pre.match(/★\s*([^\n]+)/);
      if (star) title = star[1].trim();
    }
    let body = start >= 0 ? fullText.slice(start) : fullText;
    body = body.split("\n\u{1F525}\n")[0].split("\n\u{1F600}\n")[0].trim();
    let lyrics = body.split(/\r?\n/).filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^(Home|Explore|Create|Studio|Library|Search|Hooks|Labs|More|Sign In|Follow)$/i.test(t)) {
        return false;
      }
      if (/^v\d+\.\d+/.test(t)) return false;
      if (/^\d{4}年/.test(t)) return false;
      return true;
    }).join("\n").trim();
    const again = lyrics.search(LYRIC_TAG_RE);
    if (again > 0) lyrics = lyrics.slice(again);
    return {
      title: title || titleHint || "",
      lyrics: lyrics.trim(),
      musicalStyle: ""
    };
  }

  // src/content/suno-song.js
  var CAPTURE_CREATED_AT_OPTIONS = { attempts: 5, intervalMs: 100 };
  async function extractSunoSongData() {
    const sourceUrl = window.location.href.split("?")[0].split("#")[0];
    const clipId = parseClipIdFromUrl(sourceUrl);
    const clipMeta = extractClipFieldsFromPageState(document, clipId);
    let sunoCreatedAt = await waitForSunoCreatedAt(document, clipId, CAPTURE_CREATED_AT_OPTIONS);
    if (!sunoCreatedAt && clipId) {
      sunoCreatedAt = await fetchSunoClipCreatedAt(clipId);
    }
    if (hasLyricsTab(document)) {
      await clickLyricsTab(document);
      await sleep(300);
    }
    let title = pickLongestText(document, TITLE_SELECTORS);
    if (!title) {
      title = document.title.replace(/\s*\|\s*Suno\s*$/i, "").trim();
    }
    title = normalizeSunoSongTitle(title);
    let lyrics = "";
    if (!clipMeta.makeInstrumental) {
      lyrics = pickLongestText(document, LYRICS_SELECTORS);
      if (!lyrics || lyrics.length < 20) {
        const fromBody = extractLyricsFromPageText(document.body?.innerText || "", title);
        if (fromBody.lyrics.length > lyrics.length) {
          lyrics = fromBody.lyrics;
          if (!title && fromBody.title) title = normalizeSunoSongTitle(fromBody.title);
        }
      }
    } else {
      lyrics = clipMeta.prompt || "";
    }
    if (looksLikeEmbeddedPageState(lyrics)) {
      lyrics = clipMeta.makeInstrumental ? clipMeta.prompt || "" : "";
    }
    let stylePrompt = extractStyleFromRoot(document.body);
    if (!stylePrompt) {
      stylePrompt = pickLongestText(document, ["div[title]", 'a[href^="/style/"]']);
    }
    if (!stylePrompt && clipMeta.styleTags) {
      stylePrompt = clipMeta.styleTags;
    }
    if (!sunoCreatedAt) {
      sunoCreatedAt = extractSunoCreatedAtFromDom(document, clipId);
      if (!sunoCreatedAt && clipId) {
        sunoCreatedAt = await fetchSunoClipCreatedAt(clipId);
      }
    }
    return {
      source: "suno_song",
      title,
      lyrics: (lyrics || "").trim(),
      stylePrompt: (stylePrompt || "").trim(),
      sourceUrl,
      clipId: clipId || void 0,
      sunoCreatedAt: sunoCreatedAt || void 0,
      capturedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  if (globalThis.__maSunoSongListenerRegistered) {
    debugWarn("suno-song content script already registered (reload the page after extension update)");
  } else {
    globalThis.__maSunoSongListenerRegistered = true;
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request?._target === "background") return false;
      if (request.action === "getSunoCreatedAt") {
        (async () => {
          try {
            const clipId = parseClipIdFromUrl(window.location.href.split("?")[0].split("#")[0]);
            const sunoCreatedAt = await waitForSunoCreatedAt(document, clipId, {
              attempts: 40,
              intervalMs: 150
            });
            sendResponse({ success: true, sunoCreatedAt: sunoCreatedAt || void 0 });
          } catch (err) {
            debugError("getSunoCreatedAt failed", err);
            sendResponse({ success: false, error: String(err) });
          }
        })();
        return true;
      }
      if (request.action !== "captureSunoSong") return false;
      (async () => {
        try {
          sendResponse({ success: true, data: await extractSunoSongData() });
        } catch (err) {
          debugError("captureSunoSong failed", err);
          sendResponse({ success: false, error: String(err) });
        }
      })();
      return true;
    });
  }
})();
//# sourceMappingURL=suno-song.js.map
