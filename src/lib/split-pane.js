export const SPLIT_STORAGE_KEY = 'dashboardSplitRatio';

/** 旧 grid 1.2fr : 1fr に相当 */
export const DEFAULT_SPLIT_RATIO = 1.2 / 2.2;

const MIN_RATIO = 0.22;
const MAX_RATIO = 0.78;

/**
 * @param {number} ratio
 * @returns {number}
 */
export function clampSplitRatio(ratio) {
  if (!Number.isFinite(ratio)) return DEFAULT_SPLIT_RATIO;
  return Math.max(MIN_RATIO, Math.min(MAX_RATIO, ratio));
}

/**
 * @param {number} ratio
 */
export function applySplitRatio(ratio) {
  const layout = document.querySelector('.layout');
  if (!layout) return;
  layout.style.setProperty('--split-ratio', String(clampSplitRatio(ratio)));
}

/** @returns {Promise<number>} */
export async function getStoredSplitRatio() {
  const result = await chrome.storage.local.get([SPLIT_STORAGE_KEY]);
  return clampSplitRatio(result[SPLIT_STORAGE_KEY] ?? DEFAULT_SPLIT_RATIO);
}

/**
 * @param {number} ratio
 */
export async function saveSplitRatio(ratio) {
  await chrome.storage.local.set({ [SPLIT_STORAGE_KEY]: clampSplitRatio(ratio) });
}

export function bindSplitResizer() {
  const layout = document.querySelector('.layout');
  const resizer = document.getElementById('layout-resizer');
  if (!layout || !resizer) return;

  /** @param {number} clientX */
  function ratioFromPointer(clientX) {
    const rect = layout.getBoundingClientRect();
    if (rect.width <= 0) return DEFAULT_SPLIT_RATIO;
    return clampSplitRatio((clientX - rect.left) / rect.width);
  }

  /** @param {PointerEvent} event */
  function onPointerMove(event) {
    applySplitRatio(ratioFromPointer(event.clientX));
  }

  /** @param {PointerEvent} event */
  function onPointerUp(event) {
    resizer.releasePointerCapture(event.pointerId);
    resizer.removeEventListener('pointermove', onPointerMove);
    resizer.removeEventListener('pointerup', onPointerUp);
    resizer.removeEventListener('pointercancel', onPointerUp);
    document.body.classList.remove('layout-resizing');
    saveSplitRatio(ratioFromPointer(event.clientX));
  }

  resizer.addEventListener('pointerdown', (event) => {
    if (window.matchMedia('(max-width: 900px)').matches) return;
    event.preventDefault();
    resizer.setPointerCapture(event.pointerId);
    document.body.classList.add('layout-resizing');
    applySplitRatio(ratioFromPointer(event.clientX));
    resizer.addEventListener('pointermove', onPointerMove);
    resizer.addEventListener('pointerup', onPointerUp);
    resizer.addEventListener('pointercancel', onPointerUp);
  });

  resizer.addEventListener('dblclick', () => {
    applySplitRatio(DEFAULT_SPLIT_RATIO);
    saveSplitRatio(DEFAULT_SPLIT_RATIO);
  });
}

/** @returns {Promise<void>} */
export async function initSplitPane() {
  applySplitRatio(await getStoredSplitRatio());
  bindSplitResizer();
}
