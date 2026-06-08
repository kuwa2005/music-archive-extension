import { db } from './schema.js';
import { isAiSource } from '../lib/ai-sources.js';
import { isSunoEntrySource } from '../lib/suno-sources.js';
import { enrichSearchFields } from '../lib/normalize.js';
import { matchesQuery } from '../lib/similarity.js';
import { filterEntriesForCleanup } from '../lib/cleanup-filter.js';

/**
 * @returns {string}
 */
export function newId() {
  return crypto.randomUUID();
}

/**
 * @param {Partial<import('../types.js').Entry>} data
 * @returns {Promise<import('../types.js').Entry>}
 */
export async function upsertEntry(data) {
  const now = new Date().toISOString();
  const searchFields = enrichSearchFields(data);

  let existing = null;
  if (data.source === 'suno_song' && data.clipId) {
    existing = await db.entries.where('[source+clipId]').equals(['suno_song', data.clipId]).first();
  } else if (isAiSource(data.source) && data.conversationId) {
    existing = await db.entries
      .where('[source+conversationId]')
      .equals([data.source, data.conversationId])
      .first();
  } else if ((data.source === 'suno_list' || data.source === 'suno_workspace') && data.clipId) {
    existing = await db.entries.where('[source+clipId]').equals([data.source, data.clipId]).first();
  }

  /** @type {import('../types.js').Entry} */
  const entry = {
    id: existing?.id || data.id || newId(),
    source: data.source,
    title: data.title || existing?.title || '',
    lyrics: data.lyrics ?? existing?.lyrics ?? '',
    stylePrompt: data.stylePrompt ?? existing?.stylePrompt ?? '',
    sourceUrl: data.sourceUrl || existing?.sourceUrl || '',
    clipId: data.clipId ?? existing?.clipId,
    gptName: data.gptName ?? existing?.gptName,
    gptId: data.gptId ?? existing?.gptId,
    conversationId: data.conversationId ?? existing?.conversationId,
    listContext: data.listContext ?? existing?.listContext,
    imageUrl: data.imageUrl ?? existing?.imageUrl,
    protected: data.protected ?? existing?.protected ?? false,
    capturedAt: existing?.capturedAt || data.capturedAt || now,
    updatedAt: now,
    ...searchFields,
  };

  await db.entries.put(entry);
  return entry;
}

/**
 * @param {Partial<import('../types.js').Entry>[]} items
 * @returns {Promise<number>}
 */
export async function upsertManyEntries(items) {
  let count = 0;
  for (const item of items) {
    await upsertEntry(item);
    count += 1;
  }
  return count;
}

/**
 * @param {string} id
 * @returns {Promise<import('../types.js').Entry|undefined>}
 */
export function getEntry(id) {
  return db.entries.get(id);
}

/**
 * @param {Object} [opts]
 * @param {string} [opts.query]
 * @param {import('../types.js').EntrySource} [opts.source]
 * @param {string} [opts.gptName]
 * @param {boolean} [opts.linkedOnly]
 * @returns {Promise<import('../types.js').Entry[]>}
 */
export async function searchEntries(opts = {}) {
  const { query = '', source, gptName, linkedOnly = false } = opts;
  let rows = await db.entries.orderBy('capturedAt').reverse().toArray();

  if (source) rows = rows.filter((r) => r.source === source);
  if (gptName) rows = rows.filter((r) => (r.gptName || '').includes(gptName));

  const q = query.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        matchesQuery(r.title, q) ||
        matchesQuery(r.lyrics, q) ||
        matchesQuery(r.stylePrompt, q) ||
        matchesQuery(r.gptName, q) ||
        matchesQuery(r.searchText, q),
    );
  }

  if (linkedOnly) {
    const links = await db.links.toArray();
    const linkedIds = new Set([
      ...links.map((l) => l.chatgptEntryId),
      ...links.map((l) => l.sunoEntryId),
    ]);
    rows = rows.filter((r) => linkedIds.has(r.id));
  }

  return rows;
}

/**
 * @param {Partial<import('../types.js').Link>} link
 * @returns {Promise<import('../types.js').Link>}
 */
export async function upsertLink(link) {
  const existing = await db.links
    .where('chatgptEntryId')
    .equals(link.chatgptEntryId)
    .filter((l) => l.sunoEntryId === link.sunoEntryId)
    .first();

  /** @type {import('../types.js').Link} */
  const row = {
    id: existing?.id || link.id || newId(),
    chatgptEntryId: link.chatgptEntryId,
    sunoEntryId: link.sunoEntryId,
    linkType: link.linkType || 'manual',
    score: link.score ?? 1,
    createdAt: existing?.createdAt || link.createdAt || new Date().toISOString(),
  };
  await db.links.put(row);
  return row;
}

/**
 * @param {string} entryId
 * @returns {Promise<{ chatgpt: import('../types.js').Entry[], suno: import('../types.js').Entry[] }>}
 */
export async function getLinkedEntries(entryId) {
  const allLinks = await db.links.toArray();
  const related = allLinks.filter(
    (l) => l.chatgptEntryId === entryId || l.sunoEntryId === entryId,
  );
  const chatgptIds = new Set(related.map((l) => l.chatgptEntryId));
  const sunoIds = new Set(related.map((l) => l.sunoEntryId));

  const chatgpt = [];
  const suno = [];
  for (const id of chatgptIds) {
    const e = await db.entries.get(id);
    if (e && isAiSource(e.source)) chatgpt.push(e);
  }
  for (const id of sunoIds) {
    const e = await db.entries.get(id);
    if (e && isSunoEntrySource(e.source)) suno.push(e);
  }
  return { chatgpt, suno };
}

/**
 * @param {string} linkId
 */
export async function deleteLink(linkId) {
  await db.links.delete(linkId);
}

/**
 * @returns {Promise<{ entries: import('../types.js').Entry[], links: import('../types.js').Link[] }>}
 */
export async function exportAll() {
  const [entries, links] = await Promise.all([db.entries.toArray(), db.links.toArray()]);
  return { entries, links, exportedAt: new Date().toISOString() };
}

/**
 * @param {{ entries?: import('../types.js').Entry[], links?: import('../types.js').Link[] }} payload
 * @returns {Promise<{ entries: number, links: number }>}
 */
export async function importAll(payload) {
  let entryCount = 0;
  let linkCount = 0;
  if (payload.entries?.length) {
    for (const e of payload.entries) {
      await upsertEntry(e);
      entryCount += 1;
    }
  }
  if (payload.links?.length) {
    for (const l of payload.links) {
      await upsertLink(l);
      linkCount += 1;
    }
  }
  return { entries: entryCount, links: linkCount };
}

/**
 * @param {import('../types.js').EntrySource} source
 * @param {number} [days]
 */
export async function getEntriesBySource(source, days) {
  let rows = await db.entries.where('source').equals(source).sortBy('capturedAt');
  rows.reverse();
  if (days) {
    const cutoff = Date.now() - days * 86400000;
    rows = rows.filter((r) => new Date(r.capturedAt).getTime() >= cutoff);
  }
  return rows;
}

/**
 * @returns {Promise<number>}
 */
export async function countEntries() {
  return db.entries.count();
}

/**
 * @param {string} id
 */
export async function deleteEntry(id) {
  await db.transaction('rw', db.entries, db.links, async () => {
    await db.entries.delete(id);
    const links = await db.links.toArray();
    for (const l of links) {
      if (l.chatgptEntryId === id || l.sunoEntryId === id) {
        await db.links.delete(l.id);
      }
    }
  });
}

/**
 * @returns {Promise<Set<string>>}
 */
export async function getLinkedEntryIds() {
  const links = await db.links.toArray();
  return new Set([...links.map((l) => l.chatgptEntryId), ...links.map((l) => l.sunoEntryId)]);
}

/**
 * @param {import('../lib/cleanup-filter.js').CleanupFilters} filters
 * @returns {Promise<import('../types.js').Entry[]>}
 */
export async function findCleanupTargets(filters) {
  const [entries, linkedIds] = await Promise.all([db.entries.toArray(), getLinkedEntryIds()]);
  return filterEntriesForCleanup(entries, linkedIds, filters);
}

/**
 * @param {import('../lib/cleanup-filter.js').CleanupFilters} filters
 * @param {number} [limit]
 */
export async function previewCleanup(filters, limit = 8) {
  const targets = await findCleanupTargets(filters);
  return { count: targets.length, preview: targets.slice(0, limit) };
}

/**
 * @param {import('../lib/cleanup-filter.js').CleanupFilters} filters
 */
export async function bulkDeleteByCleanupFilters(filters) {
  const targets = await findCleanupTargets(filters);
  for (const entry of targets) {
    await deleteEntry(entry.id);
  }
  return { deleted: targets.length };
}

/**
 * @param {string} id
 * @param {boolean} protectedFlag
 */
export async function setEntryProtected(id, protectedFlag) {
  const entry = await db.entries.get(id);
  if (!entry) return undefined;
  const updated = {
    ...entry,
    protected: !!protectedFlag,
    updatedAt: new Date().toISOString(),
  };
  await db.entries.put(updated);
  return updated;
}
