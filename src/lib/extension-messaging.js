/** @typedef {{ success?: boolean, error?: string }} ExtensionResponse */

export const BACKGROUND_TARGET = 'background';
export const BACKGROUND_PORT_NAME = 'ma-background';

const RETRYABLE_ERRORS = new Set([
  'unknown action',
  'no response from extension background',
]);

const CONNECTION_ERROR_RE =
  /Receiving end does not exist|Could not establish connection|message port closed|Extension context invalidated|port disconnected/i;

/**
 * @param {unknown} err
 */
function errorMessage(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * @param {unknown} err
 */
function failureResponse(err) {
  return { success: false, error: errorMessage(err) };
}

/**
 * @param {string} msg
 */
function isConnectionError(msg) {
  return CONNECTION_ERROR_RE.test(msg);
}

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
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(failureResponse(chrome.runtime.lastError.message || 'runtime messaging failed'));
          return;
        }
        resolve(response ?? { success: false, error: 'no response from extension background' });
      });
    } catch (err) {
      resolve(failureResponse(err));
    }
  });
}

/**
 * Port は Service Worker 専用で、content script の sendMessage 横取りを回避する。
 * @param {Record<string, unknown>} message
 * @param {number} [timeoutMs]
 * @returns {Promise<ExtensionResponse>}
 */
function sendViaBackgroundPort(message, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let port;
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        port?.disconnect();
      } catch {
        /* ignore */
      }
      resolve(value);
    };

    const timer = setTimeout(
      () => finish({ success: false, error: 'no response from extension background' }),
      timeoutMs,
    );

    try {
      port = chrome.runtime.connect({ name: BACKGROUND_PORT_NAME });
    } catch (err) {
      finish(failureResponse(err));
      return;
    }

    port.onMessage.addListener(function onPortMessage(msg) {
      if (msg?.requestId !== requestId) return;
      port.onMessage.removeListener(onPortMessage);
      const { requestId: _rid, ...rest } = msg;
      finish(rest);
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      const msg =
        chrome.runtime.lastError?.message || 'port disconnected before response';
      finish(failureResponse(msg));
    });

    try {
      port.postMessage({ ...message, requestId });
    } catch (err) {
      finish(failureResponse(err));
    }
  });
}

/**
 * Service Worker のコールドスタート向けに ping で起こす。
 * @param {number} retryDelayMs
 */
async function wakeBackground(retryDelayMs) {
  for (let i = 0; i < 2; i++) {
    const res = await sendViaRuntimeMessage({
      _target: BACKGROUND_TARGET,
      action: 'ping',
    });
    if (res?.success) return;
    if (i < 1) {
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
}

/**
 * @param {string} action
 * @param {Record<string, unknown>} [payload]
 * @param {{ retries?: number, retryDelayMs?: number, wake?: boolean, timeoutMs?: number }} [options]
 * @returns {Promise<ExtensionResponse>}
 */
export async function sendToBackground(action, payload = {}, options = {}) {
  const { retries = 4, retryDelayMs = 250, wake = true, timeoutMs = 10000 } = options;
  const message = { _target: BACKGROUND_TARGET, action, ...payload };
  /** @type {ExtensionResponse} */
  let last = { success: false, error: 'no response from extension background' };

  if (wake && action !== 'ping') {
    await wakeBackground(retryDelayMs);
    await new Promise((r) => setTimeout(r, 50));
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await sendViaRuntimeMessage(message);
    const shouldRetry =
      isRetryableResponse(last) || isConnectionError(String(last.error || ''));
    if (!shouldRetry) return last;

    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
    }
  }

  const portRes = await sendViaBackgroundPort(message, timeoutMs);
  const portShouldRetry =
    isRetryableResponse(portRes) || isConnectionError(String(portRes.error || ''));
  if (!portShouldRetry) return portRes;

  return portRes.error ? portRes : last;
}
