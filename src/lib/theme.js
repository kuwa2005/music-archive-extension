const THEME_KEY = 'theme';

/** @returns {'dark' | 'light'} */
export function normalizeTheme(value) {
  return value === 'light' ? 'light' : 'dark';
}

/** @returns {Promise<'dark' | 'light'>} */
export async function getStoredTheme() {
  const result = await chrome.storage.local.get([THEME_KEY]);
  return normalizeTheme(result[THEME_KEY]);
}

/**
 * @param {'dark' | 'light'} theme
 */
export function applyTheme(theme) {
  const normalized = normalizeTheme(theme);
  document.documentElement.dataset.theme = normalized;
  updateThemeToggleUi(normalized);
}

/**
 * @param {'dark' | 'light'} theme
 */
export function updateThemeToggleUi(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const lit = theme === 'light';
  btn.classList.toggle('lit', lit);
  btn.setAttribute('aria-label', lit ? 'ダークモードに切替（電球を消灯）' : 'ライトモードに切替（電球を点灯）');
  btn.setAttribute('title', lit ? 'ダークモード' : 'ライトモード');
}

/** @returns {Promise<'dark' | 'light'>} */
export async function initTheme() {
  const theme = await getStoredTheme();
  applyTheme(theme);
  return theme;
}

/** @returns {Promise<'dark' | 'light'>} */
export async function toggleTheme() {
  const current = await getStoredTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  await chrome.storage.local.set({ [THEME_KEY]: next });
  applyTheme(next);
  return next;
}

export function bindThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    toggleTheme();
  });
}

export function watchThemeChanges() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[THEME_KEY]) return;
    applyTheme(normalizeTheme(changes[THEME_KEY].newValue));
  });
}
