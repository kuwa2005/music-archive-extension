import {
  buildSimilarityClusters,
  similarityClusterLabel,
} from './similarity-clusters.js';
import { t } from './i18n.js';

export const VIEW_MODE_KEY = 'dashboardResultViewMode';

/** @typedef {'cards' | 'compact' | 'list' | 'tree-links'} ResultViewMode */

/** @type {ResultViewMode[]} */
export const VIEW_MODES = ['cards', 'compact', 'list', 'tree-links'];

/** @type {Record<ResultViewMode, string>} */
export const VIEW_MODE_MESSAGE_KEYS = {
  cards: 'viewModeCards',
  compact: 'viewModeCompact',
  list: 'viewModeList',
  'tree-links': 'viewModeTreeLinks',
};

/**
 * @param {ResultViewMode} mode
 * @returns {string}
 */
export function getViewModeLabel(mode) {
  const key = VIEW_MODE_MESSAGE_KEYS[normalizeViewMode(mode)];
  return key ? t(key) : mode;
}

/**
 * @param {unknown} value
 * @returns {ResultViewMode}
 */
export function normalizeViewMode(value) {
  if (value === 'tree' || value === 'tree-similarity') return 'tree-links';
  return VIEW_MODES.includes(/** @type {ResultViewMode} */ (value))
    ? /** @type {ResultViewMode} */ (value)
    : 'cards';
}

/** @returns {Promise<ResultViewMode>} */
export async function getStoredViewMode() {
  const result = await chrome.storage.local.get([VIEW_MODE_KEY]);
  const raw = result[VIEW_MODE_KEY];
  const mode = normalizeViewMode(raw);
  if (raw === 'tree' || raw === 'tree-similarity') {
    await chrome.storage.local.set({ [VIEW_MODE_KEY]: mode });
  }
  return mode;
}

/**
 * @param {ResultViewMode} mode
 */
export async function saveViewMode(mode) {
  await chrome.storage.local.set({ [VIEW_MODE_KEY]: normalizeViewMode(mode) });
}

/**
 * @typedef {Object} TreeGroup
 * @property {string} id
 * @property {string} label
 * @property {import('../types.js').Entry[]} entries
 * @property {TreeGroup[]} [children]
 * @property {boolean} [flat] ルート直下にカードのみ表示（折りたたみヘッダーなし）
 */

/**
 * @param {ResultViewMode} mode
 * @returns {boolean}
 */
export function isTreeViewMode(mode) {
  return mode === 'tree-links';
}

/**
 * 類似クラスタ（2 件以上）と単独エントリに分割。
 *
 * @param {import('../types.js').Entry[]} entries
 * @returns {{ clusterGroups: TreeGroup[], singletonEntries: import('../types.js').Entry[] }}
 */
function partitionSimilarityClusters(entries) {
  if (!entries.length) {
    return { clusterGroups: [], singletonEntries: [] };
  }

  /** @type {Map<string, import('../types.js').Entry>} */
  const byId = new Map(entries.map((e) => [e.id, e]));
  const simClusters = buildSimilarityClusters(entries);

  /** @type {Set<string>} */
  const clusteredIds = new Set();
  /** @type {TreeGroup[]} */
  const clusterGroups = [];

  for (const memberIds of simClusters.values()) {
    if (memberIds.size < 2) continue;
    const clusterEntries = [...memberIds].map((id) => byId.get(id)).filter(Boolean);
    if (clusterEntries.length < 2) continue;
    for (const id of memberIds) clusteredIds.add(id);
    clusterGroups.push({
      id: `sim-${[...memberIds].sort().join('-')}`,
      label: similarityClusterLabel(clusterEntries),
      entries: clusterEntries.sort((a, b) => (b.capturedAt || '').localeCompare(a.capturedAt || '')),
    });
  }

  clusterGroups.sort((a, b) => a.label.localeCompare(b.label, 'ja'));

  const singletonEntries = entries
    .filter((e) => !clusteredIds.has(e.id))
    .sort((a, b) => (b.capturedAt || '').localeCompare(a.capturedAt || ''));

  return { clusterGroups, singletonEntries };
}

/**
 * 単独エントリをルート直下のフラットカード用 TreeGroup に変換。
 *
 * @param {import('../types.js').Entry[]} singletonEntries
 * @returns {TreeGroup[]}
 */
function flatEntryGroups(singletonEntries) {
  return singletonEntries.map((entry) => ({
    id: `entry-${entry.id}`,
    label: '',
    entries: [entry],
    flat: true,
  }));
}

/**
 * ツリー（リンク）: リンク済みは類似クラスタ構造、未リンクは「未リンク」セクション。
 *
 * @param {import('../types.js').Entry[]} entries
 * @param {Iterable<string>} linkedIds search API の linkedIds（バッジ表示と同一ソース）
 * @returns {TreeGroup[]}
 */
export function buildLinkTreeGroups(entries, linkedIds) {
  if (!entries.length) return [];

  const linkedIdSet = linkedIds instanceof Set ? linkedIds : new Set(linkedIds);
  const linked = entries.filter((e) => linkedIdSet.has(e.id));
  const unlinked = entries
    .filter((e) => !linkedIdSet.has(e.id))
    .sort((a, b) => (b.capturedAt || '').localeCompare(a.capturedAt || ''));

  const { clusterGroups, singletonEntries } = partitionSimilarityClusters(linked);

  /** @type {TreeGroup[]} */
  const roots = [...clusterGroups, ...flatEntryGroups(singletonEntries)];

  if (unlinked.length) {
    roots.push({
      id: 'unlinked-root',
      label: t('unlinkedSection'),
      entries: unlinked,
    });
  }

  return roots;
}

/**
 * 表示モードに応じたツリー分组。
 * @param {ResultViewMode} mode
 * @param {import('../types.js').Entry[]} entries
 * @param {Iterable<string>} linkedIds
 * @returns {TreeGroup[]}
 */
export function buildTreeGroupsForMode(mode, entries, linkedIds) {
  if (mode === 'tree-links') {
    return buildLinkTreeGroups(entries, linkedIds);
  }
  return [];
}
