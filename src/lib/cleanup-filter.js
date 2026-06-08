/**
 * @typedef {Object} CleanupFilters
 * @property {boolean} [presetOlderThan]
 * @property {number} [olderThanDays]
 * @property {boolean} [presetUnlinked]
 * @property {boolean} [presetEmptyContent]
 * @property {boolean} [presetAll]
 * @property {import('../types.js').EntrySource} [source]
 * @property {string} [gptName]
 * @property {'any' | 'linked' | 'unlinked'} [linkStatus]
 * @property {'any' | 'empty' | 'has_content'} [contentStatus]
 * @property {string} [dateFrom]
 * @property {string} [dateTo]
 * @property {string} [keyword]
 * @property {boolean} [includeProtected]
 */

/**
 * @param {import('../types.js').Entry} entry
 * @returns {boolean}
 */
export function isEmptyContent(entry) {
  const lyrics = (entry.lyrics || '').trim();
  const style = (entry.stylePrompt || '').trim();
  return !lyrics && !style;
}

/**
 * @param {import('../types.js').Entry} entry
 * @param {number} days
 * @returns {boolean}
 */
export function isOlderThanDays(entry, days) {
  if (!days || days <= 0) return false;
  const t = new Date(entry.capturedAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now() - days * 86400000;
}

/**
 * @param {import('../types.js').Entry} entry
 * @param {Set<string>} linkedIds
 * @returns {boolean}
 */
export function isUnlinked(entry, linkedIds) {
  return !linkedIds.has(entry.id);
}

/**
 * @param {import('../types.js').Entry} entry
 * @param {CleanupFilters} filters
 * @param {Set<string>} linkedIds
 * @returns {boolean}
 */
function matchesPresets(entry, filters, linkedIds) {
  if (filters.presetAll) return true;

  const checks = [];
  if (filters.presetOlderThan) {
    checks.push(isOlderThanDays(entry, filters.olderThanDays ?? 90));
  }
  if (filters.presetUnlinked) {
    checks.push(isUnlinked(entry, linkedIds));
  }
  if (filters.presetEmptyContent) {
    checks.push(isEmptyContent(entry));
  }
  if (!checks.length) return true;
  return checks.some(Boolean);
}

/**
 * @param {import('../types.js').Entry} entry
 * @param {string} keyword
 * @returns {boolean}
 */
function matchesKeyword(entry, keyword) {
  const q = keyword.trim().toLowerCase();
  if (!q) return true;
  const hay = [entry.title, entry.lyrics, entry.stylePrompt, entry.gptName, entry.sourceUrl]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  return hay.includes(q);
}

/**
 * @param {import('../types.js').Entry[]} entries
 * @param {Set<string>} linkedIds
 * @param {CleanupFilters} filters
 * @returns {import('../types.js').Entry[]}
 */
export function filterEntriesForCleanup(entries, linkedIds, filters) {
  let rows = entries.filter((entry) => matchesPresets(entry, filters, linkedIds));

  if (filters.source) {
    rows = rows.filter((r) => r.source === filters.source);
  }
  if (filters.gptName?.trim()) {
    const g = filters.gptName.trim();
    rows = rows.filter((r) => (r.gptName || '').includes(g));
  }

  if (filters.linkStatus === 'linked') {
    rows = rows.filter((r) => linkedIds.has(r.id));
  } else if (filters.linkStatus === 'unlinked') {
    rows = rows.filter((r) => !linkedIds.has(r.id));
  }

  if (filters.contentStatus === 'empty') {
    rows = rows.filter((r) => isEmptyContent(r));
  } else if (filters.contentStatus === 'has_content') {
    rows = rows.filter((r) => !isEmptyContent(r));
  }

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    if (!Number.isNaN(from)) {
      rows = rows.filter((r) => new Date(r.capturedAt).getTime() >= from);
    }
  }
  if (filters.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59.999`).getTime();
    if (!Number.isNaN(to)) {
      rows = rows.filter((r) => new Date(r.capturedAt).getTime() <= to);
    }
  }

  rows = rows.filter((r) => matchesKeyword(r, filters.keyword || ''));

  if (!filters.includeProtected) {
    rows = rows.filter((r) => !r.protected);
  }

  return rows.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
}

/**
 * @param {import('../types.js').Entry[]} entries
 * @param {Set<string>} linkedIds
 * @param {Partial<CleanupFilters>} presetSlice
 * @returns {number}
 */
export function countPresetMatches(entries, linkedIds, presetSlice) {
  return filterEntriesForCleanup(entries, linkedIds, {
    includeProtected: false,
    ...presetSlice,
  }).length;
}
