import { detectPlatform } from '../lib/ai-platforms.js';

/**
 * @returns {Partial<import('../types.js').Entry>|null}
 */
function extractCurrentPlatformData() {
  const platform = detectPlatform();
  if (!platform) return null;
  return platform.extract();
}

function shouldAutoCapture(platform) {
  if (!platform) return false;
  if (platform.id === 'perplexity') {
    return /\/search\/|\/thread\//i.test(window.location.pathname);
  }
  if (platform.id === 'poe') {
    return /\/chat\//i.test(window.location.pathname);
  }
  return !!platform.parseConversationId();
}

async function autoCaptureIfEnabled() {
  const platform = detectPlatform();
  if (!shouldAutoCapture(platform)) return;

  try {
    const res = await chrome.runtime.sendMessage({ action: 'getSettings' });
    const autoSave =
      res?.settings?.autoSaveAI ??
      res?.settings?.autoSaveChatGPT ??
      false;
    if (!autoSave) return;

    const data = extractCurrentPlatformData();
    if (!data || (!data.lyrics && !data.title)) return;
    await chrome.runtime.sendMessage({ action: 'saveEntry', data });
  } catch {
    /* ignore */
  }
}

let debounce = null;
const mo = new MutationObserver(() => {
  clearTimeout(debounce);
  debounce = setTimeout(autoCaptureIfEnabled, 2000);
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?._target === 'background') return false;
  if (request.action === 'captureAI' || request.action === 'captureChatGPT') {
    const data = extractCurrentPlatformData();
    if (!data) {
      sendResponse({ success: false, error: 'unsupported platform' });
      return true;
    }
    sendResponse({ success: true, data });
    return true;
  }
  return false;
});

function startObservers() {
  if (document.body) {
    mo.observe(document.body, { childList: true, subtree: true });
  }
  setTimeout(autoCaptureIfEnabled, 2500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObservers);
} else {
  startObservers();
}
