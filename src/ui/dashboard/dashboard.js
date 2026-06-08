import { snippetAround } from '../../lib/normalize.js';
import { getAiLabel, isAiSource } from '../../lib/ai-sources.js';
import { getSunoSourceLabel, isSunoEntrySource } from '../../lib/suno-sources.js';
import { initTheme, bindThemeToggle, watchThemeChanges } from '../../lib/theme.js';
import { initSplitPane } from '../../lib/split-pane.js';

/** @type {import('../../types.js').Entry[]} */
let allResults = [];
/** @type {import('../../types.js').Entry|null} */
let selectedEntry = null;

function send(action, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...payload }, resolve);
  });
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
  renderResults(query);
}

function renderResults(query) {
  const list = document.getElementById('result-list');
  list.innerHTML = '';
  document.getElementById('result-count').textContent = `(${allResults.length})`;

  for (const entry of allResults) {
    const li = document.createElement('li');
    li.className = 'result-item' + (selectedEntry?.id === entry.id ? ' active' : '');
    li.dataset.id = entry.id;

    const snippet = snippetAround(entry.lyrics || entry.stylePrompt || entry.title, query);
    li.innerHTML = `
      <div>
        <span class="badge ${badgeClass(entry.source)}">${sourceLabel(entry.source)}</span>
        ${entry.gptName ? `<span class="badge">${escapeHtml(entry.gptName)}</span>` : ''}
        ${isAiSource(entry.source) ? `<span class="badge">${escapeHtml(getAiLabel(entry.source))}</span>` : ''}
      </div>
      <div class="title">${entry.protected ? '<span class="badge protected">🔒</span> ' : ''}${escapeHtml(entry.title || '無題')}</div>
      <div class="snippet">${escapeHtml(snippet)}</div>
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
 * @returns {HTMLAnchorElement}
 */
function createExternalLink(url, label) {
  const a = document.createElement('a');
  a.href = url;
  a.textContent = label;
  a.className = 'external-link';
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openInNewTab(url);
  });
  return a;
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
  const metaParts = [
    sourceLabel(selectedEntry.source),
    selectedEntry.gptName,
    selectedEntry.capturedAt?.slice(0, 19),
  ].filter(Boolean);
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

async function renderLinked(entryId) {
  const linked = await send('getLinked', { entryId });
  const chatUl = document.getElementById('linked-chatgpt');
  const sunoUl = document.getElementById('linked-suno');
  chatUl.innerHTML = '';
  sunoUl.innerHTML = '';

  for (const e of linked?.chatgpt || []) {
    const li = document.createElement('li');
    li.appendChild(createExternalLink(e.sourceUrl, e.sourceUrl));
    chatUl.appendChild(li);
  }
  for (const e of linked?.suno || []) {
    const li = document.createElement('li');
    li.appendChild(createExternalLink(e.sourceUrl, e.sourceUrl));
    sunoUl.appendChild(li);
  }
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
    alert('両方選択してください');
    return;
  }
  await send('createLink', { chatgptEntryId, sunoEntryId });
  if (selectedEntry) await renderLinked(selectedEntry.id);
  alert('リンクを作成しました');
  closeManualLinkDialog();
});

document.getElementById('delete-entry-btn').addEventListener('click', async () => {
  if (!selectedEntry) return;
  const msg = selectedEntry.protected
    ? 'プロテクト中のデータです。本当に削除しますか？'
    : 'このエントリを削除しますか？';
  if (!confirm(msg)) return;
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

async function importJsonFile(file, handler) {
  const text = await file.text();
  const data = JSON.parse(text);
  const res = await handler(data);
  alert(`インポート完了: ${JSON.stringify(res)}`);
  runSearch();
  refreshCleanupPreview();
}

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importJsonFile(file, (data) => send('importAll', { data }));
  e.target.value = '';
});

/** @type {'auto-save' | 'auto-link' | 'data-management' | 'data-cleanup'} */
let currentSettingsTab = 'auto-save';

/** @returns {import('../../lib/cleanup-filter.js').CleanupFilters} */
function getCleanupFiltersFromUi() {
  return {
    presetOlderThan: document.getElementById('cleanup-preset-old').checked,
    olderThanDays: Number(document.getElementById('cleanup-older-days').value) || 90,
    presetUnlinked: document.getElementById('cleanup-preset-unlinked').checked,
    presetEmptyContent: document.getElementById('cleanup-preset-empty').checked,
    source: /** @type {import('../../types.js').EntrySource|''} */ (
      document.getElementById('cleanup-source').value
    ) || undefined,
    linkStatus: /** @type {'any'|'linked'|'unlinked'} */ (
      document.getElementById('cleanup-link-status').value
    ),
    contentStatus: /** @type {'any'|'empty'|'has_content'} */ (
      document.getElementById('cleanup-content-status').value
    ),
    dateFrom: document.getElementById('cleanup-date-from').value,
    dateTo: document.getElementById('cleanup-date-to').value,
    keyword: document.getElementById('cleanup-keyword').value.trim(),
    includeProtected: document.getElementById('cleanup-include-protected').checked,
  };
}

/**
 * @param {import('../../lib/cleanup-filter.js').CleanupFilters} filters
 */
function hasActiveCleanupCriteria(filters) {
  if (filters.presetOlderThan || filters.presetUnlinked || filters.presetEmptyContent) return true;
  if (filters.source) return true;
  if (filters.keyword) return true;
  if (filters.linkStatus && filters.linkStatus !== 'any') return true;
  if (filters.contentStatus && filters.contentStatus !== 'any') return true;
  if (filters.dateFrom || filters.dateTo) return true;
  return false;
}

async function refreshCleanupPreview() {
  const panel = document.getElementById('settings-panel-cleanup');
  if (!panel || panel.hidden) return;

  const filters = getCleanupFiltersFromUi();
  const active = hasActiveCleanupCriteria(filters);
  const countEl = document.getElementById('cleanup-count');
  const noteEl = document.getElementById('cleanup-protected-note');
  const previewEl = document.getElementById('cleanup-preview');
  const deleteBtn = document.getElementById('cleanup-delete-btn');

  if (!active) {
    countEl.textContent = '0';
    noteEl.hidden = true;
    previewEl.innerHTML = '<li class="cleanup-preview-meta">クイック整理または詳細条件を指定してください</li>';
    deleteBtn.disabled = true;
    return;
  }

  const res = await send('previewCleanup', { filters, limit: 8 });
  const count = res?.count ?? 0;
  countEl.textContent = String(count);
  noteEl.hidden = !!filters.includeProtected;
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
  const inputs = [
    'cleanup-preset-old',
    'cleanup-older-days',
    'cleanup-preset-unlinked',
    'cleanup-preset-empty',
    'cleanup-source',
    'cleanup-link-status',
    'cleanup-content-status',
    'cleanup-date-from',
    'cleanup-date-to',
    'cleanup-keyword',
    'cleanup-include-protected',
  ];
  for (const id of inputs) {
    const el = document.getElementById(id);
    if (!el) continue;
    const evt = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, debounce(refreshCleanupPreview, 200));
  }

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
    if (!confirm(msg)) return;

    const res = await send('bulkDeleteCleanup', { filters });
    alert(`${res?.deleted ?? 0} 件を削除しました`);
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
  document.getElementById('setting-auto-suno').checked = !!s.autoSaveSuno;
  document.getElementById('setting-auto-ai').checked = !!(s.autoSaveAI ?? s.autoSaveChatGPT);
  document.getElementById('setting-auto-list').checked = !!s.autoSaveList;
  document.getElementById('setting-threshold').value = s.linkThreshold ?? 0.75;
  document.getElementById('setting-window').value = s.linkWindowDays ?? 30;
}

/**
 * @param {'auto-save' | 'auto-link' | 'data-management' | 'data-cleanup'} tab
 */
function showSettingsTab(tab) {
  currentSettingsTab = tab;
  document.querySelectorAll('.settings-tab').forEach((btn) => {
    const active = btn.getAttribute('data-settings-tab') === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.getElementById('settings-panel-auto-save').hidden = tab !== 'auto-save';
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
  loadSettingsUi();
  showSettingsTab('auto-save');
  document.getElementById('settings-dialog').hidden = false;
}

function closeSettingsDialog() {
  document.getElementById('settings-dialog').hidden = true;
}

async function saveCurrentSettingsTab() {
  if (currentSettingsTab === 'auto-save') {
    const autoSaveAI = document.getElementById('setting-auto-ai').checked;
    await send('saveSettings', {
      settings: {
        autoSaveSuno: document.getElementById('setting-auto-suno').checked,
        autoSaveAI,
        autoSaveChatGPT: autoSaveAI,
        autoSaveList: document.getElementById('setting-auto-list').checked,
      },
    });
  } else {
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
    if (tab === 'auto-save' || tab === 'auto-link' || tab === 'data-management' || tab === 'data-cleanup') {
      showSettingsTab(tab);
    }
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
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
  alert('設定を保存しました');
});

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

runSearch();
initTheme();
bindThemeToggle();
watchThemeChanges();
initSplitPane();
bindCleanupUi();
