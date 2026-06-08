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

  if (diffDays === 0) return '今日';
  if (diffDays === 1) return '昨日';
  if (diffDays > 1 && diffDays < 7) return `${diffDays}日前`;

  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) return `${m}月${day}日`;
  return `${d.getFullYear()}年${m}月${day}日`;
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
export function formatDateGroupHeader(isoString) {
  if (!isoString) return '日付不明';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '日付不明';

  const rel = formatEntryDate(isoString);
  const base = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  if (rel === '今日' || rel === '昨日' || /^\d+日前$/.test(rel)) {
    return `${base}（${rel}）`;
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
