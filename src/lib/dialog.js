import { t } from './i18n.js';

/** @typedef {'alert' | 'confirm'} DialogMode */

const DIALOG_ID = 'message-dialog';

/** @type {((value: boolean | void) => void) | null} */
let resolveActive = null;
/** @type {Array<{ message: string, mode: DialogMode, resolve: (value: boolean | void) => void }>} */
let queue = [];
let open = false;

/** @type {HTMLElement | null} */
let previousFocus = null;

/** @type {(e: KeyboardEvent) => void} */
let keydownHandler = null;

/**
 * @param {HTMLElement} root
 * @returns {HTMLElement}
 */
function getPanel(root) {
  const panel = root.querySelector('.modal-panel');
  if (!panel) throw new Error('message-dialog: .modal-panel not found');
  return /** @type {HTMLElement} */ (panel);
}

/**
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => {
    const node = /** @type {HTMLElement} */ (el);
    return !node.hidden && node.offsetParent !== null;
  });
}

/**
 * @param {KeyboardEvent} e
 * @param {HTMLElement} panel
 */
function handleTrapFocus(e, panel) {
  if (e.key !== 'Tab') return;
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

/**
 * @param {boolean | void} result
 */
function closeDialog(result) {
  const root = document.getElementById(DIALOG_ID);
  if (!root || root.hidden) return;

  root.hidden = true;
  document.body.classList.remove('message-dialog-open');

  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler, true);
    keydownHandler = null;
  }

  const backdrop = root.querySelector('[data-message-dialog-backdrop]');
  backdrop?.removeEventListener('click', backdropClickHandler);

  open = false;
  const resolve = resolveActive;
  resolveActive = null;
  resolve?.(result);

  if (previousFocus && typeof previousFocus.focus === 'function') {
    previousFocus.focus();
  }
  previousFocus = null;

  processQueue();
}

const backdropClickHandler = () => {
  closeDialog(currentMode === 'confirm' ? false : undefined);
};

/** @type {DialogMode} */
let currentMode = 'alert';

/**
 * @param {string} message
 * @param {DialogMode} mode
 * @returns {Promise<boolean | void>}
 */
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
  previousFocus = /** @type {HTMLElement | null} */ (document.activeElement);

  const titleEl = root.querySelector('#message-dialog-title');
  const textEl = root.querySelector('#message-dialog-text');
  const okBtn = /** @type {HTMLButtonElement | null} */ (root.querySelector('#message-dialog-ok'));
  const cancelBtn = /** @type {HTMLButtonElement | null} */ (root.querySelector('#message-dialog-cancel'));
  const panel = getPanel(root);

  if (titleEl) titleEl.textContent = next.mode === 'confirm' ? t('dialogConfirm') : t('dialogNotice');
  if (textEl) textEl.textContent = next.message;
  if (cancelBtn) cancelBtn.hidden = next.mode !== 'confirm';

  root.hidden = false;
  document.body.classList.add('message-dialog-open');

  const backdrop = root.querySelector('[data-message-dialog-backdrop]');
  backdrop?.addEventListener('click', backdropClickHandler);

  keydownHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeDialog(next.mode === 'confirm' ? false : undefined);
      return;
    }
    handleTrapFocus(e, panel);
  };
  document.addEventListener('keydown', keydownHandler, true);

  okBtn?.focus();
}

/**
 * @param {DialogMode} mode
 * @returns {boolean | void}
 */
function modeFallback(mode) {
  if (mode === 'confirm') return false;
  return undefined;
}

/**
 * @param {string} message
 * @returns {Promise<void>}
 */
export function showAlert(message) {
  return /** @type {Promise<void>} */ (enqueueDialog(message, 'alert'));
}

/**
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function showConfirm(message) {
  return /** @type {Promise<boolean>} */ (enqueueDialog(message, 'confirm'));
}

/**
 * Bind OK / Cancel buttons once per page load.
 */
export function initMessageDialog() {
  const root = document.getElementById(DIALOG_ID);
  if (!root || root.dataset.dialogBound === 'true') return;

  const okBtn = root.querySelector('#message-dialog-ok');
  const cancelBtn = root.querySelector('#message-dialog-cancel');
  const closeBtn = root.querySelector('#message-dialog-close-btn');

  okBtn?.addEventListener('click', () => {
    closeDialog(currentMode === 'confirm' ? true : undefined);
  });
  cancelBtn?.addEventListener('click', () => {
    closeDialog(false);
  });
  closeBtn?.addEventListener('click', () => {
    closeDialog(currentMode === 'confirm' ? false : undefined);
  });

  root.dataset.dialogBound = 'true';
}
