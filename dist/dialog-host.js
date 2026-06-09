(() => {
  // src/lib/i18n.js
  function t(key, ...substitutions) {
    const subs = substitutions.map(String);
    const message = chrome.i18n.getMessage(key, subs);
    return message || key;
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

  // src/content/dialog-host.js
  var STYLE_LINK_ID = "ma-extension-dialog-styles";
  var BODY_OPEN_CLASS = "ma-message-dialog-open";
  function patchBodyOpenClass() {
    const body = document.body;
    const originalAdd = body.classList.add.bind(body.classList);
    const originalRemove = body.classList.remove.bind(body.classList);
    body.classList.add = (...tokens) => {
      const mapped = tokens.map((t2) => t2 === "message-dialog-open" ? BODY_OPEN_CLASS : t2);
      return originalAdd(...mapped);
    };
    body.classList.remove = (...tokens) => {
      const mapped = tokens.map((t2) => t2 === "message-dialog-open" ? BODY_OPEN_CLASS : t2);
      return originalRemove(...mapped);
    };
  }
  function injectStyles() {
    if (document.getElementById(STYLE_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = STYLE_LINK_ID;
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("ui/shared/dialog-host-page.css");
    document.head.appendChild(link);
  }
  function injectDialogMarkup() {
    if (document.getElementById("message-dialog")) return;
    const root = document.createElement("div");
    root.id = "message-dialog";
    root.className = "modal message-dialog";
    root.hidden = true;
    root.innerHTML = `
    <div class="modal-backdrop" data-message-dialog-backdrop></div>
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="message-dialog-title">
      <header class="modal-header">
        <h2 id="message-dialog-title">${t("dialogNotice")}</h2>
        <button id="message-dialog-close-btn" type="button" class="icon-btn" aria-label="${t("close")}">\xD7</button>
      </header>
      <div class="modal-body">
        <p id="message-dialog-text" class="message-dialog-text"></p>
      </div>
      <footer class="modal-footer">
        <button id="message-dialog-ok" type="button">${t("ok")}</button>
        <button id="message-dialog-cancel" type="button" class="secondary" hidden>${t("cancel")}</button>
      </footer>
    </div>
  `;
    document.body.appendChild(root);
  }
  function ensureDialogHost() {
    injectStyles();
    injectDialogMarkup();
    patchBodyOpenClass();
    initMessageDialog();
  }
  ensureDialogHost();
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?._target === "background") return false;
    if (request.action !== "showExtensionDialog") return false;
    (async () => {
      ensureDialogHost();
      if (request.mode === "confirm") {
        const confirmed = await showConfirm(request.message || "");
        sendResponse({ success: true, confirmed });
        return;
      }
      await showAlert(request.message || "");
      sendResponse({ success: true });
    })();
    return true;
  });
})();
//# sourceMappingURL=dialog-host.js.map
