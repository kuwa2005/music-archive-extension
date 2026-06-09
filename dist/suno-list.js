(() => {
  // src/lib/suno-selectors.js
  var STYLE_SELECTORS = [
    '[data-testid="style-prompt"]',
    'div[class*="ingj1g"]',
    'div[class*="emi8w7v14"]',
    ".style-prompt",
    '[class*="style"]',
    'a[href^="/style/"]'
  ];
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
  function parseClipIdFromUrl(url) {
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\/(?:song|s)\/([a-f0-9-]{36})/i);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }
  function extractStyleFromRoot(root) {
    let best = "";
    root.querySelectorAll("div[title]").forEach((div) => {
      const t2 = div.getAttribute("title") || "";
      if (t2.length > best.length && t2.includes(",")) best = t2;
    });
    if (best) return best;
    const parts = [];
    root.querySelectorAll('a[href^="/style/"]').forEach((a) => {
      const t2 = a.textContent.trim();
      if (t2) parts.push(t2);
    });
    if (parts.length) return parts.join(", ");
    for (const sel of STYLE_SELECTORS) {
      const el = root.querySelector(sel);
      if (el) {
        const t2 = el.textContent.trim();
        if (t2.length > best.length) best = t2;
      }
    }
    return best;
  }
  function detectListContext(pageUrl, pageTitle = "") {
    try {
      const u = new URL(pageUrl);
      if (u.pathname.startsWith("/playlist/")) {
        return { type: "playlist", label: `playlist:${u.pathname}` };
      }
      if (u.pathname.startsWith("/create")) {
        const wid = u.searchParams.get("wid") || "";
        const title = pageTitle.replace(/\s*\|\s*Suno\s*$/i, "").trim();
        const label = wid ? title && title !== "Suno" ? `workspace:${wid}:${title}` : `workspace:${wid}` : title && title !== "Suno" ? `workspace:${title}` : "workspace";
        return { type: "workspace", label };
      }
      if (u.pathname.startsWith("/me")) {
        return { type: "library", label: "library" };
      }
    } catch {
    }
    return { type: "unknown", label: pageUrl };
  }

  // src/lib/suno-sources.js
  function sourceFromListContext(ctx) {
    if (ctx.type === "workspace") return "suno_workspace";
    return "suno_list";
  }

  // src/content/suno-list.js
  function extractUrlsFromText(text, urlSet) {
    if (!text) return;
    const patterns = [
      /https?:\/\/suno\.com\/(?:song|s)\/[a-f0-9-]{36}/gi,
      /\/(?:song|s)\/[a-f0-9-]{36}/gi
    ];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (!matches) continue;
      for (const match of matches) {
        try {
          const url = match.startsWith("http") ? match : new URL(match, window.location.origin).href;
          if (url.includes("/song/") || /\/s\/[a-f0-9-]{36}/i.test(url)) {
            urlSet.add(url.split("?")[0].split("#")[0]);
          }
        } catch {
        }
      }
    }
  }
  function collectSongUrls() {
    const urls = /* @__PURE__ */ new Set();
    document.querySelectorAll('a[href*="/song/"], a[href*="/s/"]').forEach((a) => {
      const href = a.href || a.getAttribute("href") || "";
      extractUrlsFromText(href, urls);
    });
    document.querySelectorAll("script").forEach((script) => {
      extractUrlsFromText(script.textContent || "", urls);
    });
    extractUrlsFromText(document.body?.innerText || "", urls);
    return urls;
  }
  function extractRowMeta(url) {
    const uuid = url.split("/").pop();
    let link = document.querySelector(
      `a[href="/song/${uuid}"], a[href*="/song/${uuid}"], a[href="/s/${uuid}"], a[href*="/s/${uuid}"]`
    );
    if (!link) {
      const all = document.querySelectorAll('a[href*="/song/"], a[href*="/s/"]');
      for (const l of all) {
        if ((l.href || "").includes(uuid)) {
          link = l;
          break;
        }
      }
    }
    let title = "";
    let stylePrompt = "";
    let imageUrl = "";
    let sunoCreatedAt;
    if (link) {
      title = link.textContent.trim() || link.getAttribute("title") || link.getAttribute("aria-label") || "";
      const parent = link.closest(
        '[data-testid="clip-row"], [class*="clip-row"], [class*="song"], [class*="card"], [role="row"]'
      );
      if (parent) {
        stylePrompt = extractStyleFromRoot(parent);
        if (!title) {
          const pt = parent.textContent.trim();
          title = pt.split("\n")[0]?.trim() || "";
        }
        const img = parent.querySelector("img[src], img[data-src]");
        if (img) {
          imageUrl = img.getAttribute("data-src") || img.src || "";
        }
        sunoCreatedAt = extractDateFromScope(parent) || void 0;
      }
    }
    return { title, stylePrompt, imageUrl, sunoCreatedAt };
  }
  function extractListEntries() {
    const ctx = detectListContext(window.location.href, document.title);
    const source = sourceFromListContext(ctx);
    const listContext = `${ctx.type}:${ctx.label}`;
    const urls = collectSongUrls();
    const entries = [];
    for (const url of urls) {
      const clipId = parseClipIdFromUrl(url);
      const meta = extractRowMeta(url);
      entries.push({
        source,
        title: meta.title,
        stylePrompt: meta.stylePrompt,
        sourceUrl: url,
        clipId: clipId || void 0,
        listContext,
        imageUrl: meta.imageUrl,
        sunoCreatedAt: meta.sunoCreatedAt,
        capturedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return entries;
  }
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?._target === "background") return false;
    if (request.action === "captureSunoList") {
      sendResponse({ success: true, data: extractListEntries() });
      return true;
    }
    return false;
  });
})();
//# sourceMappingURL=suno-list.js.map
