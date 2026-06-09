import { snippetAround, highlightSnippet } from '../../lib/normalize.js';
import {
  formatEntryDate,
  formatDateTimeFull,
  formatDateGroupHeader,
  formatListGenerationLabel,
  dateGroupKey,
} from '../../lib/date-format.js';
import { getAiLabel, isAiSource } from '../../lib/ai-sources.js';
import { getSunoSourceLabel, isSunoEntrySource } from '../../lib/suno-sources.js';
import { initTheme, bindThemeToggle, watchThemeChanges } from '../../lib/theme.js';
import { initSplitPane } from '../../lib/split-pane.js';
import {
  buildTreeGroupsForMode,
  getStoredViewMode,
  getViewModeLabel,
  isTreeViewMode,
  normalizeViewMode,
  saveViewMode,
} from '../../lib/result-view-mode.js';
import { sendToBackground } from '../../lib/extension-messaging.js';
import { initMessageDialog, showAlert, showConfirm } from '../../lib/dialog.js';
import { applyPageI18n, t } from '../../lib/i18n.js';
import { debugLog } from '../../lib/debug.js';

/** @type {import('../../types.js').Entry[]} */
let allResults = [];
/** @type {Set<string>} */
let linkedEntryIds = new Set();
/** @type {import('../../types.js').Link[]} */
let allLinks = [];
/** @type {import('../../types.js').Entry|null} */
let selectedEntry = null;
/** @type {Set<string>} */
const selectedEntryIds = new Set();
/** @type {import('../../lib/result-view-mode.js').ResultViewMode} */
let viewMode = 'cards';
/** @type {ReturnType<typeof setTimeout>|undefined} */
let linkStatusTimer;
/** @type {Set<string>} */
const collapsedTreeGroups = new Set();
let contextMenuOpen = false;
/** @type {'multi' | 'single'} */
let contextMenuMode = 'multi';
/** @type {string | null} */
let contextMenuTargetId = null;

function send(action, payload = {}) {
  return sendToBackground(action, payload);
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function sourceLabel(source) {
  if (isSunoEntrySource(source)) return getSunoSourceLabel(source);
  if (isAiSource(source)) return getAiLabel(source);
  return source;
}

function badgeClass(source) {
  if (isAiSource(source)) return 'chatgpt';
  return 'suno';
}

async function runSearch() {
  const query = document.getElementById('search-input').value.trim();
  const source = document.getElementById('filter-source').value;
  const gptName = document.getElementById('filter-gpt').value.trim();
  const linkedOnly = document.getElementById('filter-linked').checked;

  const res = await send('search', {
    options: { query, source: source || undefined, gptName: gptName || undefined, linkedOnly },
  });
  allResults = res?.results || [];
  linkedEntryIds = new Set(res?.linkedIds || []);
  allLinks = res?.links || [];
  renderResults(query);
}

function applyViewModeClass() {
  const list = document.getElementById('result-list');
  list.classList.remove(
    'view-cards',
    'view-compact',
    'view-list',
    'view-tree',
    'view-tree-links',
  );
  list.classList.add(`view-${viewMode}`);
}

function syncViewModeButtons() {
  document.querySelectorAll('#view-mode-switcher [data-view-mode]').forEach((btn) => {
    const mode = btn.getAttribute('data-view-mode');
    const active = mode === viewMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
    const label = getViewModeLabel(/** @type {import('../../lib/result-view-mode.js').ResultViewMode} */ (mode));
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);
  });
}

/**
 * @param {import('../../types.js').Entry} entry
 * @returns {string}
 */
function lyricsListSnippet(entry) {
  const raw = entry.lyrics?.trim();
  if (!raw) return '';
  return raw.replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * 一覧表示の日時列（Suno は生成日時、それ以外は保存日時）。
 * @param {import('../../types.js').Entry} entry
 * @returns {string}
 */
function buildListDateHtml(entry) {
  if (entry.source === 'suno_song' && entry.sunoCreatedAt) {
    const genText = formatListGenerationLabel(entry.sunoCreatedAt);
    if (!genText) return '';
    return `<time class="result-list-date" datetime="${escapeHtml(entry.sunoCreatedAt)}" title="${escapeHtml(genText)}">${escapeHtml(genText)}</time>`;
  }
  const savedAt = entry.capturedAt;
  if (!savedAt) return '';
  const label = formatEntryDate(savedAt);
  if (!label) return '';
  const savedTitle = `${t('savedAtPrefix')} ${formatDateTimeFull(savedAt)}`;
  return `<time class="result-list-date" datetime="${escapeHtml(savedAt)}" title="${escapeHtml(savedTitle)}">${escapeHtml(label)}</time>`;
}

/**
 * @param {import('../../types.js').Entry} entry
 * @param {string} query
 * @returns {string}
 */
function buildListLyricsHtml(entry, query) {
  const lyricsText = lyricsListSnippet(entry);
  if (!lyricsText) return '';
  return `<div class="result-list-fill"><span class="result-list-lyrics">${highlightSnippet(lyricsText, query, escapeHtml)}</span></div>`;
}

/**
 * @param {import('../../types.js').Entry} entry
 * @param {string} query
 * @returns {string}
 */
function buildResultItemInnerHtml(entry, query) {
  const snippet = snippetAround(entry.lyrics || entry.stylePrompt || entry.title, query);
  const isListView = viewMode === 'list';
  const isLinked = linkedEntryIds.has(entry.id);
  const dateLabel = formatEntryDate(entry.capturedAt);
  const dateTitle = formatDateTimeFull(entry.capturedAt);
  const updatedTitle =
    entry.updatedAt && entry.updatedAt !== entry.capturedAt
      ? ` · ${t('updatedPrefix')} ${formatDateTimeFull(entry.updatedAt)}`
      : '';
  const genLabel =
    entry.source === 'suno_song' && entry.sunoCreatedAt
      ? formatEntryDate(entry.sunoCreatedAt)
      : '';
  const genTitle =
    entry.source === 'suno_song' && entry.sunoCreatedAt
      ? ` · ${t('generatedPrefix')} ${formatDateTimeFull(entry.sunoCreatedAt)}`
      : '';
  const showGenInDates = !isListView && genLabel;
  const listDateHtml = isListView ? buildListDateHtml(entry) : '';
  const listLyricsHtml = isListView ? buildListLyricsHtml(entry, query) : '';

  return `
    <div class="result-head">
      <div class="result-badges">
        <span class="badge ${badgeClass(entry.source)}">${sourceLabel(entry.source)}</span>
        ${entry.gptName ? `<span class="badge">${escapeHtml(entry.gptName)}</span>` : ''}
        ${isLinked ? `<span class="badge linked" title="${escapeHtml(t('linkedBadge'))}">🔗 ${escapeHtml(t('linkedBadge'))}</span>` : ''}
        ${entry.protected ? `<span class="badge protected" title="${escapeHtml(t('protectedBadge'))}">🔒</span>` : ''}
      </div>
      ${isListView ? '' : `<div class="result-dates">
        ${showGenInDates ? `<time class="result-date result-date-generated" datetime="${escapeHtml(entry.sunoCreatedAt || '')}" title="${escapeHtml(t('generatedPrefix'))} ${escapeHtml(formatDateTimeFull(entry.sunoCreatedAt))}">${escapeHtml(genLabel)}</time>` : ''}
        ${dateLabel ? `<time class="result-date" datetime="${escapeHtml(entry.capturedAt || '')}" title="${escapeHtml(t('savedAtPrefix'))} ${escapeHtml(dateTitle)}${escapeHtml(updatedTitle)}${escapeHtml(genTitle)}">${escapeHtml(dateLabel)}</time>` : ''}
      </div>`}
    </div>
    ${listDateHtml}
    <div class="title">${escapeHtml(entry.title || t('untitled'))}</div>
    ${listLyricsHtml}
    <div class="snippet">${highlightSnippet(snippet, query, escapeHtml)}</div>
  `;
}

/**
 * @param {string} entryId
 * @returns {string}
 */
function resultItemClassName(entryId) {
  let cls = 'result-item';
  if (selectedEntry?.id === entryId) cls += ' active';
  if (selectedEntryIds.has(entryId)) cls += ' multi-selected';
  return cls;
}

function updateSelectionHighlights() {
  document.querySelectorAll('#result-list .result-item').forEach((li) => {
    const id = li.dataset.id;
    if (!id) return;
    li.className = resultItemClassName(id);
  });
  updateMultiSelectBar();
}

function updateMultiSelectBar() {
  const count = selectedEntryIds.size;
  if (count < 2) {
    closeContextMenu();
    return;
  }
  updateContextMenuState();
}

function updateContextMenuState() {
  const linkBtn = document.getElementById('context-menu-link-btn');
  const unlinkBtn = document.getElementById('context-menu-unlink-btn');
  const unlinkAllBtn = document.getElementById('context-menu-unlink-all-btn');
  const clearBtn = document.getElementById('context-menu-clear-btn');
  if (!linkBtn || !unlinkBtn || !unlinkAllBtn || !clearBtn) return;

  if (contextMenuMode === 'single' && contextMenuTargetId) {
    linkBtn.hidden = true;
    unlinkBtn.hidden = true;
    unlinkAllBtn.hidden = false;
    unlinkAllBtn.disabled = !linkedEntryIds.has(contextMenuTargetId);
    unlinkAllBtn.title = t('contextMenuUnlinkAllTitle');
    clearBtn.hidden = selectedEntryIds.size === 0;
    return;
  }

  linkBtn.hidden = false;
  unlinkBtn.hidden = false;
  unlinkAllBtn.hidden = true;

  const ids = [...selectedEntryIds];
  const { ai, suno } = partitionEntriesByLinkRole(ids);
  const canLink = ai.length > 0 && suno.length > 0;
  linkBtn.disabled = !canLink;
  linkBtn.title = canLink ? t('contextMenuLinkTitle') : t('contextMenuLinkNeedBoth');

  const betweenCount = countLinksBetween(ids);
  unlinkBtn.disabled = betweenCount === 0;
  unlinkBtn.title =
    betweenCount > 0
      ? t('contextMenuUnlinkTitle', String(betweenCount), String(ids.length))
      : t('contextMenuUnlinkNone');

  clearBtn.hidden = false;
}

function closeContextMenu() {
  const menu = document.getElementById('result-context-menu');
  if (menu) menu.hidden = true;
  contextMenuOpen = false;
  contextMenuMode = 'multi';
  contextMenuTargetId = null;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {'multi' | 'single'} [mode]
 * @param {string | null} [targetId]
 */
function openContextMenu(x, y, mode = 'multi', targetId = null) {
  const menu = document.getElementById('result-context-menu');
  if (!menu) return;
  if (mode === 'multi' && selectedEntryIds.size < 2) return;
  if (mode === 'single' && (!targetId || !linkedEntryIds.has(targetId))) return;

  contextMenuMode = mode;
  contextMenuTargetId = targetId;
  updateContextMenuState();
  menu.hidden = false;
  contextMenuOpen = true;
  menu.style.visibility = 'hidden';
  menu.style.left = '0';
  menu.style.top = '0';

  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const left = Math.min(Math.max(8, x), window.innerWidth - mw - 8);
  const top = Math.min(Math.max(8, y), window.innerHeight - mh - 8);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = '';
}

/**
 * @param {string[]} ids
 * @returns {{ ai: import('../../types.js').Entry[], suno: import('../../types.js').Entry[] }}
 */
function partitionEntriesByLinkRole(ids) {
  /** @type {import('../../types.js').Entry[]} */
  const ai = [];
  /** @type {import('../../types.js').Entry[]} */
  const suno = [];
  for (const id of ids) {
    const entry = allResults.find((e) => e.id === id);
    if (!entry) continue;
    if (isAiSource(entry.source)) ai.push(entry);
    else if (isSunoEntrySource(entry.source)) suno.push(entry);
  }
  return { ai, suno };
}

/**
 * @param {string} aiId
 * @param {string} sunoId
 */
function linkPairExists(aiId, sunoId) {
  return allLinks.some((l) => l.chatgptEntryId === aiId && l.sunoEntryId === sunoId);
}

/**
 * @param {string[]} ids
 * @returns {number}
 */
function countLinksBetween(ids) {
  const idSet = new Set(ids);
  return allLinks.filter((l) => idSet.has(l.chatgptEntryId) && idSet.has(l.sunoEntryId)).length;
}

/**
 * @param {string} message
 * @param {boolean} [isError]
 */
function showLinkStatus(message, isError = false) {
  const el = document.getElementById('link-action-status');
  if (!el) return;
  clearTimeout(linkStatusTimer);
  el.textContent = message;
  el.classList.toggle('is-error', isError);
  el.hidden = false;
  linkStatusTimer = setTimeout(() => {
    el.hidden = true;
  }, 4000);
}

function clearMultiSelection(updateUi = true) {
  if (selectedEntryIds.size === 0) return;
  selectedEntryIds.clear();
  closeContextMenu();
  debugLog('dashboard', 'multi-select cleared');
  if (updateUi) updateSelectionHighlights();
}

/**
 * @param {string} id
 */
function toggleMultiSelect(id) {
  if (selectedEntryIds.size === 0 && selectedEntry?.id && selectedEntry.id !== id) {
    selectedEntryIds.add(selectedEntry.id);
  }
  if (selectedEntryIds.has(id)) {
    selectedEntryIds.delete(id);
  } else {
    selectedEntryIds.add(id);
  }
  debugLog('dashboard', 'multi-select', [...selectedEntryIds]);
  updateSelectionHighlights();
}

/**
 * @param {import('../../types.js').Entry} entry
 * @param {MouseEvent} event
 */
function handleResultItemClick(entry, event) {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    toggleMultiSelect(entry.id);
    return;
  }
  clearMultiSelection(false);
  selectEntry(entry.id);
}

/**
 * @param {import('../../types.js').Entry} entry
 * @param {string} query
 * @returns {HTMLLIElement}
 */
function createResultItemLi(entry, query) {
  const li = document.createElement('li');
  li.className = resultItemClassName(entry.id);
  li.dataset.id = entry.id;
  li.innerHTML = buildResultItemInnerHtml(entry, query);
  li.addEventListener('click', (e) => handleResultItemClick(entry, e));
  return li;
}

/**
 * @param {import('../../lib/result-view-mode.js').TreeGroup} group
 * @param {string} query
 * @param {boolean} nested
 * @returns {HTMLLIElement}
 */
function createTreeGroupLi(group, query, nested = false) {
  const li = document.createElement('li');
  const childCount =
    group.children?.reduce((sum, c) => sum + c.entries.length, 0) ?? group.entries.length;
  const isCollapsed = collapsedTreeGroups.has(group.id);

  li.className = 'result-tree-group' + (nested ? ' result-tree-nested' : '') + (isCollapsed ? ' collapsed' : '');
  li.dataset.groupId = group.id;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'result-tree-toggle';
  toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
  toggle.textContent = `${group.label} (${childCount})`;
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (collapsedTreeGroups.has(group.id)) {
      collapsedTreeGroups.delete(group.id);
    } else {
      collapsedTreeGroups.add(group.id);
    }
    renderResults(document.getElementById('search-input').value.trim());
  });

  const childUl = document.createElement('ul');
  childUl.className = 'result-tree-children';

  if (group.children?.length) {
    for (const child of group.children) {
      childUl.appendChild(createTreeGroupLi(child, query, true));
    }
  } else {
    for (const entry of group.entries) {
      childUl.appendChild(createResultItemLi(entry, query));
    }
  }

  li.appendChild(toggle);
  li.appendChild(childUl);
  return li;
}

function renderTreeResults(query) {
  const list = document.getElementById('result-list');
  const groups = buildTreeGroupsForMode(viewMode, allResults, linkedEntryIds);
  for (const group of groups) {
    if (group.flat && group.entries.length) {
      for (const entry of group.entries) {
        list.appendChild(createResultItemLi(entry, query));
      }
    } else {
      list.appendChild(createTreeGroupLi(group, query));
    }
  }
}

function renderFlatResults(query) {
  const list = document.getElementById('result-list');
  const showGroups = viewMode === 'cards' && shouldShowDateGroups(allResults);
  let lastGroupKey = '';

  for (const entry of allResults) {
    const groupKey = dateGroupKey(entry.capturedAt);
    if (showGroups && groupKey !== lastGroupKey) {
      lastGroupKey = groupKey;
      const header = document.createElement('li');
      header.className = 'result-date-group';
      header.textContent = formatDateGroupHeader(entry.capturedAt);
      list.appendChild(header);
    }
    list.appendChild(createResultItemLi(entry, query));
  }
}

function shouldShowDateGroups(entries) {
  const keys = new Set(entries.map((e) => dateGroupKey(e.capturedAt)));
  keys.delete('unknown');
  return keys.size > 1;
}

function renderResults(query) {
  const list = document.getElementById('result-list');
  list.innerHTML = '';
  document.getElementById('result-count').textContent = `(${allResults.length})`;
  applyViewModeClass();

  if (isTreeViewMode(viewMode)) {
    renderTreeResults(query);
  } else {
    renderFlatResults(query);
  }
  updateMultiSelectBar();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {string} url
 */
function openInNewTab(url) {
  if (!url) return;
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url, active: true });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * @param {string} url
 * @param {string} label
 * @param {string} [className]
 * @returns {HTMLAnchorElement}
 */
function createExternalLink(url, label, className = 'external-link') {
  const a = document.createElement('a');
  a.href = url;
  a.textContent = label;
  a.className = className;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openInNewTab(url);
  });
  return a;
}

/** @param {string} fullTitle */
function splitSongTitleAndArtist(fullTitle) {
  const m = fullTitle.match(/^(.+?)\s+by\s+(.+)$/i);
  if (!m) return { songTitle: fullTitle, artistSuffix: '' };
  return { songTitle: m[1], artistSuffix: ` by ${m[2]}` };
}

/**
 * @param {HTMLElement} el
 * @param {import('../../types.js').Entry} entry
 */
function renderDetailTitle(el, entry) {
  el.textContent = '';
  const fullTitle = entry.title?.trim() || t('untitled');
  if (!entry.sourceUrl) {
    el.textContent = fullTitle;
    return;
  }
  const { songTitle, artistSuffix } = splitSongTitleAndArtist(fullTitle);
  el.appendChild(createExternalLink(entry.sourceUrl, songTitle));
  if (artistSuffix) el.appendChild(document.createTextNode(artistSuffix));
}

/**
 * @param {import('../../types.js').Entry} entry
 * @returns {string}
 */
function compactLinkLabel(entry) {
  if (entry.title?.trim()) return entry.title.trim();
  const url = entry.sourceUrl || '';
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname === '/' ? '' : u.pathname;
    const compact = host + path;
    return compact.length > 42 ? `${compact.slice(0, 40)}…` : compact;
  } catch {
    return url.length > 42 ? `${url.slice(0, 40)}…` : url;
  }
}

function updateDetailProtectBtn(entry) {
  const btn = document.getElementById('detail-protect-btn');
  if (!btn) return;
  const on = !!entry?.protected;
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute(
    'aria-label',
    on ? t('protectDisable') : t('protectEnable'),
  );
  btn.title = on ? t('protectActive') : t('protectEnable');
}

async function createLinksFromSelection() {
  const ids = [...selectedEntryIds];
  if (ids.length < 2) return;

  closeContextMenu();

  const { ai, suno } = partitionEntriesByLinkRole(ids);
  if (!ai.length || !suno.length) {
    showLinkStatus(t('linkNeedBothTypes'), true);
    return;
  }

  let created = 0;
  let skipped = 0;
  for (const a of ai) {
    for (const s of suno) {
      if (linkPairExists(a.id, s.id)) {
        skipped++;
        continue;
      }
      await send('createLink', { chatgptEntryId: a.id, sunoEntryId: s.id });
      created++;
    }
  }

  clearMultiSelection(false);
  await runSearch();
  if (selectedEntry) await renderLinked(selectedEntry.id);

  if (created === 0 && skipped > 0) {
    showLinkStatus(t('linkAllAlreadyLinked'));
  } else if (created > 0) {
    const skipNote = skipped > 0 ? t('linkSkippedNote', String(skipped)) : '';
    showLinkStatus(`${t('linkCreatedCount', String(created))}${skipNote}`);
  }
}

async function removeLinksFromSelection() {
  const ids = [...selectedEntryIds];
  if (ids.length < 2) return;

  closeContextMenu();

  const betweenCount = countLinksBetween(ids);
  if (betweenCount === 0) {
    showLinkStatus(t('linkNoneBetween'), true);
    return;
  }

  const res = await send('deleteLinksBetween', { entryIds: ids });
  const deleted = res?.deleted ?? 0;

  clearMultiSelection(false);
  await runSearch();
  if (selectedEntry) await renderLinked(selectedEntry.id);

  if (deleted === 0) {
    showLinkStatus(t('linkNoneToRemove'), true);
  } else {
    showLinkStatus(t('linkRemovedCount', String(deleted)));
  }
}

async function removeAllLinksForContextEntry() {
  const entryId = contextMenuTargetId;
  if (!entryId) return;

  closeContextMenu();

  if (!linkedEntryIds.has(entryId)) {
    showLinkStatus(t('linkNoneOnEntry'), true);
    return;
  }

  const res = await send('deleteAllLinksForEntry', { entryId });
  const deleted = res?.deleted ?? 0;

  if (selectedEntryIds.has(entryId)) {
    selectedEntryIds.delete(entryId);
    updateSelectionHighlights();
  }

  await runSearch();
  if (selectedEntry?.id === entryId) await renderLinked(entryId);

  if (deleted === 0) {
    showLinkStatus(t('linkNoneToRemove'), true);
  } else {
    showLinkStatus(t('linkRemovedAllCount', String(deleted)));
  }
}

async function selectEntry(id) {
  const res = await send('getEntry', { entryId: id });
  selectedEntry = res?.entry || allResults.find((e) => e.id === id) || null;
  if (!selectedEntry) return;

  document.getElementById('detail-empty').hidden = true;
  document.getElementById('detail-content').hidden = false;
  renderDetailTitle(document.getElementById('detail-title'), selectedEntry);
  updateDetailProtectBtn(selectedEntry);

  const metaEl = document.getElementById('detail-meta');
  metaEl.textContent = '';
  const capturedLabel = formatEntryDate(selectedEntry.capturedAt);
  const capturedFull = formatDateTimeFull(selectedEntry.capturedAt);
  const metaParts = [sourceLabel(selectedEntry.source), selectedEntry.gptName].filter(Boolean);
  if (capturedLabel) {
    metaParts.push(`${capturedLabel}（${capturedFull}）`);
  }
  if (
    selectedEntry.updatedAt &&
    selectedEntry.updatedAt.slice(0, 16) !== selectedEntry.capturedAt?.slice(0, 16)
  ) {
    metaParts.push(`${t('updatedPrefix')} ${formatDateTimeFull(selectedEntry.updatedAt)}`);
  }
  if (selectedEntry.source === 'suno_song') {
    if (selectedEntry.sunoCreatedAt) {
      const genLabel = formatEntryDate(selectedEntry.sunoCreatedAt);
      const genFull = formatDateTimeFull(selectedEntry.sunoCreatedAt);
      metaParts.push(`${t('generatedPrefix')} ${genLabel} (${genFull})`);
    } else {
      metaParts.push(t('generatedUnknown'));
    }
  }
  if (metaParts.length) {
    metaEl.appendChild(document.createTextNode(metaParts.join(' · ')));
  }
  if (selectedEntry.sourceUrl) {
    const urlLine = document.createElement('span');
    urlLine.className = 'detail-meta-url';
    urlLine.appendChild(createExternalLink(selectedEntry.sourceUrl, selectedEntry.sourceUrl));
    metaEl.appendChild(urlLine);
  }

  const lyricsParts = [];
  if (selectedEntry.stylePrompt) lyricsParts.push(`[Style]\n${selectedEntry.stylePrompt}\n`);
  if (selectedEntry.lyrics) lyricsParts.push(selectedEntry.lyrics);
  document.getElementById('detail-lyrics').textContent = lyricsParts.join('\n') || t('noLyrics');

  await renderLinked(id);
  runSearch();
}

/**
 * @param {import('../../types.js').Entry[]} entries
 * @returns {import('../../types.js').Entry[]}
 */
function sortLinkedEntries(entries) {
  return [...entries].sort((a, b) => {
    const ta = a.capturedAt || '';
    const tb = b.capturedAt || '';
    if (ta !== tb) return tb.localeCompare(ta);
    return (a.title || '').localeCompare(b.title || '', 'ja');
  });
}

/**
 * @param {import('../../types.js').Entry} entry
 * @returns {HTMLElement}
 */
function createLinkedChip(entry) {
  const label = compactLinkLabel(entry);
  if (entry.sourceUrl) {
    const a = createExternalLink(entry.sourceUrl, label, 'linked-chip');
    a.title = entry.sourceUrl;
    return a;
  }
  const span = document.createElement('span');
  span.className = 'linked-chip linked-chip-static';
  span.textContent = label;
  span.title = label;
  return span;
}

/**
 * @param {HTMLUListElement} listEl
 * @param {import('../../types.js').Entry[]} entries
 */
function renderLinkedChipList(listEl, entries) {
  listEl.innerHTML = '';
  for (const e of entries) {
    const li = document.createElement('li');
    li.appendChild(createLinkedChip(e));
    listEl.appendChild(li);
  }
}

async function renderLinked(entryId) {
  const linked = await send('getLinked', { entryId });
  const chatUl = document.getElementById('linked-chatgpt');
  const sunoUl = document.getElementById('linked-suno');
  const chatRow = document.getElementById('linked-chatgpt-row');
  const sunoRow = document.getElementById('linked-suno-row');

  const chatEntries = sortLinkedEntries(
    (linked?.chatgpt || []).filter((e) => e.id !== entryId),
  );
  const sunoEntries = sortLinkedEntries((linked?.suno || []).filter((e) => e.id !== entryId));

  renderLinkedChipList(chatUl, chatEntries);
  renderLinkedChipList(sunoUl, sunoEntries);

  if (chatRow) chatRow.hidden = chatEntries.length === 0;
  if (sunoRow) sunoRow.hidden = sunoEntries.length === 0;
}

async function populateManualLinkSelects() {
  const chatRes = await send('search', { options: {} });
  const chatSelect = document.getElementById('manual-chatgpt');
  const sunoSelect = document.getElementById('manual-suno');
  chatSelect.innerHTML = `<option value="">${t('selectAiChat')}</option>`;
  sunoSelect.innerHTML = `<option value="">${t('selectSuno')}</option>`;

  for (const e of (chatRes?.results || []).filter((x) => isAiSource(x.source))) {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `[${getAiLabel(e.source)}] ${e.title || e.gptName || e.id}`;
    chatSelect.appendChild(opt);
  }
  for (const e of (chatRes?.results || []).filter((x) => isSunoEntrySource(x.source))) {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.title || e.sourceUrl;
    sunoSelect.appendChild(opt);
  }

  if (selectedEntry) {
    if (isAiSource(selectedEntry.source)) {
      chatSelect.value = selectedEntry.id;
    } else if (isSunoEntrySource(selectedEntry.source)) {
      sunoSelect.value = selectedEntry.id;
    }
  }
}

async function openManualLinkDialog() {
  await populateManualLinkSelects();
  document.getElementById('manual-link-dialog').hidden = false;
}

function closeManualLinkDialog() {
  document.getElementById('manual-link-dialog').hidden = true;
}

document.getElementById('search-input').addEventListener('input', debounce(runSearch, 250));
document.getElementById('filter-source').addEventListener('change', runSearch);
document.getElementById('filter-gpt').addEventListener('input', debounce(runSearch, 250));
document.getElementById('filter-linked').addEventListener('change', runSearch);

document.getElementById('view-mode-switcher').addEventListener('click', async (e) => {
  const btn = /** @type {HTMLElement|null} */ (e.target).closest('[data-view-mode]');
  if (!btn) return;
  const next = normalizeViewMode(btn.getAttribute('data-view-mode'));
  if (next === viewMode) return;
  viewMode = next;
  syncViewModeButtons();
  await saveViewMode(viewMode);
  renderResults(document.getElementById('search-input').value.trim());
});

document.getElementById('clear-selection-btn')?.addEventListener('click', () => {
  clearMultiSelection();
});

function bindResultContextMenu() {
  const resultsBody = document.querySelector('.results-body');
  const menu = document.getElementById('result-context-menu');
  if (!resultsBody || !menu) return;

  resultsBody.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.result-item');
    const clickedId = item?.dataset?.id;

    if (selectedEntryIds.size >= 2) {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, 'multi');
      return;
    }

    const singleTargetId =
      clickedId ||
      (selectedEntryIds.size === 1 ? [...selectedEntryIds][0] : null) ||
      (linkedEntryIds.has(selectedEntry?.id) ? selectedEntry.id : null);

    if (singleTargetId && linkedEntryIds.has(singleTargetId)) {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, 'single', singleTargetId);
      return;
    }

    closeContextMenu();
  });

  document.getElementById('context-menu-link-btn')?.addEventListener('click', () => {
    createLinksFromSelection();
  });
  document.getElementById('context-menu-unlink-btn')?.addEventListener('click', () => {
    removeLinksFromSelection();
  });
  document.getElementById('context-menu-unlink-all-btn')?.addEventListener('click', () => {
    removeAllLinksForContextEntry();
  });
  document.getElementById('context-menu-clear-btn')?.addEventListener('click', () => {
    clearMultiSelection();
  });

  document.addEventListener('click', (e) => {
    if (!contextMenuOpen) return;
    if (menu.contains(/** @type {Node} */ (e.target))) return;
    closeContextMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !contextMenuOpen) return;
    e.stopPropagation();
    closeContextMenu();
  }, true);

  window.addEventListener('blur', () => {
    closeContextMenu();
  });

  window.addEventListener('resize', () => {
    closeContextMenu();
  });

  document.addEventListener('scroll', () => {
    closeContextMenu();
  }, true);
}

bindResultContextMenu();

document.getElementById('open-manual-link-btn').addEventListener('click', openManualLinkDialog);
document.getElementById('manual-link-close-btn').addEventListener('click', closeManualLinkDialog);
document.getElementById('manual-link-cancel-btn').addEventListener('click', closeManualLinkDialog);
document.querySelectorAll('[data-close-manual-link]').forEach((el) => {
  el.addEventListener('click', closeManualLinkDialog);
});

document.getElementById('manual-link-btn').addEventListener('click', async () => {
  const chatgptEntryId = document.getElementById('manual-chatgpt').value;
  const sunoEntryId = document.getElementById('manual-suno').value;
  if (!chatgptEntryId || !sunoEntryId) {
    await showAlert(t('selectBoth'));
    return;
  }
  await send('createLink', { chatgptEntryId, sunoEntryId });
  if (selectedEntry) await renderLinked(selectedEntry.id);
  await showAlert(t('linkCreated'));
  closeManualLinkDialog();
});

document.getElementById('delete-entry-btn').addEventListener('click', async () => {
  if (!selectedEntry) return;
  const confirmMsg = selectedEntry.protected
    ? t('confirmDeleteProtected')
    : t('confirmDeleteEntry');
  if (!(await showConfirm(confirmMsg))) return;
  await send('deleteEntry', { entryId: selectedEntry.id });
  selectedEntry = null;
  document.getElementById('detail-empty').hidden = false;
  document.getElementById('detail-content').hidden = true;
  runSearch();
  refreshCleanupPreview();
});

document.getElementById('detail-protect-btn').addEventListener('click', async () => {
  if (!selectedEntry) return;
  const next = !selectedEntry.protected;
  const res = await send('setEntryProtected', { entryId: selectedEntry.id, protected: next });
  if (res?.entry) {
    selectedEntry = res.entry;
    updateDetailProtectBtn(selectedEntry);
    runSearch();
    refreshCleanupPreview();
  }
});

document.getElementById('export-btn').addEventListener('click', async () => {
  const res = await send('exportAll');
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `music-archive-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

/** @returns {'append' | 'replace_except_protected'} */
function getImportMode() {
  const replace = document.getElementById('import-mode-replace');
  return replace?.checked ? 'replace_except_protected' : 'append';
}

/**
 * @param {{ entries?: number, links?: number, cleared?: { entries: number, links: number, keptProtected: number } }} res
 * @param {'append' | 'replace_except_protected'} mode
 */
function formatImportResult(res, mode) {
  const lines = [t('importResultEntries', String(res.entries ?? 0), String(res.links ?? 0))];
  if (mode === 'replace_except_protected' && res.cleared) {
    lines.unshift(
      t(
        'importResultCleared',
        String(res.cleared.entries),
        String(res.cleared.links),
        String(res.cleared.keptProtected),
      ),
    );
  }
  return lines.join('\n');
}

async function importJsonFile(file, mode) {
  if (mode === 'replace_except_protected') {
    const ok = await showConfirm(t('importConfirmReplace'));
    if (!ok) return;
  }

  const text = await file.text();
  const data = JSON.parse(text);
  const res = await send('importAll', { data, mode });
  if (res?.success === false) {
    await showAlert(t('importFailed', res.error || t('unknownError')));
    return;
  }
  await showAlert(t('importComplete', formatImportResult(res, mode)));
  runSearch();
  refreshCleanupPreview();
}

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const mode = getImportMode();
  try {
    await importJsonFile(file, mode);
  } catch (err) {
    await showAlert(t('importFailed', String(err)));
  }
  e.target.value = '';
});

/** @type {'auto-link' | 'data-management' | 'data-cleanup'} */
let currentSettingsTab = 'auto-link';

/** @param {string} id */
function cleanupInput(id) {
  return document.getElementById(id);
}

/** 全データ・プロテクト削除の危険チェックを既定（オフ）に戻す */
function resetCleanupDangerChecks() {
  const presetAll = cleanupInput('cleanup-preset-all');
  const includeProtected = cleanupInput('cleanup-include-protected');
  if (presetAll) presetAll.checked = false;
  if (includeProtected) includeProtected.checked = false;
}

/** @returns {import('../../lib/cleanup-filter.js').CleanupFilters} */
function getCleanupFiltersFromUi() {
  return {
    presetOlderThan: cleanupInput('cleanup-preset-old')?.checked ?? false,
    olderThanDays: Number(cleanupInput('cleanup-older-days')?.value) || 90,
    presetUnlinked: cleanupInput('cleanup-preset-unlinked')?.checked ?? false,
    presetEmptyContent: cleanupInput('cleanup-preset-empty')?.checked ?? false,
    presetAll: cleanupInput('cleanup-preset-all')?.checked ?? false,
    source: /** @type {import('../../types.js').EntrySource|''} */ (
      cleanupInput('cleanup-source')?.value
    ) || undefined,
    linkStatus: /** @type {'any'|'linked'|'unlinked'} */ (
      cleanupInput('cleanup-link-status')?.value ?? 'any'
    ),
    contentStatus: /** @type {'any'|'empty'|'has_content'} */ (
      cleanupInput('cleanup-content-status')?.value ?? 'any'
    ),
    dateFrom: cleanupInput('cleanup-date-from')?.value ?? '',
    dateTo: cleanupInput('cleanup-date-to')?.value ?? '',
    keyword: cleanupInput('cleanup-keyword')?.value.trim() ?? '',
    includeProtected: cleanupInput('cleanup-include-protected')?.checked ?? false,
  };
}

/**
 * @param {import('../../lib/cleanup-filter.js').CleanupFilters} filters
 */
function hasActiveCleanupCriteria(filters) {
  if (filters.presetOlderThan || filters.presetUnlinked || filters.presetEmptyContent || filters.presetAll)
    return true;
  if (filters.source) return true;
  if (filters.keyword) return true;
  if (filters.linkStatus && filters.linkStatus !== 'any') return true;
  if (filters.contentStatus && filters.contentStatus !== 'any') return true;
  if (filters.dateFrom || filters.dateTo) return true;
  return false;
}

let cleanupPreviewRequestId = 0;
const scheduleCleanupPreview = debounce(() => refreshCleanupPreview(), 200);

/** @param {string} [detail] */
async function cleanupBackendErrorMessage(detail) {
  const detailMsg = String(detail || '');
  if (detailMsg === 'unknown action' || detailMsg.includes('no response from extension background')) {
    let versionHint = '';
    try {
      const info = await sendToBackground('getExtensionInfo', {}, { retries: 0 });
      if (info?.success && info.version) {
        versionHint = t(
          'backendVersionHint',
          info.version,
          info.supportsCleanup ? t('backendVersionYes') : t('backendVersionNo'),
        );
      }
    } catch {
      versionHint = t('backendVersionUnknown');
    }
    return [
      t('backendCleanupUnavailable', versionHint),
      t('backendReloadTabsHint'),
      t('backendDevRebuildHint'),
    ].join(' ');
  }
  if (detailMsg.includes('Could not establish connection') || detailMsg.includes('Receiving end does not exist')) {
    return t('backendSwUnavailable');
  }
  return detailMsg || t('unknownError');
}

async function refreshCleanupPreview() {
  if (currentSettingsTab !== 'data-cleanup') return;

  const filters = getCleanupFiltersFromUi();
  const active = hasActiveCleanupCriteria(filters);
  const countEl = document.getElementById('cleanup-count');
  const noteEl = document.getElementById('cleanup-protected-note');
  const previewEl = document.getElementById('cleanup-preview');
  const deleteBtn = document.getElementById('cleanup-delete-btn');
  if (!countEl || !noteEl || !previewEl || !deleteBtn) return;

  if (!active) {
    countEl.textContent = '0';
    noteEl.hidden = true;
    previewEl.innerHTML = `<li class="cleanup-preview-meta">${escapeHtml(t('cleanupPreviewNeedCriteria'))}</li>`;
    deleteBtn.disabled = true;
    return;
  }

  const requestId = ++cleanupPreviewRequestId;
  let res;
  try {
    res = await send('previewCleanup', { filters, limit: 8 });
  } catch (err) {
    if (requestId !== cleanupPreviewRequestId) return;
    countEl.textContent = '0';
    noteEl.hidden = true;
    previewEl.innerHTML = `<li class="cleanup-preview-meta cleanup-preview-error">${escapeHtml(t('cleanupPreviewFailed', String(err)))}</li>`;
    deleteBtn.disabled = true;
    return;
  }
  if (requestId !== cleanupPreviewRequestId) return;

  if (res?.success === false) {
    countEl.textContent = '0';
    noteEl.hidden = true;
    previewEl.innerHTML = `<li class="cleanup-preview-meta cleanup-preview-error">${escapeHtml(t('cleanupPreviewFailed', await cleanupBackendErrorMessage(res.error)))}</li>`;
    deleteBtn.disabled = true;
    return;
  }

  const count = res?.count ?? 0;
  countEl.textContent = String(count);
  noteEl.hidden = !!filters.includeProtected;
  if (filters.presetAll) {
    noteEl.hidden = false;
    noteEl.textContent = t('cleanupNoteAllData');
  } else if (!filters.includeProtected) {
    noteEl.textContent = t('cleanupNoteProtectedExcluded');
  }
  deleteBtn.disabled = count === 0;

  previewEl.innerHTML = '';
  if (!count) {
    previewEl.innerHTML = `<li class="cleanup-preview-meta">${escapeHtml(t('cleanupNoMatches'))}</li>`;
    return;
  }

  for (const entry of res.preview || []) {
    const li = document.createElement('li');
    const title = entry.title || t('untitled');
    const date = entry.capturedAt?.slice(0, 10) || '';
    li.innerHTML = `
      <div class="cleanup-preview-title">${entry.protected ? '🔒 ' : ''}${escapeHtml(title)}</div>
      <div class="cleanup-preview-meta">${escapeHtml(sourceLabel(entry.source))} · ${escapeHtml(date)}</div>
    `;
    previewEl.appendChild(li);
  }
  if (count > (res.preview?.length || 0)) {
    const li = document.createElement('li');
    li.className = 'cleanup-preview-meta';
    li.textContent = t('cleanupMoreCount', String(count - (res.preview?.length || 0)));
    previewEl.appendChild(li);
  }
}

function bindCleanupUi() {
  const immediateIds = [
    'cleanup-preset-old',
    'cleanup-preset-unlinked',
    'cleanup-preset-empty',
    'cleanup-preset-all',
    'cleanup-source',
    'cleanup-link-status',
    'cleanup-content-status',
    'cleanup-include-protected',
  ];
  const debouncedIds = [
    'cleanup-older-days',
    'cleanup-date-from',
    'cleanup-date-to',
    'cleanup-keyword',
  ];

  for (const id of immediateIds) {
    const el = cleanupInput(id);
    if (!el) continue;
    el.addEventListener('change', () => refreshCleanupPreview());
  }

  for (const id of debouncedIds) {
    const el = cleanupInput(id);
    if (!el) continue;
    el.addEventListener('input', scheduleCleanupPreview);
    el.addEventListener('change', scheduleCleanupPreview);
  }

  cleanupInput('cleanup-older-days')?.addEventListener('input', () => {
    const preset = cleanupInput('cleanup-preset-old');
    if (preset) preset.checked = true;
  });
  cleanupInput('cleanup-older-days')?.addEventListener('change', () => {
    const preset = cleanupInput('cleanup-preset-old');
    if (preset) preset.checked = true;
  });

  document.getElementById('cleanup-older-days')?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.getElementById('cleanup-goto-export')?.addEventListener('click', () => {
    showSettingsTab('data-management');
  });

  document.getElementById('cleanup-delete-btn')?.addEventListener('click', async () => {
    const filters = getCleanupFiltersFromUi();
    if (!hasActiveCleanupCriteria(filters)) return;

    const preview = await send('previewCleanup', { filters, limit: 8 });
    const count = preview?.count ?? 0;
    if (!count) return;

    let confirmMsg = t('cleanupConfirmDelete', String(count));
    if (count >= 50) {
      confirmMsg = t('cleanupConfirmDeleteIrreversible', String(count));
    }
    if (filters.includeProtected && count >= 10) {
      confirmMsg += t('cleanupConfirmIncludesProtected');
    }
    if (filters.presetAll) {
      confirmMsg = t('cleanupConfirmDeleteAll', String(count));
      if (filters.includeProtected) {
        confirmMsg += t('cleanupConfirmIncludesProtected');
      }
    }
    if (!(await showConfirm(confirmMsg))) return;

    const res = await send('bulkDeleteCleanup', { filters });
    await showAlert(t('cleanupDeletedCount', String(res?.deleted ?? 0)));
    resetCleanupDangerChecks();
    if (selectedEntry?.id) {
      const still = await send('getEntry', { entryId: selectedEntry.id });
      if (!still?.entry) {
        selectedEntry = null;
        document.getElementById('detail-empty').hidden = false;
        document.getElementById('detail-content').hidden = true;
      } else {
        selectedEntry = still.entry;
        updateDetailProtectBtn(selectedEntry);
      }
    }
    runSearch();
    refreshCleanupPreview();
  });
}

async function loadSettingsUi() {
  const res = await send('getSettings');
  const s = res?.settings || {};
  document.getElementById('setting-threshold').value = s.linkThreshold ?? 0.75;
  document.getElementById('setting-window').value = s.linkWindowDays ?? 30;
}

/**
 * @param {'auto-link' | 'data-management' | 'data-cleanup'} tab
 */
function showSettingsTab(tab) {
  currentSettingsTab = tab;
  document.querySelectorAll('.settings-tab').forEach((btn) => {
    const active = btn.getAttribute('data-settings-tab') === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.getElementById('settings-panel-auto-link').hidden = tab !== 'auto-link';
  document.getElementById('settings-panel-data').hidden = tab !== 'data-management';
  document.getElementById('settings-panel-cleanup').hidden = tab !== 'data-cleanup';
  document.getElementById('save-settings-btn').hidden =
    tab === 'data-management' || tab === 'data-cleanup';
  if (tab === 'data-cleanup') {
    refreshCleanupPreview();
  }
}

function openSettingsDialog() {
  resetCleanupDangerChecks();
  loadSettingsUi();
  showSettingsTab('auto-link');
  document.getElementById('settings-dialog').hidden = false;
}

function closeSettingsDialog() {
  resetCleanupDangerChecks();
  document.getElementById('settings-dialog').hidden = true;
}

async function saveCurrentSettingsTab() {
  if (currentSettingsTab === 'auto-link') {
    await send('saveSettings', {
      settings: {
        linkThreshold: Number(document.getElementById('setting-threshold').value),
        linkWindowDays: Number(document.getElementById('setting-window').value),
      },
    });
  }
}

document.getElementById('open-settings-btn').addEventListener('click', openSettingsDialog);
document.getElementById('settings-close-btn').addEventListener('click', closeSettingsDialog);
document.getElementById('settings-cancel-btn').addEventListener('click', closeSettingsDialog);
document.querySelectorAll('[data-close-settings]').forEach((el) => {
  el.addEventListener('click', closeSettingsDialog);
});

document.querySelectorAll('.settings-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-settings-tab');
    if (tab === 'auto-link' || tab === 'data-management' || tab === 'data-cleanup') {
      showSettingsTab(tab);
    }
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (contextMenuOpen) return;
  const messageDialog = document.getElementById('message-dialog');
  if (messageDialog && !messageDialog.hidden) return;
  if (!document.getElementById('manual-link-dialog').hidden) {
    closeManualLinkDialog();
    return;
  }
  if (!document.getElementById('settings-dialog').hidden) {
    closeSettingsDialog();
    return;
  }
  if (selectedEntryIds.size > 0) {
    clearMultiSelection();
  }
});

document.getElementById('save-settings-btn').addEventListener('click', async () => {
  await saveCurrentSettingsTab();
  await showAlert(t('settingsSaved'));
});

initMessageDialog();

async function initDashboard() {
  applyPageI18n();
  viewMode = await getStoredViewMode();
  syncViewModeButtons();
  await runSearch();
}

initDashboard();
initTheme();
bindThemeToggle();
watchThemeChanges();
initSplitPane();
bindCleanupUi();
