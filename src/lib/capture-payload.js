import { coerceSunoCreatedAt } from './suno-created-at.js';

/**
 * content script の capture 応答から保存用ペイロードを取り出す。
 * @param {{ success?: boolean, data?: unknown, source?: string, sunoCreatedAt?: unknown } | null | undefined} response
 * @returns {unknown}
 */
export function unwrapCapturePayload(response) {
  if (!response || response.success === false) return null;

  /** @type {Record<string, unknown>|null} */
  let entry = null;
  if (response.data != null && typeof response.data === 'object' && !Array.isArray(response.data)) {
    entry = { ...(/** @type {Record<string, unknown>} */ (response.data)) };
  } else if (response.source) {
    const { success: _s, error: _e, ...rest } = response;
    entry = rest;
  }
  if (!entry) return null;

  return mergeSunoCreatedAtFields(entry, response);
}

/**
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} [request]
 * @returns {Record<string, unknown>}
 */
export function mergeSunoCreatedAtFields(base, request) {
  const fromBase = coerceSunoCreatedAt(base.sunoCreatedAt);
  if (fromBase) return { ...base, sunoCreatedAt: fromBase };
  const fromTop = coerceSunoCreatedAt(request?.sunoCreatedAt);
  if (fromTop) return { ...base, sunoCreatedAt: fromTop };
  return { ...base };
}

/**
 * upsert 直前に capture ペイロードを正規化する（メッセージ経由で欠落した sunoCreatedAt を復元）。
 * @param {unknown} raw
 * @param {Record<string, unknown>} [request]
 * @returns {Record<string, unknown>|unknown[]|null}
 */
export function prepareSaveEntry(raw, request) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return null;
  /** @type {Record<string, unknown>} */
  const entry = { ...(/** @type {Record<string, unknown>} */ (raw)) };
  if (!entry.source) return null;
  return mergeSunoCreatedAtFields(entry, request);
}

/**
 * saveEntry / saveCapturedData の request から upsert 用オブジェクトを解決する。
 * @param {Record<string, unknown>} request
 * @returns {unknown}
 */
export function resolveSavePayload(request) {
  const nested = request?.data ?? request?.entry ?? request?.captured;
  if (Array.isArray(nested)) return nested;
  if (nested && typeof nested === 'object' && nested.source) {
    return mergeSunoCreatedAtFields({ ...(/** @type {Record<string, unknown>} */ (nested)) }, request);
  }

  const {
    action: _action,
    _target: _target,
    requestId: _requestId,
    success: _success,
    error: _error,
    tabId: _tabId,
    activateTab: _activateTab,
    captured: _captured,
    data: _data,
    entry: _entry,
    ...flat
  } = request || {};

  if (flat.source) return mergeSunoCreatedAtFields(flat, request);
  return nested;
}
