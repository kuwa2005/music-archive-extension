import { initTheme, bindThemeToggle, watchThemeChanges } from '../../lib/theme.js';
import { sendToBackground } from '../../lib/extension-messaging.js';
import { initMessageDialog, showAlert } from '../../lib/dialog.js';
import { showTabDialog } from '../../lib/tab-dialog.js';
import { detectCaptureAction } from '../../lib/capture-actions.js';

const INIT_MESSAGING_OPTIONS = { retries: 5, retryDelayMs: 300 };

function send(action, payload = {}, options = {}) {
  return sendToBackground(action, payload, options);
}

function setCountLabelFallback(message = '保存件数: 取得できません') {
  const el = document.getElementById('count-label');
  if (el) el.textContent = message;
}

async function refreshCount() {
  try {
    const res = await send('countEntries', {}, INIT_MESSAGING_OPTIONS);
    if (res?.success === false) {
      setCountLabelFallback('保存件数: 取得できません（再読み込み）');
      return;
    }
    setCountLabelFallback(`保存件数: ${res?.count ?? 0} 件`);
  } catch {
    setCountLabelFallback('保存件数: 取得できません（再読み込み）');
  }
}

/**
 * 対応タブ上ではビューポート中央のモーダル、それ以外はポップアップ内に表示。
 * @param {number | undefined} tabId
 * @param {string} message
 */
async function alertUser(tabId, message) {
  if (tabId) {
    const { shown } = await showTabDialog(tabId, message);
    if (shown) return;
  }
  await showAlert(message);
}

function detectCaptureActionForPopup(url) {
  return detectCaptureAction(url);
}

document.getElementById('save-current').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    await alertUser(undefined, '対応ページ（Suno / 主要AI）で実行してください');
    return;
  }
  if (!detectCaptureActionForPopup(tab.url)) {
    await alertUser(tab.id, 'このページは未対応です');
    return;
  }
  const res = await send('saveCurrentTab', { tabId: tab.id });
  if (!res?.success) {
    await alertUser(tab.id, '取得に失敗しました。ページを再読み込みしてください');
    return;
  }
  refreshCount();
});

document.getElementById('open-dashboard').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

initMessageDialog();
refreshCount();
initTheme();
bindThemeToggle();
watchThemeChanges();
