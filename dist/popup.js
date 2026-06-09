(() => {
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

  // src/lib/capture-actions.js
  function detectCaptureAction(url) {
    if (/suno\.com\/(?:song|s)\//i.test(url)) return "captureSunoSong";
    if (/suno\.com\/(create|playlist|me)/i.test(url)) return "captureSunoList";
    if (/chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|copilot\.com|perplexity\.ai|poe\.com/i.test(
      url
    )) {
      return "captureAI";
    }
    return null;
  }

  // src/lib/debug.js
  var MA_DEBUG = false;
  var PREFIX = "[music-archive]";
  function debugLog(scope, ...args) {
    if (!MA_DEBUG) return;
    console.log(PREFIX, scope, ...args);
  }
  function debugError(scope, ...args) {
    if (!MA_DEBUG) return;
    console.error(PREFIX, scope, ...args);
  }

  // src/ui/popup/popup.js
  var INIT_MESSAGING_OPTIONS = { retries: 5, retryDelayMs: 300 };
  var SAVE_MESSAGING_OPTIONS = { ...INIT_MESSAGING_OPTIONS, timeoutMs: 3e4 };
  var saveStatusTimer = null;
  function send(action, payload = {}, options = {}) {
    return sendToBackground(action, payload, options);
  }
  function setCountLabelFallback(message = t("savedCountUnavailable")) {
    const el = document.getElementById("count-label");
    if (el) el.textContent = message;
  }
  function showSaveStatus(message, variant = "success") {
    const el = document.getElementById("save-status");
    if (!el) return;
    if (saveStatusTimer) {
      clearTimeout(saveStatusTimer);
      saveStatusTimer = null;
    }
    el.textContent = message;
    el.dataset.variant = variant;
    el.hidden = false;
    if (variant === "success") {
      saveStatusTimer = setTimeout(() => {
        el.hidden = true;
        el.textContent = "";
        delete el.dataset.variant;
        saveStatusTimer = null;
      }, 4e3);
    }
  }
  function clearSaveStatus() {
    const el = document.getElementById("save-status");
    if (!el) return;
    if (saveStatusTimer) {
      clearTimeout(saveStatusTimer);
      saveStatusTimer = null;
    }
    el.hidden = true;
    el.textContent = "";
    delete el.dataset.variant;
  }
  async function refreshCount() {
    try {
      const res = await send("countEntries", {}, INIT_MESSAGING_OPTIONS);
      if (res?.success === false) {
        setCountLabelFallback(t("savedCountReload"));
        return;
      }
      setCountLabelFallback(t("savedCount", String(res?.count ?? 0)));
    } catch {
      setCountLabelFallback(t("savedCountReload"));
    }
  }
  function captureFailureHint(error) {
    const detail = String(error || "");
    if (detail.includes("content_script_unavailable")) {
      return t("saveFailedCapture");
    }
    if (detail.includes("unsupported page")) {
      return t("unsupportedPage");
    }
    if (detail.includes("capture failed") || detail.includes("capture payload empty")) {
      return t("saveFailedCaptureReload");
    }
    if (detail.includes("no response from extension background")) {
      return t("saveFailedTimeout");
    }
    return detail ? t("saveFailedWithDetail", detail) : t("saveFailedGeneric");
  }
  document.getElementById("save-current").addEventListener("click", async () => {
    const saveBtn = document.getElementById("save-current");
    if (saveBtn?.disabled) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      await showAlert(t("runOnSupportedPage"));
      return;
    }
    if (!detectCaptureAction(tab.url)) {
      showSaveStatus(t("unsupportedPage"), "error");
      return;
    }
    clearSaveStatus();
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = t("saving");
    }
    try {
      debugLog("popup saveCurrentTab", { tabId: tab.id, url: tab.url });
      const saveRes = await send(
        "saveCurrentTab",
        { tabId: tab.id, activateTab: false },
        SAVE_MESSAGING_OPTIONS
      );
      if (!saveRes?.success) {
        debugError("popup save failed", saveRes?.error);
        showSaveStatus(captureFailureHint(saveRes?.error), "error");
        return;
      }
      debugLog("popup save ok", {
        clipId: saveRes.entry?.clipId,
        sunoCreatedAt: saveRes.entry?.sunoCreatedAt,
        count: saveRes.count
      });
      const savedCount = saveRes.count ?? 1;
      const saveMessage = savedCount > 1 ? t("saveMultiple", String(savedCount)) : saveRes.isNew ? t("saveNew") : t("saveOverwrite");
      showSaveStatus(saveMessage, "success");
      refreshCount();
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = t("saveCurrentPage");
      }
    }
  });
  document.getElementById("open-dashboard").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
  applyPageI18n();
  initMessageDialog();
  refreshCount();
  initTheme();
  bindThemeToggle();
  watchThemeChanges();
})();
//# sourceMappingURL=popup.js.map
