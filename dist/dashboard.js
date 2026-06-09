(() => {
  // src/lib/normalize.js
  function normalizeText(text) {
    if (!text) return "";
    return text.normalize("NFKC").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim().toLowerCase();
  }
  function normalizeLyrics(lyrics) {
    if (!lyrics) return "";
    return lyrics.normalize("NFKC").replace(/\r\n/g, "\n").replace(/\[([^\]]+)\]/gi, " ").replace(/【[^】]+】/g, " ").replace(/[ \t]+/g, " ").replace(/\n+/g, " ").trim().toLowerCase();
  }
  function normalizeTitle(title) {
    if (!title) return "";
    return normalizeText(title.replace(/^★\s*/, "").replace(/\s*\|\s*Suno\s*$/i, ""));
  }
  function snippetAround(text, query, radius = 60) {
    if (!text || !query) return text?.slice(0, 160) || "";
    const normText = text.toLowerCase();
    const normQuery = query.toLowerCase();
    const idx = normText.indexOf(normQuery);
    if (idx < 0) return text.slice(0, 160);
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + query.length + radius);
    let s = text.slice(start, end);
    if (start > 0) s = "\u2026" + s;
    if (end < text.length) s += "\u2026";
    return s;
  }
  function highlightSnippet(text, query, escape) {
    const safe = escape || ((s) => s);
    if (!text) return "";
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

  // src/lib/i18n.js
  function getUiLocale() {
    const lang = chrome.i18n?.getUILanguage?.() || "en";
    return lang.toLowerCase().startsWith("ja") ? "ja" : "en";
  }
  function t(key, ...substitutions) {
    const subs = substitutions.map(String);
    const message = chrome.i18n.getMessage(key, subs);
    return message || key;
  }
  function applyPageI18n(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.setAttribute("placeholder", t(key));
    });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (key) el.setAttribute("title", t(key));
    });
    root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      if (key) el.setAttribute("aria-label", t(key));
    });
    root.querySelectorAll("[data-i18n-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-label");
      if (key) el.setAttribute("label", t(key));
    });
    const docTitleKey = document.documentElement.getAttribute("data-i18n-doc-title");
    if (docTitleKey) {
      document.title = t(docTitleKey);
    }
    document.documentElement.lang = getUiLocale();
  }

  // src/lib/date-format.js
  function formatEntryDate(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    const now = /* @__PURE__ */ new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / 864e5);
    if (diffDays === 0) return t("dateToday");
    if (diffDays === 1) return t("dateYesterday");
    if (diffDays > 1 && diffDays < 7) return t("dateDaysAgo", diffDays);
    const locale = getUiLocale() === "ja" ? "ja-JP" : "en-US";
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
    }
    return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  }
  function formatDateTimeFull(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function formatListGenerationLabel(isoString) {
    if (!isoString) return "";
    const genLabel = formatEntryDate(isoString);
    const genFull = formatDateTimeFull(isoString);
    if (!genLabel || !genFull) return "";
    return t("generatedAtLabel", genLabel, genFull);
  }
  function formatDateGroupHeader(isoString) {
    if (!isoString) return t("dateUnknown");
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return t("dateUnknown");
    const rel = formatEntryDate(isoString);
    const locale = getUiLocale() === "ja" ? "ja-JP" : "en-US";
    const base = d.toLocaleDateString(locale, {
      year: "numeric",
      month: getUiLocale() === "ja" ? "long" : "short",
      day: "numeric"
    });
    const today = t("dateToday");
    const yesterday = t("dateYesterday");
    if (rel === today || rel === yesterday || /days ago|日前/.test(rel)) {
      return `${base} (${rel})`;
    }
    return base;
  }
  function dateGroupKey(isoString) {
    if (!isoString) return "unknown";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "unknown";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // src/lib/ai-sources.js
  var AI_SOURCES = ["chatgpt", "claude", "gemini", "copilot", "perplexity", "poe"];
  var AI_LABELS = {
    chatgpt: "ChatGPT",
    claude: "Claude",
    gemini: "Gemini",
    copilot: "Copilot",
    perplexity: "Perplexity",
    poe: "Poe"
  };
  function isAiSource(source) {
    return AI_SOURCES.includes(
      /** @type {AiSource} */
      source
    );
  }
  function getAiLabel(source) {
    return AI_LABELS[
      /** @type {AiSource} */
      source
    ] || source;
  }

  // src/lib/suno-sources.js
  var SUNO_ENTRY_SOURCES = ["suno_song", "suno_list", "suno_workspace"];
  var SUNO_SOURCE_MESSAGE_KEYS = {
    suno_song: "sourceSunoSong",
    suno_workspace: "sourceSunoWorkspace",
    suno_list: "sourceSunoList"
  };
  function isSunoEntrySource(source) {
    return SUNO_ENTRY_SOURCES.includes(
      /** @type {EntrySource} */
      source
    );
  }
  function getSunoSourceLabel(source) {
    const key = SUNO_SOURCE_MESSAGE_KEYS[source];
    return key ? t(key) : source;
  }

  // src/lib/theme.js
  var THEME_KEY = "theme";
  function normalizeTheme(value) {
    return value === "light" ? "light" : "dark";
  }
  async function getStoredTheme() {
    const result = await chrome.storage.local.get([THEME_KEY]);
    return normalizeTheme(result[THEME_KEY]);
  }
  function applyTheme(theme) {
    const normalized = normalizeTheme(theme);
    document.documentElement.dataset.theme = normalized;
    updateThemeToggleUi(normalized);
  }
  function updateThemeToggleUi(theme) {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const isLight = theme === "light";
    btn.setAttribute("aria-label", isLight ? t("themeToggleDark") : t("themeToggleLight"));
    btn.setAttribute("title", isLight ? t("themeDark") : t("themeLight"));
  }
  async function initTheme() {
    const theme = await getStoredTheme();
    applyTheme(theme);
    return theme;
  }
  async function toggleTheme() {
    const current = await getStoredTheme();
    const next = current === "dark" ? "light" : "dark";
    await chrome.storage.local.set({ [THEME_KEY]: next });
    applyTheme(next);
    return next;
  }
  function bindThemeToggle() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      toggleTheme();
    });
  }
  function watchThemeChanges() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[THEME_KEY]) return;
      applyTheme(normalizeTheme(changes[THEME_KEY].newValue));
    });
  }

  // src/lib/split-pane.js
  var SPLIT_STORAGE_KEY = "dashboardSplitRatio";
  var DEFAULT_SPLIT_RATIO = 1.2 / 2.2;
  var MIN_RATIO = 0.22;
  var MAX_RATIO = 0.78;
  function clampSplitRatio(ratio) {
    if (!Number.isFinite(ratio)) return DEFAULT_SPLIT_RATIO;
    return Math.max(MIN_RATIO, Math.min(MAX_RATIO, ratio));
  }
  function applySplitRatio(ratio) {
    const layout = document.querySelector(".layout");
    if (!layout) return;
    layout.style.setProperty("--split-ratio", String(clampSplitRatio(ratio)));
  }
  async function getStoredSplitRatio() {
    const result = await chrome.storage.local.get([SPLIT_STORAGE_KEY]);
    return clampSplitRatio(result[SPLIT_STORAGE_KEY] ?? DEFAULT_SPLIT_RATIO);
  }
  async function saveSplitRatio(ratio) {
    await chrome.storage.local.set({ [SPLIT_STORAGE_KEY]: clampSplitRatio(ratio) });
  }
  function bindSplitResizer() {
    const layout = document.querySelector(".layout");
    const resizer = document.getElementById("layout-resizer");
    if (!layout || !resizer) return;
    function ratioFromPointer(clientX) {
      const rect = layout.getBoundingClientRect();
      if (rect.width <= 0) return DEFAULT_SPLIT_RATIO;
      return clampSplitRatio((clientX - rect.left) / rect.width);
    }
    function onPointerMove(event) {
      applySplitRatio(ratioFromPointer(event.clientX));
    }
    function onPointerUp(event) {
      resizer.releasePointerCapture(event.pointerId);
      resizer.removeEventListener("pointermove", onPointerMove);
      resizer.removeEventListener("pointerup", onPointerUp);
      resizer.removeEventListener("pointercancel", onPointerUp);
      document.body.classList.remove("layout-resizing");
      saveSplitRatio(ratioFromPointer(event.clientX));
    }
    resizer.addEventListener("pointerdown", (event) => {
      if (window.matchMedia("(max-width: 900px)").matches) return;
      event.preventDefault();
      resizer.setPointerCapture(event.pointerId);
      document.body.classList.add("layout-resizing");
      applySplitRatio(ratioFromPointer(event.clientX));
      resizer.addEventListener("pointermove", onPointerMove);
      resizer.addEventListener("pointerup", onPointerUp);
      resizer.addEventListener("pointercancel", onPointerUp);
    });
    resizer.addEventListener("dblclick", () => {
      applySplitRatio(DEFAULT_SPLIT_RATIO);
      saveSplitRatio(DEFAULT_SPLIT_RATIO);
    });
  }
  async function initSplitPane() {
    applySplitRatio(await getStoredSplitRatio());
    bindSplitResizer();
  }

  // src/lib/similarity.js
  function ngrams(text, n = 3) {
    const set = /* @__PURE__ */ new Set();
    if (text.length < n) {
      if (text) set.add(text);
      return set;
    }
    for (let i = 0; i <= text.length - n; i += 1) {
      set.add(text.slice(i, i + n));
    }
    return set;
  }
  function jaccard(a, b) {
    if (!a.size && !b.size) return 0;
    let inter = 0;
    for (const x of a) {
      if (b.has(x)) inter += 1;
    }
    const union = a.size + b.size - inter;
    return union === 0 ? 0 : inter / union;
  }
  function lyricsSimilarity(a, b) {
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
  function titleSimilarity(a, b) {
    const na = normalizeTitle(a);
    const nb = normalizeTitle(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.9;
    return lyricsSimilarity(na, nb);
  }

  // src/lib/similarity-clusters.js
  var SIMILARITY_TITLE_THRESHOLD = 0.85;
  var SIMILARITY_LYRICS_THRESHOLD = 0.75;
  function normalizeTitleForClustering(title) {
    let t2 = normalizeTitle(title || "");
    t2 = t2.replace(/\s+by\s+.+$/i, "");
    t2 = t2.replace(/[（(][^）)]*[）)]/g, " ");
    return t2.replace(/\s+/g, " ").trim();
  }
  function clusteringTitleSimilarity(a, b) {
    const baseA = normalizeTitleForClustering(a);
    const baseB = normalizeTitleForClustering(b);
    if (!baseA || !baseB) return 0;
    if (baseA === baseB) return 1;
    if (baseA.includes(baseB) || baseB.includes(baseA)) return 0.9;
    return lyricsSimilarity(baseA, baseB);
  }
  function pairSimilarity(a, b) {
    const rawTitle = titleSimilarity(a.title || "", b.title || "");
    const baseTitle = clusteringTitleSimilarity(a.title || "", b.title || "");
    const title = Math.max(rawTitle, baseTitle);
    let lyrics = 0;
    if (a.lyrics?.trim() && b.lyrics?.trim()) {
      lyrics = lyricsSimilarity(a.lyrics, b.lyrics);
    }
    return { title, lyrics, score: Math.max(title, lyrics) };
  }
  function pairsAreSimilar(a, b) {
    const { title, lyrics } = pairSimilarity(a, b);
    if (title >= SIMILARITY_TITLE_THRESHOLD) return true;
    if (lyrics >= SIMILARITY_LYRICS_THRESHOLD) return true;
    return false;
  }
  function buildSimilarityClusters(entries) {
    const parent = /* @__PURE__ */ new Map();
    const ids = entries.map((e) => e.id);
    function find(id) {
      let root = id;
      while (parent.has(root) && parent.get(root) !== root) {
        root = /** @type {string} */
        parent.get(root);
      }
      function compress(node) {
        const p = parent.get(node);
        if (p && p !== node) parent.set(node, find(p));
      }
      compress(id);
      return root;
    }
    function unite(a, b) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    }
    for (const id of ids) parent.set(id, id);
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
    const clusters = /* @__PURE__ */ new Map();
    for (const id of ids) {
      const root = find(id);
      if (!clusters.has(root)) clusters.set(root, /* @__PURE__ */ new Set());
      clusters.get(root)?.add(id);
    }
    return clusters;
  }
  function similarityClusterLabel(clusterEntries) {
    const sorted = [...clusterEntries].sort(
      (a, b) => (b.capturedAt || "").localeCompare(a.capturedAt || "")
    );
    const title = sorted[0]?.title?.trim();
    if (!title) return t("similarClusterCount", clusterEntries.length);
    const short = title.length > 40 ? `${title.slice(0, 38)}\u2026` : title;
    return t("similarClusterTitle", short, clusterEntries.length);
  }

  // src/lib/result-view-mode.js
  var VIEW_MODE_KEY = "dashboardResultViewMode";
  var VIEW_MODES = ["cards", "compact", "list", "tree-links"];
  var VIEW_MODE_MESSAGE_KEYS = {
    cards: "viewModeCards",
    compact: "viewModeCompact",
    list: "viewModeList",
    "tree-links": "viewModeTreeLinks"
  };
  function getViewModeLabel(mode) {
    const key = VIEW_MODE_MESSAGE_KEYS[normalizeViewMode(mode)];
    return key ? t(key) : mode;
  }
  function normalizeViewMode(value) {
    if (value === "tree" || value === "tree-similarity") return "tree-links";
    return VIEW_MODES.includes(
      /** @type {ResultViewMode} */
      value
    ) ? (
      /** @type {ResultViewMode} */
      value
    ) : "cards";
  }
  async function getStoredViewMode() {
    const result = await chrome.storage.local.get([VIEW_MODE_KEY]);
    const raw = result[VIEW_MODE_KEY];
    const mode = normalizeViewMode(raw);
    if (raw === "tree" || raw === "tree-similarity") {
      await chrome.storage.local.set({ [VIEW_MODE_KEY]: mode });
    }
    return mode;
  }
  async function saveViewMode(mode) {
    await chrome.storage.local.set({ [VIEW_MODE_KEY]: normalizeViewMode(mode) });
  }
  function isTreeViewMode(mode) {
    return mode === "tree-links";
  }
  function partitionSimilarityClusters(entries) {
    if (!entries.length) {
      return { clusterGroups: [], singletonEntries: [] };
    }
    const byId = new Map(entries.map((e) => [e.id, e]));
    const simClusters = buildSimilarityClusters(entries);
    const clusteredIds = /* @__PURE__ */ new Set();
    const clusterGroups = [];
    for (const memberIds of simClusters.values()) {
      if (memberIds.size < 2) continue;
      const clusterEntries = [...memberIds].map((id) => byId.get(id)).filter(Boolean);
      if (clusterEntries.length < 2) continue;
      for (const id of memberIds) clusteredIds.add(id);
      clusterGroups.push({
        id: `sim-${[...memberIds].sort().join("-")}`,
        label: similarityClusterLabel(clusterEntries),
        entries: clusterEntries.sort((a, b) => (b.capturedAt || "").localeCompare(a.capturedAt || ""))
      });
    }
    clusterGroups.sort((a, b) => a.label.localeCompare(b.label, "ja"));
    const singletonEntries = entries.filter((e) => !clusteredIds.has(e.id)).sort((a, b) => (b.capturedAt || "").localeCompare(a.capturedAt || ""));
    return { clusterGroups, singletonEntries };
  }
  function flatEntryGroups(singletonEntries) {
    return singletonEntries.map((entry) => ({
      id: `entry-${entry.id}`,
      label: "",
      entries: [entry],
      flat: true
    }));
  }
  function buildLinkTreeGroups(entries, linkedIds) {
    if (!entries.length) return [];
    const linkedIdSet = linkedIds instanceof Set ? linkedIds : new Set(linkedIds);
    const linked = entries.filter((e) => linkedIdSet.has(e.id));
    const unlinked = entries.filter((e) => !linkedIdSet.has(e.id)).sort((a, b) => (b.capturedAt || "").localeCompare(a.capturedAt || ""));
    const { clusterGroups, singletonEntries } = partitionSimilarityClusters(linked);
    const roots = [...clusterGroups, ...flatEntryGroups(singletonEntries)];
    if (unlinked.length) {
      roots.push({
        id: "unlinked-root",
        label: t("unlinkedSection"),
        entries: unlinked
      });
    }
    return roots;
  }
  function buildTreeGroupsForMode(mode, entries, linkedIds) {
    if (mode === "tree-links") {
      return buildLinkTreeGroups(entries, linkedIds);
    }
    return [];
  }

  // src/lib/extension-messaging.js
  var BACKGROUND_TARGET = "background";
  var BACKGROUND_PORT_NAME = "ma-background";
  var RETRYABLE_ERRORS = /* @__PURE__ */ new Set([
    "unknown action",
    "no response from extension background"
  ]);
  var CONNECTION_ERROR_RE = /Receiving end does not exist|Could not establish connection|message port closed|Extension context invalidated|port disconnected/i;
  function errorMessage(err) {
    if (err instanceof Error) return err.message;
    return String(err);
  }
  function failureResponse(err) {
    return { success: false, error: errorMessage(err) };
  }
  function isConnectionError(msg) {
    return CONNECTION_ERROR_RE.test(msg);
  }
  function isRetryableResponse(res) {
    return !res || res.success === false && RETRYABLE_ERRORS.has(String(res.error || ""));
  }
  function sendViaRuntimeMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve(failureResponse(chrome.runtime.lastError.message || "runtime messaging failed"));
            return;
          }
          resolve(response ?? { success: false, error: "no response from extension background" });
        });
      } catch (err) {
        resolve(failureResponse(err));
      }
    });
  }
  function sendViaBackgroundPort(message, timeoutMs = 1e4) {
    return new Promise((resolve) => {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let port;
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          port?.disconnect();
        } catch {
        }
        resolve(value);
      };
      const timer = setTimeout(
        () => finish({ success: false, error: "no response from extension background" }),
        timeoutMs
      );
      try {
        port = chrome.runtime.connect({ name: BACKGROUND_PORT_NAME });
      } catch (err) {
        finish(failureResponse(err));
        return;
      }
      port.onMessage.addListener(function onPortMessage(msg) {
        if (msg?.requestId !== requestId) return;
        port.onMessage.removeListener(onPortMessage);
        const { requestId: _rid, ...rest } = msg;
        finish(rest);
      });
      port.onDisconnect.addListener(() => {
        if (settled) return;
        const msg = chrome.runtime.lastError?.message || "port disconnected before response";
        finish(failureResponse(msg));
      });
      try {
        port.postMessage({ ...message, requestId });
      } catch (err) {
        finish(failureResponse(err));
      }
    });
  }
  async function wakeBackground(retryDelayMs) {
    for (let i = 0; i < 2; i++) {
      const res = await sendViaRuntimeMessage({
        _target: BACKGROUND_TARGET,
        action: "ping"
      });
      if (res?.success) return;
      if (i < 1) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
  }
  async function sendToBackground(action, payload = {}, options = {}) {
    const { retries = 4, retryDelayMs = 250, wake = true, timeoutMs = 1e4 } = options;
    const message = { _target: BACKGROUND_TARGET, action, ...payload };
    let last = { success: false, error: "no response from extension background" };
    if (wake && action !== "ping") {
      await wakeBackground(retryDelayMs);
      await new Promise((r) => setTimeout(r, 50));
    }
    for (let attempt = 0; attempt <= retries; attempt++) {
      last = await sendViaRuntimeMessage(message);
      const shouldRetry = isRetryableResponse(last) || isConnectionError(String(last.error || ""));
      if (!shouldRetry) return last;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
      }
    }
    const portRes = await sendViaBackgroundPort(message, timeoutMs);
    const portShouldRetry = isRetryableResponse(portRes) || isConnectionError(String(portRes.error || ""));
    if (!portShouldRetry) return portRes;
    return portRes.error ? portRes : last;
  }

  // src/lib/dialog.js
  var DIALOG_ID = "message-dialog";
  var resolveActive = null;
  var queue = [];
  var open = false;
  var previousFocus = null;
  var keydownHandler = null;
  function getPanel(root) {
    const panel = root.querySelector(".modal-panel");
    if (!panel) throw new Error("message-dialog: .modal-panel not found");
    return (
      /** @type {HTMLElement} */
      panel
    );
  }
  function getFocusableElements(container) {
    return Array.from(
      container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => {
      const node = (
        /** @type {HTMLElement} */
        el
      );
      return !node.hidden && node.offsetParent !== null;
    });
  }
  function handleTrapFocus(e, panel) {
    if (e.key !== "Tab") return;
    const focusable = getFocusableElements(panel);
    if (focusable.length < 2) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  function closeDialog(result) {
    const root = document.getElementById(DIALOG_ID);
    if (!root || root.hidden) return;
    root.hidden = true;
    document.body.classList.remove("message-dialog-open");
    if (keydownHandler) {
      document.removeEventListener("keydown", keydownHandler, true);
      keydownHandler = null;
    }
    const backdrop = root.querySelector("[data-message-dialog-backdrop]");
    backdrop?.removeEventListener("click", backdropClickHandler);
    open = false;
    const resolve = resolveActive;
    resolveActive = null;
    resolve?.(result);
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
    previousFocus = null;
    processQueue();
  }
  var backdropClickHandler = () => {
    closeDialog(currentMode === "confirm" ? false : void 0);
  };
  var currentMode = "alert";
  function enqueueDialog(message, mode) {
    return new Promise((resolve) => {
      queue.push({ message, mode, resolve });
      processQueue();
    });
  }
  function processQueue() {
    if (open || queue.length === 0) return;
    const next = queue.shift();
    if (!next) return;
    const root = document.getElementById(DIALOG_ID);
    if (!root) {
      next.resolve(modeFallback(next.mode));
      processQueue();
      return;
    }
    open = true;
    currentMode = next.mode;
    resolveActive = next.resolve;
    previousFocus = /** @type {HTMLElement | null} */
    document.activeElement;
    const titleEl = root.querySelector("#message-dialog-title");
    const textEl = root.querySelector("#message-dialog-text");
    const okBtn = (
      /** @type {HTMLButtonElement | null} */
      root.querySelector("#message-dialog-ok")
    );
    const cancelBtn = (
      /** @type {HTMLButtonElement | null} */
      root.querySelector("#message-dialog-cancel")
    );
    const panel = getPanel(root);
    if (titleEl) titleEl.textContent = next.mode === "confirm" ? t("dialogConfirm") : t("dialogNotice");
    if (textEl) textEl.textContent = next.message;
    if (cancelBtn) cancelBtn.hidden = next.mode !== "confirm";
    root.hidden = false;
    document.body.classList.add("message-dialog-open");
    const backdrop = root.querySelector("[data-message-dialog-backdrop]");
    backdrop?.addEventListener("click", backdropClickHandler);
    keydownHandler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeDialog(next.mode === "confirm" ? false : void 0);
        return;
      }
      handleTrapFocus(e, panel);
    };
    document.addEventListener("keydown", keydownHandler, true);
    okBtn?.focus();
  }
  function modeFallback(mode) {
    if (mode === "confirm") return false;
    return void 0;
  }
  function showAlert(message) {
    return (
      /** @type {Promise<void>} */
      enqueueDialog(message, "alert")
    );
  }
  function showConfirm(message) {
    return (
      /** @type {Promise<boolean>} */
      enqueueDialog(message, "confirm")
    );
  }
  function initMessageDialog() {
    const root = document.getElementById(DIALOG_ID);
    if (!root || root.dataset.dialogBound === "true") return;
    const okBtn = root.querySelector("#message-dialog-ok");
    const cancelBtn = root.querySelector("#message-dialog-cancel");
    const closeBtn = root.querySelector("#message-dialog-close-btn");
    okBtn?.addEventListener("click", () => {
      closeDialog(currentMode === "confirm" ? true : void 0);
    });
    cancelBtn?.addEventListener("click", () => {
      closeDialog(false);
    });
    closeBtn?.addEventListener("click", () => {
      closeDialog(currentMode === "confirm" ? false : void 0);
    });
    root.dataset.dialogBound = "true";
  }

  // src/lib/debug.js
  var MA_DEBUG = false;
  var PREFIX = "[music-archive]";
  function debugLog(scope, ...args) {
    if (!MA_DEBUG) return;
    console.log(PREFIX, scope, ...args);
  }

  // src/ui/dashboard/dashboard.js
  var allResults = [];
  var linkedEntryIds = /* @__PURE__ */ new Set();
  var allLinks = [];
  var selectedEntry = null;
  var selectedEntryIds = /* @__PURE__ */ new Set();
  var viewMode = "cards";
  var linkStatusTimer;
  var collapsedTreeGroups = /* @__PURE__ */ new Set();
  var contextMenuOpen = false;
  var contextMenuMode = "multi";
  var contextMenuTargetId = null;
  function send(action, payload = {}) {
    return sendToBackground(action, payload);
  }
  function debounce(fn, ms) {
    let t2;
    return (...args) => {
      clearTimeout(t2);
      t2 = setTimeout(() => fn(...args), ms);
    };
  }
  function sourceLabel(source) {
    if (isSunoEntrySource(source)) return getSunoSourceLabel(source);
    if (isAiSource(source)) return getAiLabel(source);
    return source;
  }
  function badgeClass(source) {
    if (isAiSource(source)) return "chatgpt";
    return "suno";
  }
  async function runSearch() {
    const query = document.getElementById("search-input").value.trim();
    const source = document.getElementById("filter-source").value;
    const gptName = document.getElementById("filter-gpt").value.trim();
    const linkedOnly = document.getElementById("filter-linked").checked;
    const res = await send("search", {
      options: { query, source: source || void 0, gptName: gptName || void 0, linkedOnly }
    });
    allResults = res?.results || [];
    linkedEntryIds = new Set(res?.linkedIds || []);
    allLinks = res?.links || [];
    renderResults(query);
  }
  function applyViewModeClass() {
    const list = document.getElementById("result-list");
    list.classList.remove(
      "view-cards",
      "view-compact",
      "view-list",
      "view-tree",
      "view-tree-links"
    );
    list.classList.add(`view-${viewMode}`);
  }
  function syncViewModeButtons() {
    document.querySelectorAll("#view-mode-switcher [data-view-mode]").forEach((btn) => {
      const mode = btn.getAttribute("data-view-mode");
      const active = mode === viewMode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
      const label = getViewModeLabel(
        /** @type {import('../../lib/result-view-mode.js').ResultViewMode} */
        mode
      );
      btn.setAttribute("title", label);
      btn.setAttribute("aria-label", label);
    });
  }
  function lyricsListSnippet(entry) {
    const raw = entry.lyrics?.trim();
    if (!raw) return "";
    return raw.replace(/\r\n/g, " ").replace(/\s+/g, " ").trim();
  }
  function buildListDateHtml(entry) {
    if (entry.source === "suno_song" && entry.sunoCreatedAt) {
      const genText = formatListGenerationLabel(entry.sunoCreatedAt);
      if (!genText) return "";
      return `<time class="result-list-date" datetime="${escapeHtml(entry.sunoCreatedAt)}" title="${escapeHtml(genText)}">${escapeHtml(genText)}</time>`;
    }
    const savedAt = entry.capturedAt;
    if (!savedAt) return "";
    const label = formatEntryDate(savedAt);
    if (!label) return "";
    const savedTitle = `${t("savedAtPrefix")} ${formatDateTimeFull(savedAt)}`;
    return `<time class="result-list-date" datetime="${escapeHtml(savedAt)}" title="${escapeHtml(savedTitle)}">${escapeHtml(label)}</time>`;
  }
  function buildListLyricsHtml(entry, query) {
    const lyricsText = lyricsListSnippet(entry);
    if (!lyricsText) return "";
    return `<div class="result-list-fill"><span class="result-list-lyrics">${highlightSnippet(lyricsText, query, escapeHtml)}</span></div>`;
  }
  function buildResultItemInnerHtml(entry, query) {
    const snippet = snippetAround(entry.lyrics || entry.stylePrompt || entry.title, query);
    const isListView = viewMode === "list";
    const isLinked = linkedEntryIds.has(entry.id);
    const dateLabel = formatEntryDate(entry.capturedAt);
    const dateTitle = formatDateTimeFull(entry.capturedAt);
    const updatedTitle = entry.updatedAt && entry.updatedAt !== entry.capturedAt ? ` \xB7 ${t("updatedPrefix")} ${formatDateTimeFull(entry.updatedAt)}` : "";
    const genLabel = entry.source === "suno_song" && entry.sunoCreatedAt ? formatEntryDate(entry.sunoCreatedAt) : "";
    const genTitle = entry.source === "suno_song" && entry.sunoCreatedAt ? ` \xB7 ${t("generatedPrefix")} ${formatDateTimeFull(entry.sunoCreatedAt)}` : "";
    const showGenInDates = !isListView && genLabel;
    const listDateHtml = isListView ? buildListDateHtml(entry) : "";
    const listLyricsHtml = isListView ? buildListLyricsHtml(entry, query) : "";
    return `
    <div class="result-head">
      <div class="result-badges">
        <span class="badge ${badgeClass(entry.source)}">${sourceLabel(entry.source)}</span>
        ${entry.gptName ? `<span class="badge">${escapeHtml(entry.gptName)}</span>` : ""}
        ${isLinked ? `<span class="badge linked" title="${escapeHtml(t("linkedBadge"))}">\u{1F517} ${escapeHtml(t("linkedBadge"))}</span>` : ""}
        ${entry.protected ? `<span class="badge protected" title="${escapeHtml(t("protectedBadge"))}">\u{1F512}</span>` : ""}
      </div>
      ${isListView ? "" : `<div class="result-dates">
        ${showGenInDates ? `<time class="result-date result-date-generated" datetime="${escapeHtml(entry.sunoCreatedAt || "")}" title="${escapeHtml(t("generatedPrefix"))} ${escapeHtml(formatDateTimeFull(entry.sunoCreatedAt))}">${escapeHtml(genLabel)}</time>` : ""}
        ${dateLabel ? `<time class="result-date" datetime="${escapeHtml(entry.capturedAt || "")}" title="${escapeHtml(t("savedAtPrefix"))} ${escapeHtml(dateTitle)}${escapeHtml(updatedTitle)}${escapeHtml(genTitle)}">${escapeHtml(dateLabel)}</time>` : ""}
      </div>`}
    </div>
    ${listDateHtml}
    <div class="title">${escapeHtml(entry.title || t("untitled"))}</div>
    ${listLyricsHtml}
    <div class="snippet">${highlightSnippet(snippet, query, escapeHtml)}</div>
  `;
  }
  function resultItemClassName(entryId) {
    let cls = "result-item";
    if (selectedEntry?.id === entryId) cls += " active";
    if (selectedEntryIds.has(entryId)) cls += " multi-selected";
    return cls;
  }
  function updateSelectionHighlights() {
    document.querySelectorAll("#result-list .result-item").forEach((li) => {
      const id = li.dataset.id;
      if (!id) return;
      li.className = resultItemClassName(id);
    });
    updateMultiSelectBar();
  }
  function updateMultiSelectBar() {
    const count = selectedEntryIds.size;
    if (count < 2) {
      closeContextMenu();
      return;
    }
    updateContextMenuState();
  }
  function updateContextMenuState() {
    const linkBtn = document.getElementById("context-menu-link-btn");
    const unlinkBtn = document.getElementById("context-menu-unlink-btn");
    const unlinkAllBtn = document.getElementById("context-menu-unlink-all-btn");
    const clearBtn = document.getElementById("context-menu-clear-btn");
    if (!linkBtn || !unlinkBtn || !unlinkAllBtn || !clearBtn) return;
    if (contextMenuMode === "single" && contextMenuTargetId) {
      linkBtn.hidden = true;
      unlinkBtn.hidden = true;
      unlinkAllBtn.hidden = false;
      unlinkAllBtn.disabled = !linkedEntryIds.has(contextMenuTargetId);
      unlinkAllBtn.title = t("contextMenuUnlinkAllTitle");
      clearBtn.hidden = selectedEntryIds.size === 0;
      return;
    }
    linkBtn.hidden = false;
    unlinkBtn.hidden = false;
    unlinkAllBtn.hidden = true;
    const ids = [...selectedEntryIds];
    const { ai, suno } = partitionEntriesByLinkRole(ids);
    const canLink = ai.length > 0 && suno.length > 0;
    linkBtn.disabled = !canLink;
    linkBtn.title = canLink ? t("contextMenuLinkTitle") : t("contextMenuLinkNeedBoth");
    const betweenCount = countLinksBetween(ids);
    unlinkBtn.disabled = betweenCount === 0;
    unlinkBtn.title = betweenCount > 0 ? t("contextMenuUnlinkTitle", String(betweenCount), String(ids.length)) : t("contextMenuUnlinkNone");
    clearBtn.hidden = false;
  }
  function closeContextMenu() {
    const menu = document.getElementById("result-context-menu");
    if (menu) menu.hidden = true;
    contextMenuOpen = false;
    contextMenuMode = "multi";
    contextMenuTargetId = null;
  }
  function openContextMenu(x, y, mode = "multi", targetId = null) {
    const menu = document.getElementById("result-context-menu");
    if (!menu) return;
    if (mode === "multi" && selectedEntryIds.size < 2) return;
    if (mode === "single" && (!targetId || !linkedEntryIds.has(targetId))) return;
    contextMenuMode = mode;
    contextMenuTargetId = targetId;
    updateContextMenuState();
    menu.hidden = false;
    contextMenuOpen = true;
    menu.style.visibility = "hidden";
    menu.style.left = "0";
    menu.style.top = "0";
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    const left = Math.min(Math.max(8, x), window.innerWidth - mw - 8);
    const top = Math.min(Math.max(8, y), window.innerHeight - mh - 8);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = "";
  }
  function partitionEntriesByLinkRole(ids) {
    const ai = [];
    const suno = [];
    for (const id of ids) {
      const entry = allResults.find((e) => e.id === id);
      if (!entry) continue;
      if (isAiSource(entry.source)) ai.push(entry);
      else if (isSunoEntrySource(entry.source)) suno.push(entry);
    }
    return { ai, suno };
  }
  function linkPairExists(aiId, sunoId) {
    return allLinks.some((l) => l.chatgptEntryId === aiId && l.sunoEntryId === sunoId);
  }
  function countLinksBetween(ids) {
    const idSet = new Set(ids);
    return allLinks.filter((l) => idSet.has(l.chatgptEntryId) && idSet.has(l.sunoEntryId)).length;
  }
  function showLinkStatus(message, isError = false) {
    const el = document.getElementById("link-action-status");
    if (!el) return;
    clearTimeout(linkStatusTimer);
    el.textContent = message;
    el.classList.toggle("is-error", isError);
    el.hidden = false;
    linkStatusTimer = setTimeout(() => {
      el.hidden = true;
    }, 4e3);
  }
  function clearMultiSelection(updateUi = true) {
    if (selectedEntryIds.size === 0) return;
    selectedEntryIds.clear();
    closeContextMenu();
    debugLog("dashboard", "multi-select cleared");
    if (updateUi) updateSelectionHighlights();
  }
  function toggleMultiSelect(id) {
    if (selectedEntryIds.size === 0 && selectedEntry?.id && selectedEntry.id !== id) {
      selectedEntryIds.add(selectedEntry.id);
    }
    if (selectedEntryIds.has(id)) {
      selectedEntryIds.delete(id);
    } else {
      selectedEntryIds.add(id);
    }
    debugLog("dashboard", "multi-select", [...selectedEntryIds]);
    updateSelectionHighlights();
  }
  function handleResultItemClick(entry, event) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      toggleMultiSelect(entry.id);
      return;
    }
    clearMultiSelection(false);
    selectEntry(entry.id);
  }
  function createResultItemLi(entry, query) {
    const li = document.createElement("li");
    li.className = resultItemClassName(entry.id);
    li.dataset.id = entry.id;
    li.innerHTML = buildResultItemInnerHtml(entry, query);
    li.addEventListener("click", (e) => handleResultItemClick(entry, e));
    return li;
  }
  function createTreeGroupLi(group, query, nested = false) {
    const li = document.createElement("li");
    const childCount = group.children?.reduce((sum, c) => sum + c.entries.length, 0) ?? group.entries.length;
    const isCollapsed = collapsedTreeGroups.has(group.id);
    li.className = "result-tree-group" + (nested ? " result-tree-nested" : "") + (isCollapsed ? " collapsed" : "");
    li.dataset.groupId = group.id;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "result-tree-toggle";
    toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    toggle.textContent = `${group.label} (${childCount})`;
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (collapsedTreeGroups.has(group.id)) {
        collapsedTreeGroups.delete(group.id);
      } else {
        collapsedTreeGroups.add(group.id);
      }
      renderResults(document.getElementById("search-input").value.trim());
    });
    const childUl = document.createElement("ul");
    childUl.className = "result-tree-children";
    if (group.children?.length) {
      for (const child of group.children) {
        childUl.appendChild(createTreeGroupLi(child, query, true));
      }
    } else {
      for (const entry of group.entries) {
        childUl.appendChild(createResultItemLi(entry, query));
      }
    }
    li.appendChild(toggle);
    li.appendChild(childUl);
    return li;
  }
  function renderTreeResults(query) {
    const list = document.getElementById("result-list");
    const groups = buildTreeGroupsForMode(viewMode, allResults, linkedEntryIds);
    for (const group of groups) {
      if (group.flat && group.entries.length) {
        for (const entry of group.entries) {
          list.appendChild(createResultItemLi(entry, query));
        }
      } else {
        list.appendChild(createTreeGroupLi(group, query));
      }
    }
  }
  function renderFlatResults(query) {
    const list = document.getElementById("result-list");
    const showGroups = viewMode === "cards" && shouldShowDateGroups(allResults);
    let lastGroupKey = "";
    for (const entry of allResults) {
      const groupKey = dateGroupKey(entry.capturedAt);
      if (showGroups && groupKey !== lastGroupKey) {
        lastGroupKey = groupKey;
        const header = document.createElement("li");
        header.className = "result-date-group";
        header.textContent = formatDateGroupHeader(entry.capturedAt);
        list.appendChild(header);
      }
      list.appendChild(createResultItemLi(entry, query));
    }
  }
  function shouldShowDateGroups(entries) {
    const keys = new Set(entries.map((e) => dateGroupKey(e.capturedAt)));
    keys.delete("unknown");
    return keys.size > 1;
  }
  function renderResults(query) {
    const list = document.getElementById("result-list");
    list.innerHTML = "";
    document.getElementById("result-count").textContent = `(${allResults.length})`;
    applyViewModeClass();
    if (isTreeViewMode(viewMode)) {
      renderTreeResults(query);
    } else {
      renderFlatResults(query);
    }
    updateMultiSelectBar();
  }
  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function openInNewTab(url) {
    if (!url) return;
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({ url, active: true });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }
  function createExternalLink(url, label, className = "external-link") {
    const a = document.createElement("a");
    a.href = url;
    a.textContent = label;
    a.className = className;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openInNewTab(url);
    });
    return a;
  }
  function splitSongTitleAndArtist(fullTitle) {
    const m = fullTitle.match(/^(.+?)\s+by\s+(.+)$/i);
    if (!m) return { songTitle: fullTitle, artistSuffix: "" };
    return { songTitle: m[1], artistSuffix: ` by ${m[2]}` };
  }
  function renderDetailTitle(el, entry) {
    el.textContent = "";
    const fullTitle = entry.title?.trim() || t("untitled");
    if (!entry.sourceUrl) {
      el.textContent = fullTitle;
      return;
    }
    const { songTitle, artistSuffix } = splitSongTitleAndArtist(fullTitle);
    el.appendChild(createExternalLink(entry.sourceUrl, songTitle));
    if (artistSuffix) el.appendChild(document.createTextNode(artistSuffix));
  }
  function compactLinkLabel(entry) {
    if (entry.title?.trim()) return entry.title.trim();
    const url = entry.sourceUrl || "";
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      const path = u.pathname === "/" ? "" : u.pathname;
      const compact = host + path;
      return compact.length > 42 ? `${compact.slice(0, 40)}\u2026` : compact;
    } catch {
      return url.length > 42 ? `${url.slice(0, 40)}\u2026` : url;
    }
  }
  function updateDetailProtectBtn(entry) {
    const btn = document.getElementById("detail-protect-btn");
    if (!btn) return;
    const on = !!entry?.protected;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      on ? t("protectDisable") : t("protectEnable")
    );
    btn.title = on ? t("protectActive") : t("protectEnable");
  }
  async function createLinksFromSelection() {
    const ids = [...selectedEntryIds];
    if (ids.length < 2) return;
    closeContextMenu();
    const { ai, suno } = partitionEntriesByLinkRole(ids);
    if (!ai.length || !suno.length) {
      showLinkStatus(t("linkNeedBothTypes"), true);
      return;
    }
    let created = 0;
    let skipped = 0;
    for (const a of ai) {
      for (const s of suno) {
        if (linkPairExists(a.id, s.id)) {
          skipped++;
          continue;
        }
        await send("createLink", { chatgptEntryId: a.id, sunoEntryId: s.id });
        created++;
      }
    }
    clearMultiSelection(false);
    await runSearch();
    if (selectedEntry) await renderLinked(selectedEntry.id);
    if (created === 0 && skipped > 0) {
      showLinkStatus(t("linkAllAlreadyLinked"));
    } else if (created > 0) {
      const skipNote = skipped > 0 ? t("linkSkippedNote", String(skipped)) : "";
      showLinkStatus(`${t("linkCreatedCount", String(created))}${skipNote}`);
    }
  }
  async function removeLinksFromSelection() {
    const ids = [...selectedEntryIds];
    if (ids.length < 2) return;
    closeContextMenu();
    const betweenCount = countLinksBetween(ids);
    if (betweenCount === 0) {
      showLinkStatus(t("linkNoneBetween"), true);
      return;
    }
    const res = await send("deleteLinksBetween", { entryIds: ids });
    const deleted = res?.deleted ?? 0;
    clearMultiSelection(false);
    await runSearch();
    if (selectedEntry) await renderLinked(selectedEntry.id);
    if (deleted === 0) {
      showLinkStatus(t("linkNoneToRemove"), true);
    } else {
      showLinkStatus(t("linkRemovedCount", String(deleted)));
    }
  }
  async function removeAllLinksForContextEntry() {
    const entryId = contextMenuTargetId;
    if (!entryId) return;
    closeContextMenu();
    if (!linkedEntryIds.has(entryId)) {
      showLinkStatus(t("linkNoneOnEntry"), true);
      return;
    }
    const res = await send("deleteAllLinksForEntry", { entryId });
    const deleted = res?.deleted ?? 0;
    if (selectedEntryIds.has(entryId)) {
      selectedEntryIds.delete(entryId);
      updateSelectionHighlights();
    }
    await runSearch();
    if (selectedEntry?.id === entryId) await renderLinked(entryId);
    if (deleted === 0) {
      showLinkStatus(t("linkNoneToRemove"), true);
    } else {
      showLinkStatus(t("linkRemovedAllCount", String(deleted)));
    }
  }
  async function selectEntry(id) {
    const res = await send("getEntry", { entryId: id });
    selectedEntry = res?.entry || allResults.find((e) => e.id === id) || null;
    if (!selectedEntry) return;
    document.getElementById("detail-empty").hidden = true;
    document.getElementById("detail-content").hidden = false;
    renderDetailTitle(document.getElementById("detail-title"), selectedEntry);
    updateDetailProtectBtn(selectedEntry);
    const metaEl = document.getElementById("detail-meta");
    metaEl.textContent = "";
    const capturedLabel = formatEntryDate(selectedEntry.capturedAt);
    const capturedFull = formatDateTimeFull(selectedEntry.capturedAt);
    const metaParts = [sourceLabel(selectedEntry.source), selectedEntry.gptName].filter(Boolean);
    if (capturedLabel) {
      metaParts.push(`${capturedLabel}\uFF08${capturedFull}\uFF09`);
    }
    if (selectedEntry.updatedAt && selectedEntry.updatedAt.slice(0, 16) !== selectedEntry.capturedAt?.slice(0, 16)) {
      metaParts.push(`${t("updatedPrefix")} ${formatDateTimeFull(selectedEntry.updatedAt)}`);
    }
    if (selectedEntry.source === "suno_song") {
      if (selectedEntry.sunoCreatedAt) {
        const genLabel = formatEntryDate(selectedEntry.sunoCreatedAt);
        const genFull = formatDateTimeFull(selectedEntry.sunoCreatedAt);
        metaParts.push(`${t("generatedPrefix")} ${genLabel} (${genFull})`);
      } else {
        metaParts.push(t("generatedUnknown"));
      }
    }
    if (metaParts.length) {
      metaEl.appendChild(document.createTextNode(metaParts.join(" \xB7 ")));
    }
    if (selectedEntry.sourceUrl) {
      const urlLine = document.createElement("span");
      urlLine.className = "detail-meta-url";
      urlLine.appendChild(createExternalLink(selectedEntry.sourceUrl, selectedEntry.sourceUrl));
      metaEl.appendChild(urlLine);
    }
    const lyricsParts = [];
    if (selectedEntry.stylePrompt) lyricsParts.push(`[Style]
${selectedEntry.stylePrompt}
`);
    if (selectedEntry.lyrics) lyricsParts.push(selectedEntry.lyrics);
    document.getElementById("detail-lyrics").textContent = lyricsParts.join("\n") || t("noLyrics");
    await renderLinked(id);
    runSearch();
  }
  function sortLinkedEntries(entries) {
    return [...entries].sort((a, b) => {
      const ta = a.capturedAt || "";
      const tb = b.capturedAt || "";
      if (ta !== tb) return tb.localeCompare(ta);
      return (a.title || "").localeCompare(b.title || "", "ja");
    });
  }
  function createLinkedChip(entry) {
    const label = compactLinkLabel(entry);
    if (entry.sourceUrl) {
      const a = createExternalLink(entry.sourceUrl, label, "linked-chip");
      a.title = entry.sourceUrl;
      return a;
    }
    const span = document.createElement("span");
    span.className = "linked-chip linked-chip-static";
    span.textContent = label;
    span.title = label;
    return span;
  }
  function renderLinkedChipList(listEl, entries) {
    listEl.innerHTML = "";
    for (const e of entries) {
      const li = document.createElement("li");
      li.appendChild(createLinkedChip(e));
      listEl.appendChild(li);
    }
  }
  async function renderLinked(entryId) {
    const linked = await send("getLinked", { entryId });
    const chatUl = document.getElementById("linked-chatgpt");
    const sunoUl = document.getElementById("linked-suno");
    const chatRow = document.getElementById("linked-chatgpt-row");
    const sunoRow = document.getElementById("linked-suno-row");
    const chatEntries = sortLinkedEntries(
      (linked?.chatgpt || []).filter((e) => e.id !== entryId)
    );
    const sunoEntries = sortLinkedEntries((linked?.suno || []).filter((e) => e.id !== entryId));
    renderLinkedChipList(chatUl, chatEntries);
    renderLinkedChipList(sunoUl, sunoEntries);
    if (chatRow) chatRow.hidden = chatEntries.length === 0;
    if (sunoRow) sunoRow.hidden = sunoEntries.length === 0;
  }
  async function populateManualLinkSelects() {
    const chatRes = await send("search", { options: {} });
    const chatSelect = document.getElementById("manual-chatgpt");
    const sunoSelect = document.getElementById("manual-suno");
    chatSelect.innerHTML = `<option value="">${t("selectAiChat")}</option>`;
    sunoSelect.innerHTML = `<option value="">${t("selectSuno")}</option>`;
    for (const e of (chatRes?.results || []).filter((x) => isAiSource(x.source))) {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = `[${getAiLabel(e.source)}] ${e.title || e.gptName || e.id}`;
      chatSelect.appendChild(opt);
    }
    for (const e of (chatRes?.results || []).filter((x) => isSunoEntrySource(x.source))) {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.title || e.sourceUrl;
      sunoSelect.appendChild(opt);
    }
    if (selectedEntry) {
      if (isAiSource(selectedEntry.source)) {
        chatSelect.value = selectedEntry.id;
      } else if (isSunoEntrySource(selectedEntry.source)) {
        sunoSelect.value = selectedEntry.id;
      }
    }
  }
  async function openManualLinkDialog() {
    await populateManualLinkSelects();
    document.getElementById("manual-link-dialog").hidden = false;
  }
  function closeManualLinkDialog() {
    document.getElementById("manual-link-dialog").hidden = true;
  }
  document.getElementById("search-input").addEventListener("input", debounce(runSearch, 250));
  document.getElementById("filter-source").addEventListener("change", runSearch);
  document.getElementById("filter-gpt").addEventListener("input", debounce(runSearch, 250));
  document.getElementById("filter-linked").addEventListener("change", runSearch);
  document.getElementById("view-mode-switcher").addEventListener("click", async (e) => {
    const btn = (
      /** @type {HTMLElement|null} */
      e.target.closest("[data-view-mode]")
    );
    if (!btn) return;
    const next = normalizeViewMode(btn.getAttribute("data-view-mode"));
    if (next === viewMode) return;
    viewMode = next;
    syncViewModeButtons();
    await saveViewMode(viewMode);
    renderResults(document.getElementById("search-input").value.trim());
  });
  document.getElementById("clear-selection-btn")?.addEventListener("click", () => {
    clearMultiSelection();
  });
  function bindResultContextMenu() {
    const resultsBody = document.querySelector(".results-body");
    const menu = document.getElementById("result-context-menu");
    if (!resultsBody || !menu) return;
    resultsBody.addEventListener("contextmenu", (e) => {
      const item = e.target.closest(".result-item");
      const clickedId = item?.dataset?.id;
      if (selectedEntryIds.size >= 2) {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, "multi");
        return;
      }
      const singleTargetId = clickedId || (selectedEntryIds.size === 1 ? [...selectedEntryIds][0] : null) || (linkedEntryIds.has(selectedEntry?.id) ? selectedEntry.id : null);
      if (singleTargetId && linkedEntryIds.has(singleTargetId)) {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, "single", singleTargetId);
        return;
      }
      closeContextMenu();
    });
    document.getElementById("context-menu-link-btn")?.addEventListener("click", () => {
      createLinksFromSelection();
    });
    document.getElementById("context-menu-unlink-btn")?.addEventListener("click", () => {
      removeLinksFromSelection();
    });
    document.getElementById("context-menu-unlink-all-btn")?.addEventListener("click", () => {
      removeAllLinksForContextEntry();
    });
    document.getElementById("context-menu-clear-btn")?.addEventListener("click", () => {
      clearMultiSelection();
    });
    document.addEventListener("click", (e) => {
      if (!contextMenuOpen) return;
      if (menu.contains(
        /** @type {Node} */
        e.target
      )) return;
      closeContextMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !contextMenuOpen) return;
      e.stopPropagation();
      closeContextMenu();
    }, true);
    window.addEventListener("blur", () => {
      closeContextMenu();
    });
    window.addEventListener("resize", () => {
      closeContextMenu();
    });
    document.addEventListener("scroll", () => {
      closeContextMenu();
    }, true);
  }
  bindResultContextMenu();
  document.getElementById("open-manual-link-btn").addEventListener("click", openManualLinkDialog);
  document.getElementById("manual-link-close-btn").addEventListener("click", closeManualLinkDialog);
  document.getElementById("manual-link-cancel-btn").addEventListener("click", closeManualLinkDialog);
  document.querySelectorAll("[data-close-manual-link]").forEach((el) => {
    el.addEventListener("click", closeManualLinkDialog);
  });
  document.getElementById("manual-link-btn").addEventListener("click", async () => {
    const chatgptEntryId = document.getElementById("manual-chatgpt").value;
    const sunoEntryId = document.getElementById("manual-suno").value;
    if (!chatgptEntryId || !sunoEntryId) {
      await showAlert(t("selectBoth"));
      return;
    }
    await send("createLink", { chatgptEntryId, sunoEntryId });
    if (selectedEntry) await renderLinked(selectedEntry.id);
    await showAlert(t("linkCreated"));
    closeManualLinkDialog();
  });
  document.getElementById("delete-entry-btn").addEventListener("click", async () => {
    if (!selectedEntry) return;
    const confirmMsg = selectedEntry.protected ? t("confirmDeleteProtected") : t("confirmDeleteEntry");
    if (!await showConfirm(confirmMsg)) return;
    await send("deleteEntry", { entryId: selectedEntry.id });
    selectedEntry = null;
    document.getElementById("detail-empty").hidden = false;
    document.getElementById("detail-content").hidden = true;
    runSearch();
    refreshCleanupPreview();
  });
  document.getElementById("detail-protect-btn").addEventListener("click", async () => {
    if (!selectedEntry) return;
    const next = !selectedEntry.protected;
    const res = await send("setEntryProtected", { entryId: selectedEntry.id, protected: next });
    if (res?.entry) {
      selectedEntry = res.entry;
      updateDetailProtectBtn(selectedEntry);
      runSearch();
      refreshCleanupPreview();
    }
  });
  document.getElementById("export-btn").addEventListener("click", async () => {
    const res = await send("exportAll");
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `music-archive-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  function getImportMode() {
    const replace = document.getElementById("import-mode-replace");
    return replace?.checked ? "replace_except_protected" : "append";
  }
  function formatImportResult(res, mode) {
    const lines = [t("importResultEntries", String(res.entries ?? 0), String(res.links ?? 0))];
    if (mode === "replace_except_protected" && res.cleared) {
      lines.unshift(
        t(
          "importResultCleared",
          String(res.cleared.entries),
          String(res.cleared.links),
          String(res.cleared.keptProtected)
        )
      );
    }
    return lines.join("\n");
  }
  async function importJsonFile(file, mode) {
    if (mode === "replace_except_protected") {
      const ok = await showConfirm(t("importConfirmReplace"));
      if (!ok) return;
    }
    const text = await file.text();
    const data = JSON.parse(text);
    const res = await send("importAll", { data, mode });
    if (res?.success === false) {
      await showAlert(t("importFailed", res.error || t("unknownError")));
      return;
    }
    await showAlert(t("importComplete", formatImportResult(res, mode)));
    runSearch();
    refreshCleanupPreview();
  }
  document.getElementById("import-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mode = getImportMode();
    try {
      await importJsonFile(file, mode);
    } catch (err) {
      await showAlert(t("importFailed", String(err)));
    }
    e.target.value = "";
  });
  var currentSettingsTab = "auto-link";
  function cleanupInput(id) {
    return document.getElementById(id);
  }
  function resetCleanupDangerChecks() {
    const presetAll = cleanupInput("cleanup-preset-all");
    const includeProtected = cleanupInput("cleanup-include-protected");
    if (presetAll) presetAll.checked = false;
    if (includeProtected) includeProtected.checked = false;
  }
  function getCleanupFiltersFromUi() {
    return {
      presetOlderThan: cleanupInput("cleanup-preset-old")?.checked ?? false,
      olderThanDays: Number(cleanupInput("cleanup-older-days")?.value) || 90,
      presetUnlinked: cleanupInput("cleanup-preset-unlinked")?.checked ?? false,
      presetEmptyContent: cleanupInput("cleanup-preset-empty")?.checked ?? false,
      presetAll: cleanupInput("cleanup-preset-all")?.checked ?? false,
      source: (
        /** @type {import('../../types.js').EntrySource|''} */
        cleanupInput("cleanup-source")?.value || void 0
      ),
      linkStatus: (
        /** @type {'any'|'linked'|'unlinked'} */
        cleanupInput("cleanup-link-status")?.value ?? "any"
      ),
      contentStatus: (
        /** @type {'any'|'empty'|'has_content'} */
        cleanupInput("cleanup-content-status")?.value ?? "any"
      ),
      dateFrom: cleanupInput("cleanup-date-from")?.value ?? "",
      dateTo: cleanupInput("cleanup-date-to")?.value ?? "",
      keyword: cleanupInput("cleanup-keyword")?.value.trim() ?? "",
      includeProtected: cleanupInput("cleanup-include-protected")?.checked ?? false
    };
  }
  function hasActiveCleanupCriteria(filters) {
    if (filters.presetOlderThan || filters.presetUnlinked || filters.presetEmptyContent || filters.presetAll)
      return true;
    if (filters.source) return true;
    if (filters.keyword) return true;
    if (filters.linkStatus && filters.linkStatus !== "any") return true;
    if (filters.contentStatus && filters.contentStatus !== "any") return true;
    if (filters.dateFrom || filters.dateTo) return true;
    return false;
  }
  var cleanupPreviewRequestId = 0;
  var scheduleCleanupPreview = debounce(() => refreshCleanupPreview(), 200);
  async function cleanupBackendErrorMessage(detail) {
    const detailMsg = String(detail || "");
    if (detailMsg === "unknown action" || detailMsg.includes("no response from extension background")) {
      let versionHint = "";
      try {
        const info = await sendToBackground("getExtensionInfo", {}, { retries: 0 });
        if (info?.success && info.version) {
          versionHint = t(
            "backendVersionHint",
            info.version,
            info.supportsCleanup ? t("backendVersionYes") : t("backendVersionNo")
          );
        }
      } catch {
        versionHint = t("backendVersionUnknown");
      }
      return [
        t("backendCleanupUnavailable", versionHint),
        t("backendReloadTabsHint"),
        t("backendDevRebuildHint")
      ].join(" ");
    }
    if (detailMsg.includes("Could not establish connection") || detailMsg.includes("Receiving end does not exist")) {
      return t("backendSwUnavailable");
    }
    return detailMsg || t("unknownError");
  }
  async function refreshCleanupPreview() {
    if (currentSettingsTab !== "data-cleanup") return;
    const filters = getCleanupFiltersFromUi();
    const active = hasActiveCleanupCriteria(filters);
    const countEl = document.getElementById("cleanup-count");
    const noteEl = document.getElementById("cleanup-protected-note");
    const previewEl = document.getElementById("cleanup-preview");
    const deleteBtn = document.getElementById("cleanup-delete-btn");
    if (!countEl || !noteEl || !previewEl || !deleteBtn) return;
    if (!active) {
      countEl.textContent = "0";
      noteEl.hidden = true;
      previewEl.innerHTML = `<li class="cleanup-preview-meta">${escapeHtml(t("cleanupPreviewNeedCriteria"))}</li>`;
      deleteBtn.disabled = true;
      return;
    }
    const requestId = ++cleanupPreviewRequestId;
    let res;
    try {
      res = await send("previewCleanup", { filters, limit: 8 });
    } catch (err) {
      if (requestId !== cleanupPreviewRequestId) return;
      countEl.textContent = "0";
      noteEl.hidden = true;
      previewEl.innerHTML = `<li class="cleanup-preview-meta cleanup-preview-error">${escapeHtml(t("cleanupPreviewFailed", String(err)))}</li>`;
      deleteBtn.disabled = true;
      return;
    }
    if (requestId !== cleanupPreviewRequestId) return;
    if (res?.success === false) {
      countEl.textContent = "0";
      noteEl.hidden = true;
      previewEl.innerHTML = `<li class="cleanup-preview-meta cleanup-preview-error">${escapeHtml(t("cleanupPreviewFailed", await cleanupBackendErrorMessage(res.error)))}</li>`;
      deleteBtn.disabled = true;
      return;
    }
    const count = res?.count ?? 0;
    countEl.textContent = String(count);
    noteEl.hidden = !!filters.includeProtected;
    if (filters.presetAll) {
      noteEl.hidden = false;
      noteEl.textContent = t("cleanupNoteAllData");
    } else if (!filters.includeProtected) {
      noteEl.textContent = t("cleanupNoteProtectedExcluded");
    }
    deleteBtn.disabled = count === 0;
    previewEl.innerHTML = "";
    if (!count) {
      previewEl.innerHTML = `<li class="cleanup-preview-meta">${escapeHtml(t("cleanupNoMatches"))}</li>`;
      return;
    }
    for (const entry of res.preview || []) {
      const li = document.createElement("li");
      const title = entry.title || t("untitled");
      const date = entry.capturedAt?.slice(0, 10) || "";
      li.innerHTML = `
      <div class="cleanup-preview-title">${entry.protected ? "\u{1F512} " : ""}${escapeHtml(title)}</div>
      <div class="cleanup-preview-meta">${escapeHtml(sourceLabel(entry.source))} \xB7 ${escapeHtml(date)}</div>
    `;
      previewEl.appendChild(li);
    }
    if (count > (res.preview?.length || 0)) {
      const li = document.createElement("li");
      li.className = "cleanup-preview-meta";
      li.textContent = t("cleanupMoreCount", String(count - (res.preview?.length || 0)));
      previewEl.appendChild(li);
    }
  }
  function bindCleanupUi() {
    const immediateIds = [
      "cleanup-preset-old",
      "cleanup-preset-unlinked",
      "cleanup-preset-empty",
      "cleanup-preset-all",
      "cleanup-source",
      "cleanup-link-status",
      "cleanup-content-status",
      "cleanup-include-protected"
    ];
    const debouncedIds = [
      "cleanup-older-days",
      "cleanup-date-from",
      "cleanup-date-to",
      "cleanup-keyword"
    ];
    for (const id of immediateIds) {
      const el = cleanupInput(id);
      if (!el) continue;
      el.addEventListener("change", () => refreshCleanupPreview());
    }
    for (const id of debouncedIds) {
      const el = cleanupInput(id);
      if (!el) continue;
      el.addEventListener("input", scheduleCleanupPreview);
      el.addEventListener("change", scheduleCleanupPreview);
    }
    cleanupInput("cleanup-older-days")?.addEventListener("input", () => {
      const preset = cleanupInput("cleanup-preset-old");
      if (preset) preset.checked = true;
    });
    cleanupInput("cleanup-older-days")?.addEventListener("change", () => {
      const preset = cleanupInput("cleanup-preset-old");
      if (preset) preset.checked = true;
    });
    document.getElementById("cleanup-older-days")?.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    document.getElementById("cleanup-goto-export")?.addEventListener("click", () => {
      showSettingsTab("data-management");
    });
    document.getElementById("cleanup-delete-btn")?.addEventListener("click", async () => {
      const filters = getCleanupFiltersFromUi();
      if (!hasActiveCleanupCriteria(filters)) return;
      const preview = await send("previewCleanup", { filters, limit: 8 });
      const count = preview?.count ?? 0;
      if (!count) return;
      let confirmMsg = t("cleanupConfirmDelete", String(count));
      if (count >= 50) {
        confirmMsg = t("cleanupConfirmDeleteIrreversible", String(count));
      }
      if (filters.includeProtected && count >= 10) {
        confirmMsg += t("cleanupConfirmIncludesProtected");
      }
      if (filters.presetAll) {
        confirmMsg = t("cleanupConfirmDeleteAll", String(count));
        if (filters.includeProtected) {
          confirmMsg += t("cleanupConfirmIncludesProtected");
        }
      }
      if (!await showConfirm(confirmMsg)) return;
      const res = await send("bulkDeleteCleanup", { filters });
      await showAlert(t("cleanupDeletedCount", String(res?.deleted ?? 0)));
      resetCleanupDangerChecks();
      if (selectedEntry?.id) {
        const still = await send("getEntry", { entryId: selectedEntry.id });
        if (!still?.entry) {
          selectedEntry = null;
          document.getElementById("detail-empty").hidden = false;
          document.getElementById("detail-content").hidden = true;
        } else {
          selectedEntry = still.entry;
          updateDetailProtectBtn(selectedEntry);
        }
      }
      runSearch();
      refreshCleanupPreview();
    });
  }
  async function loadSettingsUi() {
    const res = await send("getSettings");
    const s = res?.settings || {};
    document.getElementById("setting-threshold").value = s.linkThreshold ?? 0.75;
    document.getElementById("setting-window").value = s.linkWindowDays ?? 30;
  }
  function showSettingsTab(tab) {
    currentSettingsTab = tab;
    document.querySelectorAll(".settings-tab").forEach((btn) => {
      const active = btn.getAttribute("data-settings-tab") === tab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.getElementById("settings-panel-auto-link").hidden = tab !== "auto-link";
    document.getElementById("settings-panel-data").hidden = tab !== "data-management";
    document.getElementById("settings-panel-cleanup").hidden = tab !== "data-cleanup";
    document.getElementById("save-settings-btn").hidden = tab === "data-management" || tab === "data-cleanup";
    if (tab === "data-cleanup") {
      refreshCleanupPreview();
    }
  }
  function openSettingsDialog() {
    resetCleanupDangerChecks();
    loadSettingsUi();
    showSettingsTab("auto-link");
    document.getElementById("settings-dialog").hidden = false;
  }
  function closeSettingsDialog() {
    resetCleanupDangerChecks();
    document.getElementById("settings-dialog").hidden = true;
  }
  async function saveCurrentSettingsTab() {
    if (currentSettingsTab === "auto-link") {
      await send("saveSettings", {
        settings: {
          linkThreshold: Number(document.getElementById("setting-threshold").value),
          linkWindowDays: Number(document.getElementById("setting-window").value)
        }
      });
    }
  }
  document.getElementById("open-settings-btn").addEventListener("click", openSettingsDialog);
  document.getElementById("settings-close-btn").addEventListener("click", closeSettingsDialog);
  document.getElementById("settings-cancel-btn").addEventListener("click", closeSettingsDialog);
  document.querySelectorAll("[data-close-settings]").forEach((el) => {
    el.addEventListener("click", closeSettingsDialog);
  });
  document.querySelectorAll(".settings-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-settings-tab");
      if (tab === "auto-link" || tab === "data-management" || tab === "data-cleanup") {
        showSettingsTab(tab);
      }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (contextMenuOpen) return;
    const messageDialog = document.getElementById("message-dialog");
    if (messageDialog && !messageDialog.hidden) return;
    if (!document.getElementById("manual-link-dialog").hidden) {
      closeManualLinkDialog();
      return;
    }
    if (!document.getElementById("settings-dialog").hidden) {
      closeSettingsDialog();
      return;
    }
    if (selectedEntryIds.size > 0) {
      clearMultiSelection();
    }
  });
  document.getElementById("save-settings-btn").addEventListener("click", async () => {
    await saveCurrentSettingsTab();
    await showAlert(t("settingsSaved"));
  });
  initMessageDialog();
  async function initDashboard() {
    applyPageI18n();
    viewMode = await getStoredViewMode();
    syncViewModeButtons();
    await runSearch();
  }
  initDashboard();
  initTheme();
  bindThemeToggle();
  watchThemeChanges();
  initSplitPane();
  bindCleanupUi();
})();
//# sourceMappingURL=dashboard.js.map
