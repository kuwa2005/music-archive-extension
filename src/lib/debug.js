/**
 * 拡張機能全体のデバッグ出力 ON/OFF。
 * リリース直前に MA_DEBUG = false にする。
 */
export const MA_DEBUG = false;

const PREFIX = '[music-archive]';
const DETAIL_PREFIX = '[MA-DEBUG]';

/**
 * @param {string} scope
 * @param {...unknown} args
 */
export function debugLog(scope, ...args) {
  if (!MA_DEBUG) return;
  console.log(PREFIX, scope, ...args);
}

/**
 * @param {string} scope
 * @param {...unknown} args
 */
export function debugWarn(scope, ...args) {
  if (!MA_DEBUG) return;
  console.warn(PREFIX, scope, ...args);
}

/**
 * @param {string} scope
 * @param {...unknown} args
 */
export function debugError(scope, ...args) {
  if (!MA_DEBUG) return;
  console.error(PREFIX, scope, ...args);
}

/**
 * @param {string} scope
 * @param {...unknown} args
 */
export function debugInfo(scope, ...args) {
  if (!MA_DEBUG) return;
  console.info(PREFIX, scope, ...args);
}

/**
 * Suno DOM 診断向け（console で [MA-DEBUG] をフィルタ）。
 * @param {...unknown} args
 */
export function maDebug(...args) {
  if (!MA_DEBUG) return;
  console.log(DETAIL_PREFIX, ...args);
}

/**
 * @param {string} label
 * @param {() => void} fn
 */
export function debugGroup(label, fn) {
  if (!MA_DEBUG) {
    fn?.();
    return;
  }
  console.group(`${PREFIX} ${label}`);
  try {
    fn?.();
  } finally {
    console.groupEnd();
  }
}
