/** @typedef {{ success?: boolean, error?: string }} ExtensionResponse */

export const BACKGROUND_TARGET = 'background';
export const BACKGROUND_PORT_NAME = 'ma-background';

const RETRYABLE_ERRORS = new Set([
  'unknown action',
  'no response from extension background',
]);

/**
 * @param {ExtensionResponse | undefined} res
 */
function isRetryableResponse(res) {
  return !res || (res.success === false && RETRYABLE_ERRORS.has(String(res.error || '')));
}

/**
 * @param {Record<string, unknown>} message
 * @returns {Promise<ExtensionResponse>}
 */
function sendViaRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'runtime messaging failed'));
        return;
      }
      resolve(response ?? { success: false, error: 'no response from extension background' });
    });
  });
}

/**
 * Port は Service Worker 専用で、content script の sendMessage 横取りを回避する。
 * @param {Record<string, unknown>} message
 * @returns {Promise<ExtensionResponse>}
 */
function sendViaBackgroundPort(message) {
  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const port = chrome.runtime.connect({ name: BACKGROUND_PORT_NAME });
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        port.disconnect();
      } catch {
        /* ignore */
      }
      fn(value);
    };

    const timer = setTimeout(
      () => finish(reject, new Error('no response from extension background')),
      15000,
    );

    port.onMessage.addListener(function onPortMessage(msg) {
      if (msg?.requestId !== requestId) return;
      port.onMessage.removeListener(onPortMessage);
      const { requestId: _rid, ...rest } = msg;
      finish(resolve, rest);
    });

    port.onDisconnect.addListener(() => {
      if (!settled && chrome.runtime.lastError) {
        finish(reject, new Error(chrome.runtime.lastError.message || 'port disconnected'));
      }
    });

    port.postMessage({ ...message, requestId });
  });
}

/**
 * @param {string} action
 * @param {Record<string, unknown>} [payload]
 * @param {{ retries?: number, retryDelayMs?: number }} [options]
 * @returns {Promise<ExtensionResponse>}
 */
export async function sendToBackground(action, payload = {}, options = {}) {
  const { retries = 2, retryDelayMs = 200 } = options;
  const message = { _target: BACKGROUND_TARGET, action, ...payload };
  /** @type {ExtensionResponse | undefined} */
  let last;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      last = await sendViaRuntimeMessage(message);
      if (!isRetryableResponse(last)) return last;
    } catch (err) {
      last = { success: false, error: String(err) };
      const retryable = /Receiving end does not exist|Could not establish connection|message port closed/i.test(
        String(err),
      );
      if (!retryable && !RETRYABLE_ERRORS.has(String(err))) throw err;
    }

    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
    }
  }

  try {
    return await sendViaBackgroundPort(message);
  } catch (portErr) {
    if (last) return last;
    throw portErr;
  }
}
