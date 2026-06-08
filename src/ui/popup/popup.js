import { initTheme, bindThemeToggle, watchThemeChanges } from '../../lib/theme.js';
import { sendToBackground } from '../../lib/extension-messaging.js';

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

async function loadSettings() {
  try {
    const res = await send('getSettings', {}, INIT_MESSAGING_OPTIONS);
    if (res?.success === false) return;
    const s = res?.settings || {};
    document.getElementById('auto-suno').checked = !!s.autoSaveSuno;
    document.getElementById('auto-ai').checked = !!(s.autoSaveAI ?? s.autoSaveChatGPT);
    document.getElementById('auto-list').checked = !!s.autoSaveList;
  } catch {
    /* チェックボックスは HTML 既定値のまま */
  }
}

async function saveSetting(key, value) {
  const patch = { [key]: value };
  if (key === 'autoSaveAI') patch.autoSaveChatGPT = value;
  await send('saveSettings', { settings: patch });
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
    alert('対応ページ（Suno / 主要AI）で実行してください');
    return;
  }
  const captureAction = detectCaptureAction(tab.url);
  if (!captureAction) {
    alert('このページは未対応です');
    return;
  }
  const response = await chrome.tabs.sendMessage(tab.id, { action: captureAction });
  if (!response?.success) {
    alert('取得に失敗しました。ページを再読み込みしてください');
    return;
  }
  if (Array.isArray(response.data)) {
    await send('saveEntries', { data: response.data });
    alert(`${response.data.length} 件を保存しました`);
  } else {
    await send('saveEntry', { data: response.data });
    alert('保存しました');
  }
  refreshCount();
});

document.getElementById('open-dashboard').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('auto-suno').addEventListener('change', (e) => {
  saveSetting('autoSaveSuno', e.target.checked);
});
document.getElementById('auto-ai').addEventListener('change', (e) => {
  saveSetting('autoSaveAI', e.target.checked);
});
document.getElementById('auto-list').addEventListener('change', (e) => {
  saveSetting('autoSaveList', e.target.checked);
});

refreshCount();
loadSettings();
initTheme();
bindThemeToggle();
watchThemeChanges();
