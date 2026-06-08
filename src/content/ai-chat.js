import { detectPlatform } from '../lib/ai-platforms.js';

/**
 * @returns {Partial<import('../types.js').Entry>|null}
 */
function extractCurrentPlatformData() {
  const platform = detectPlatform();
  if (!platform) return null;
  return platform.extract();
}

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
