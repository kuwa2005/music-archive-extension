/**
 * Chrome extension i18n helpers (en + ja only).
 * Browser UI language via chrome.i18n; ja if getUILanguage starts with "ja", else en.
 */

/** @returns {'en' | 'ja'} */
export function getUiLocale() {
  const lang = chrome.i18n?.getUILanguage?.() || 'en';
  return lang.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

/**
 * @param {string} key
 * @param {...(string|number)} substitutions
 * @returns {string}
 */
export function t(key, ...substitutions) {
  const subs = substitutions.map(String);
  const message = chrome.i18n.getMessage(key, subs);
  return message || key;
}

/**
 * Apply data-i18n* attributes under root (popup / dashboard static HTML).
 * @param {ParentNode} [root]
 */
export function applyPageI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) el.setAttribute('aria-label', t(key));
  });
  root.querySelectorAll('[data-i18n-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-label');
    if (key) el.setAttribute('label', t(key));
  });
  const docTitleKey = document.documentElement.getAttribute('data-i18n-doc-title');
  if (docTitleKey) {
    document.title = t(docTitleKey);
  }
  document.documentElement.lang = getUiLocale();
}
