import { initMessageDialog, showAlert, showConfirm } from '../lib/dialog.js';
import { t } from '../lib/i18n.js';

const STYLE_LINK_ID = 'ma-extension-dialog-styles';
const BODY_OPEN_CLASS = 'ma-message-dialog-open';

/**
 * dialog.js は body.message-dialog-open を付与する。ホストページ向けにクラス名を差し替える。
 */
function patchBodyOpenClass() {
  const body = document.body;
  const originalAdd = body.classList.add.bind(body.classList);
  const originalRemove = body.classList.remove.bind(body.classList);

  body.classList.add = (...tokens) => {
    const mapped = tokens.map((t) => (t === 'message-dialog-open' ? BODY_OPEN_CLASS : t));
    return originalAdd(...mapped);
  };
  body.classList.remove = (...tokens) => {
    const mapped = tokens.map((t) => (t === 'message-dialog-open' ? BODY_OPEN_CLASS : t));
    return originalRemove(...mapped);
  };
}

function injectStyles() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('ui/shared/dialog-host-page.css');
  document.head.appendChild(link);
}

function injectDialogMarkup() {
  if (document.getElementById('message-dialog')) return;

  const root = document.createElement('div');
  root.id = 'message-dialog';
  root.className = 'modal message-dialog';
  root.hidden = true;
  root.innerHTML = `
    <div class="modal-backdrop" data-message-dialog-backdrop></div>
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="message-dialog-title">
      <header class="modal-header">
        <h2 id="message-dialog-title">${t('dialogNotice')}</h2>
        <button id="message-dialog-close-btn" type="button" class="icon-btn" aria-label="${t('close')}">×</button>
      </header>
      <div class="modal-body">
        <p id="message-dialog-text" class="message-dialog-text"></p>
      </div>
      <footer class="modal-footer">
        <button id="message-dialog-ok" type="button">${t('ok')}</button>
        <button id="message-dialog-cancel" type="button" class="secondary" hidden>${t('cancel')}</button>
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
  if (request?._target === 'background') return false;
  if (request.action !== 'showExtensionDialog') return false;

  (async () => {
    ensureDialogHost();
    if (request.mode === 'confirm') {
      const confirmed = await showConfirm(request.message || '');
      sendResponse({ success: true, confirmed });
      return;
    }
    await showAlert(request.message || '');
    sendResponse({ success: true });
  })();

  return true;
});
