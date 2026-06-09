import { t, getUiLocale } from './i18n.js';

/**
 * @param {string} [isoString]
 * @returns {string}
 */
export function formatEntryDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

  if (diffDays === 0) return t('dateToday');
  if (diffDays === 1) return t('dateYesterday');
  if (diffDays > 1 && diffDays < 7) return t('dateDaysAgo', diffDays);

  const locale = getUiLocale() === 'ja' ? 'ja-JP' : 'en-US';
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * @param {string} [isoString]
 * @returns {string}
 */
export function formatDateTimeFull(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * @param {string} [isoString]
 * @returns {string}
 */
export function formatListGenerationLabel(isoString) {
  if (!isoString) return '';
  const genLabel = formatEntryDate(isoString);
  const genFull = formatDateTimeFull(isoString);
  if (!genLabel || !genFull) return '';
  return t('generatedAtLabel', genLabel, genFull);
}

/**
 * @param {string} [isoString]
 * @returns {string}
 */
export function formatDateGroupHeader(isoString) {
  if (!isoString) return t('dateUnknown');
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return t('dateUnknown');

  const rel = formatEntryDate(isoString);
  const locale = getUiLocale() === 'ja' ? 'ja-JP' : 'en-US';
  const base = d.toLocaleDateString(locale, {
    year: 'numeric',
    month: getUiLocale() === 'ja' ? 'long' : 'short',
    day: 'numeric',
  });
  const today = t('dateToday');
  const yesterday = t('dateYesterday');
  if (rel === today || rel === yesterday || /days ago|日前/.test(rel)) {
    return `${base} (${rel})`;
  }
  return base;
}

/**
 * @param {string} [isoString]
 * @returns {string}
 */
export function dateGroupKey(isoString) {
  if (!isoString) return 'unknown';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
