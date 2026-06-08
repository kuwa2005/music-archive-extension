import { snippetAround, highlightSnippet } from '../../lib/normalize.js';
import { formatEntryDate, formatDateTimeFull, formatDateGroupHeader, dateGroupKey } from '../../lib/date-format.js';
import { getAiLabel, isAiSource } from '../../lib/ai-sources.js';
import { getSunoSourceLabel, isSunoEntrySource } from '../../lib/suno-sources.js';
import { initTheme, bindThemeToggle, watchThemeChanges } from '../../lib/theme.js';
import { initSplitPane } from '../../lib/split-pane.js';
import { sendToBackground } from '../../lib/extension-messaging.js';
import { initMessageDialog, showAlert, showConfirm } from '../../lib/dialog.js';

/** @type {import('../../types.js').Entry[]} */
let allResults = [];
/** @type {Set<string>} */
let linkedEntryIds = new Set();
/** @type {import('../../types.js').Entry|null} */
let selectedEntry = null;

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
  renderResults(query);
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

  const showGroups = shouldShowDateGroups(allResults);
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

    const li = document.createElement('li');
    li.className = 'result-item' + (selectedEntry?.id === entry.id ? ' active' : '');
    li.dataset.id = entry.id;

    const snippet = snippetAround(entry.lyrics || entry.stylePrompt || entry.title, query);
    const isLinked = linkedEntryIds.has(entry.id);
    const dateLabel = formatEntryDate(entry.capturedAt);
    const dateTitle = formatDateTimeFull(entry.capturedAt);
    const updatedTitle =
      entry.updatedAt && entry.updatedAt !== entry.capturedAt
        ? ` · 更新 ${formatDateTimeFull(entry.updatedAt)}`
        : '';
    const genLabel =
      entry.source === 'suno_song' && entry.sunoCreatedAt
        ? formatEntryDate(entry.sunoCreatedAt)
        : '';
    const genTitle =
      entry.source === 'suno_song' && entry.sunoCreatedAt
        ? ` · 生成 ${formatDateTimeFull(entry.sunoCreatedAt)}`
        : '';

    li.innerHTML = `
      <div class="result-head">
        <div class="result-badges">
          <span class="badge ${badgeClass(entry.source)}">${sourceLabel(entry.source)}</span>
          ${entry.gptName ? `<span class="badge">${escapeHtml(entry.gptName)}</span>` : ''}
          ${isLinked ? '<span class="badge linked" title="リンク済み">🔗 リンク</span>' : ''}
          ${entry.protected ? '<span class="badge protected" title="プロテクト中">🔒</span>' : ''}
        </div>
        <div class="result-dates">
          ${genLabel ? `<time class="result-date result-date-generated" datetime="${escapeHtml(entry.sunoCreatedAt || '')}" title="生成 ${escapeHtml(formatDateTimeFull(entry.sunoCreatedAt))}">${escapeHtml(genLabel)}</time>` : ''}
          ${dateLabel ? `<time class="result-date" datetime="${escapeHtml(entry.capturedAt || '')}" title="保存 ${escapeHtml(dateTitle)}${escapeHtml(updatedTitle)}${escapeHtml(genTitle)}">${escapeHtml(dateLabel)}</time>` : ''}
        </div>
      </div>
      <div class="title">${escapeHtml(entry.title || '無題')}</div>
      <div class="snippet">${highlightSnippet(snippet, query, escapeHtml)}</div>
    `;
    li.addEventListener('click', () => selectEntry(entry.id));
    list.appendChild(li);
  }
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
    on ? 'プロテクト解除（一括削除の対象に含める）' : 'プロテクト（一括削除から除外）',
  );
  btn.title = on ? 'プロテクト中 — クリックで解除' : 'プロテクト（一括削除から除外）';
}

async function selectEntry(id) {
  const res = await send('getEntry', { entryId: id });
  selectedEntry = res?.entry || allResults.find((e) => e.id === id) || null;
  if (!selectedEntry) return;

  document.getElementById('detail-empty').hidden = true;
  document.getElementById('detail-content').hidden = false;
  document.getElementById('detail-title').textContent = selectedEntry.title || '無題';
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
    metaParts.push(`更新 ${formatDateTimeFull(selectedEntry.updatedAt)}`);
  }
  if (selectedEntry.source === 'suno_song') {
    if (selectedEntry.sunoCreatedAt) {
      const genLabel = formatEntryDate(selectedEntry.sunoCreatedAt);
      const genFull = formatDateTimeFull(selectedEntry.sunoCreatedAt);
      metaParts.push(`生成 ${genLabel}（${genFull}）`);
    } else {
      metaParts.push('生成日時: 未取得（曲ページから再保存で補完できます）');
    }
  }
  metaEl.appendChild(document.createTextNode(metaParts.join(' · ')));
  if (selectedEntry.sourceUrl) {
    if (metaParts.length) metaEl.appendChild(document.createTextNode(' · '));
    metaEl.appendChild(createExternalLink(selectedEntry.sourceUrl, selectedEntry.sourceUrl));
  }

  const lyricsParts = [];
  if (selectedEntry.stylePrompt) lyricsParts.push(`[Style]\n${selectedEntry.stylePrompt}\n`);
  if (selectedEntry.lyrics) lyricsParts.push(selectedEntry.lyrics);
  document.getElementById('detail-lyrics').textContent = lyricsParts.join('\n') || '(歌詞なし)';

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
  chatSelect.innerHTML = '<option value="">AI チャットを選択</option>';
  sunoSelect.innerHTML = '<option value="">Suno を選択</option>';

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
    await showAlert('両方選択してください');
    return;
  }
  await send('createLink', { chatgptEntryId, sunoEntryId });
  if (selectedEntry) await renderLinked(selectedEntry.id);
  await showAlert('リンクを作成しました');
  closeManualLinkDialog();
});

document.getElementById('delete-entry-btn').addEventListener('click', async () => {
  if (!selectedEntry) return;
  const msg = selectedEntry.protected
    ? 'プロテクト中のデータです。本当に削除しますか？'
    : 'このエントリを削除しますか？';
  if (!(await showConfirm(msg))) return;
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
  const lines = [`取り込み: エントリ ${res.entries ?? 0} 件、リンク ${res.links ?? 0} 件`];
  if (mode === 'replace_except_protected' && res.cleared) {
    lines.unshift(
      `削除: エントリ ${res.cleared.entries} 件、リンク ${res.cleared.links} 件（プロテクト ${res.cleared.keptProtected} 件は保持）`,
    );
  }
  return lines.join('\n');
}

async function importJsonFile(file, mode) {
  if (mode === 'replace_except_protected') {
    const ok = await showConfirm(
      '既存データを削除してからインポートします。\nプロテクト中のデータのみ残ります。\n\n続行しますか？',
    );
    if (!ok) return;
  }

  const text = await file.text();
  const data = JSON.parse(text);
  const res = await send('importAll', { data, mode });
  if (res?.success === false) {
    await showAlert(`インポートに失敗しました: ${res.error || '不明なエラー'}`);
    return;
  }
  await showAlert(`インポート完了\n${formatImportResult(res, mode)}`);
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
    await showAlert(`インポートに失敗しました: ${err}`);
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
  const msg = String(detail || '');
  if (msg === 'unknown action' || msg.includes('no response from extension background')) {
    let versionHint = '';
    try {
      const info = await sendToBackground('getExtensionInfo', {}, { retries: 0 });
      if (info?.success && info.version) {
        versionHint = `（バックエンド報告 v${info.version}、データ整理 API: ${
          info.supportsCleanup ? 'あり' : 'なし'
        }）`;
      }
    } catch {
      versionHint = '（バックエンドに接続できませんでした）';
    }
    return [
      `バックグラウンドがデータ整理 API に応答しませんでした。${versionHint}`,
      'chrome://extensions を開き「楽曲制作アーカイブ」の再読み込みを押してください。',
      'Suno / AI チャットのタブを開いている場合は、拡張機能の再読み込み後にそれらのタブも更新（F5）してください。',
      '開発中の場合は npm run build 後に拡張機能を再読み込みしてください。',
    ].join(' ');
  }
  if (msg.includes('Could not establish connection') || msg.includes('Receiving end does not exist')) {
    return [
      'バックグラウンド（Service Worker）に接続できません。',
      'chrome://extensions で拡張機能を再読み込みしてください。',
    ].join(' ');
  }
  return msg || '不明なエラー';
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
    previewEl.innerHTML = '<li class="cleanup-preview-meta">クイック整理または詳細条件を指定してください</li>';
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
    previewEl.innerHTML = `<li class="cleanup-preview-meta cleanup-preview-error">プレビュー取得に失敗しました: ${escapeHtml(String(err))}</li>`;
    deleteBtn.disabled = true;
    return;
  }
  if (requestId !== cleanupPreviewRequestId) return;

  if (res?.success === false) {
    countEl.textContent = '0';
    noteEl.hidden = true;
    previewEl.innerHTML = `<li class="cleanup-preview-meta cleanup-preview-error">プレビュー取得に失敗しました: ${escapeHtml(await cleanupBackendErrorMessage(res.error))}</li>`;
    deleteBtn.disabled = true;
    return;
  }

  const count = res?.count ?? 0;
  countEl.textContent = String(count);
  noteEl.hidden = !!filters.includeProtected;
  if (filters.presetAll) {
    noteEl.hidden = false;
    noteEl.textContent = '（全データが対象です。プロテクト分は除外設定に従います）';
  } else if (!filters.includeProtected) {
    noteEl.textContent = '（プロテクト分は除外されています）';
  }
  deleteBtn.disabled = count === 0;

  previewEl.innerHTML = '';
  if (!count) {
    previewEl.innerHTML = '<li class="cleanup-preview-meta">該当データはありません</li>';
    return;
  }

  for (const entry of res.preview || []) {
    const li = document.createElement('li');
    const title = entry.title || '無題';
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
    li.textContent = `…他 ${count - (res.preview?.length || 0)} 件`;
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

    let msg = `${count} 件のデータを削除します。よろしいですか？`;
    if (count >= 50) {
      msg = `${count} 件のデータを削除します。この操作は取り消せません。続行しますか？`;
    }
    if (filters.includeProtected && count >= 10) {
      msg += '\n（プロテクト中のデータも含まれます）';
    }
    if (filters.presetAll) {
      msg = `アーカイブの全データ ${count} 件を削除します。この操作は取り消せません。続行しますか？`;
      if (filters.includeProtected) {
        msg += '\n（プロテクト中のデータも含まれます）';
      }
    }
    if (!(await showConfirm(msg))) return;

    const res = await send('bulkDeleteCleanup', { filters });
    await showAlert(`${res?.deleted ?? 0} 件を削除しました`);
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
  const messageDialog = document.getElementById('message-dialog');
  if (messageDialog && !messageDialog.hidden) return;
  if (!document.getElementById('manual-link-dialog').hidden) {
    closeManualLinkDialog();
    return;
  }
  if (!document.getElementById('settings-dialog').hidden) {
    closeSettingsDialog();
  }
});

document.getElementById('save-settings-btn').addEventListener('click', async () => {
  await saveCurrentSettingsTab();
  await showAlert('設定を保存しました');
});

initMessageDialog();
runSearch();
initTheme();
bindThemeToggle();
watchThemeChanges();
initSplitPane();
bindCleanupUi();
