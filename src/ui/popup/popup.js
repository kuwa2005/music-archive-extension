import { initTheme, bindThemeToggle, watchThemeChanges } from '../../lib/theme.js';
import { sendToBackground } from '../../lib/extension-messaging.js';
import { initMessageDialog, showAlert } from '../../lib/dialog.js';

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

function detectCaptureAction(url) {
  if (/suno\.com\/song\//i.test(url)) return 'captureSunoSong';
  if (/suno\.com\/(create|playlist|me)/i.test(url)) return 'captureSunoList';
  if (
    /chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|copilot\.com|perplexity\.ai|poe\.com/i.test(
      url,
    )
  ) {
    return 'captureAI';
  }
  return null;
}

document.getElementById('save-current').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    await showAlert('対応ページ（Suno / 主要AI）で実行してください');
    return;
  }
  const captureAction = detectCaptureAction(tab.url);
  if (!captureAction) {
    await showAlert('このページは未対応です');
    return;
  }
  const response = await chrome.tabs.sendMessage(tab.id, { action: captureAction });
  if (!response?.success) {
    await showAlert('取得に失敗しました。ページを再読み込みしてください');
    return;
  }
  if (Array.isArray(response.data)) {
    await send('saveEntries', { data: response.data });
    await showAlert(`${response.data.length} 件を保存しました`);
  } else {
    await send('saveEntry', { data: response.data });
    await showAlert('保存しました');
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
