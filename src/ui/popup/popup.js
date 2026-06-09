import { initTheme, bindThemeToggle, watchThemeChanges } from '../../lib/theme.js';
import { sendToBackground } from '../../lib/extension-messaging.js';
import { initMessageDialog, showAlert } from '../../lib/dialog.js';
import { detectCaptureAction } from '../../lib/capture-actions.js';
import { debugLog, debugError } from '../../lib/debug.js';
import { applyPageI18n, t } from '../../lib/i18n.js';

const INIT_MESSAGING_OPTIONS = { retries: 5, retryDelayMs: 300 };
const SAVE_MESSAGING_OPTIONS = { ...INIT_MESSAGING_OPTIONS, timeoutMs: 30000 };

/** @type {ReturnType<typeof setTimeout> | null} */
let saveStatusTimer = null;

function send(action, payload = {}, options = {}) {
  return sendToBackground(action, payload, options);
}

function setCountLabelFallback(message = t('savedCountUnavailable')) {
  const el = document.getElementById('count-label');
  if (el) el.textContent = message;
}

/**
 * @param {string} message
 * @param {'success' | 'error'} [variant]
 */
function showSaveStatus(message, variant = 'success') {
  const el = document.getElementById('save-status');
  if (!el) return;

  if (saveStatusTimer) {
    clearTimeout(saveStatusTimer);
    saveStatusTimer = null;
  }

  el.textContent = message;
  el.dataset.variant = variant;
  el.hidden = false;

  if (variant === 'success') {
    saveStatusTimer = setTimeout(() => {
      el.hidden = true;
      el.textContent = '';
      delete el.dataset.variant;
      saveStatusTimer = null;
    }, 4000);
  }
}

function clearSaveStatus() {
  const el = document.getElementById('save-status');
  if (!el) return;
  if (saveStatusTimer) {
    clearTimeout(saveStatusTimer);
    saveStatusTimer = null;
  }
  el.hidden = true;
  el.textContent = '';
  delete el.dataset.variant;
}

async function refreshCount() {
  try {
    const res = await send('countEntries', {}, INIT_MESSAGING_OPTIONS);
    if (res?.success === false) {
      setCountLabelFallback(t('savedCountReload'));
      return;
    }
    setCountLabelFallback(t('savedCount', String(res?.count ?? 0)));
  } catch {
    setCountLabelFallback(t('savedCountReload'));
  }
}

/** @param {string | undefined} error */
function captureFailureHint(error) {
  const detail = String(error || '');
  if (detail.includes('content_script_unavailable')) {
    return t('saveFailedCapture');
  }
  if (detail.includes('unsupported page')) {
    return t('unsupportedPage');
  }
  if (detail.includes('capture failed') || detail.includes('capture payload empty')) {
    return t('saveFailedCaptureReload');
  }
  if (detail.includes('no response from extension background')) {
    return t('saveFailedTimeout');
  }
  return detail ? t('saveFailedWithDetail', detail) : t('saveFailedGeneric');
}

document.getElementById('save-current').addEventListener('click', async () => {
  const saveBtn = document.getElementById('save-current');
  if (saveBtn?.disabled) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    await showAlert(t('runOnSupportedPage'));
    return;
  }
  if (!detectCaptureAction(tab.url)) {
    showSaveStatus(t('unsupportedPage'), 'error');
    return;
  }

  clearSaveStatus();

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = t('saving');
  }

  try {
    debugLog('popup saveCurrentTab', { tabId: tab.id, url: tab.url });
    const saveRes = await send(
      'saveCurrentTab',
      { tabId: tab.id, activateTab: false },
      SAVE_MESSAGING_OPTIONS,
    );
    if (!saveRes?.success) {
      debugError('popup save failed', saveRes?.error);
      showSaveStatus(captureFailureHint(saveRes?.error), 'error');
      return;
    }

    debugLog('popup save ok', {
      clipId: saveRes.entry?.clipId,
      sunoCreatedAt: saveRes.entry?.sunoCreatedAt,
      count: saveRes.count,
    });

    const savedCount = saveRes.count ?? 1;
    const saveMessage =
      savedCount > 1
        ? t('saveMultiple', String(savedCount))
        : saveRes.isNew
          ? t('saveNew')
          : t('saveOverwrite');

    showSaveStatus(saveMessage, 'success');
    refreshCount();
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = t('saveCurrentPage');
    }
  }
});

document.getElementById('open-dashboard').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

applyPageI18n();
initMessageDialog();
refreshCount();
initTheme();
bindThemeToggle();
watchThemeChanges();
