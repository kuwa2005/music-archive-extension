import { getAllAiEntries } from '../lib/ai-sources.js';
import { getAllSunoListEntries, isSunoEntrySource } from '../lib/suno-sources.js';
import { getEntriesBySource, upsertLink } from '../db/repository.js';
import { scorePair } from '../lib/similarity.js';
import { isAiSource } from '../lib/ai-sources.js';

/**
 * @param {import('../types.js').Entry} sunoEntry
 * @param {import('../types.js').Settings} settings
 * @returns {Promise<import('../types.js').Link[]>}
 */
export async function autoLinkSunoEntry(sunoEntry, settings) {
  if (!isSunoEntrySource(sunoEntry.source)) return [];

  const candidates = await getAllAiEntries(getEntriesBySource, settings.linkWindowDays);
  const created = [];
  const threshold = settings.linkThreshold ?? 0.75;

  for (const chat of candidates) {
    const { score, linkType } = scorePair(sunoEntry, chat);
    const effectiveType = linkType || (score >= threshold ? 'auto_lyrics' : null);
    if (!effectiveType || score < threshold) continue;

    const link = await upsertLink({
      chatgptEntryId: chat.id,
      sunoEntryId: sunoEntry.id,
      linkType: effectiveType,
      score,
    });
    created.push(link);
  }

  return created;
}

/**
 * @param {import('../types.js').Entry} aiEntry
 * @param {import('../types.js').Settings} settings
 * @returns {Promise<import('../types.js').Link[]>}
 */
export async function autoLinkAiEntry(aiEntry, settings) {
  if (!isAiSource(aiEntry.source)) return [];

  const sunoRows = await getEntriesBySource('suno_song', settings.linkWindowDays);
  const listRows = await getAllSunoListEntries(getEntriesBySource, settings.linkWindowDays);
  const candidates = [...sunoRows, ...listRows];
  const created = [];
  const threshold = settings.linkThreshold ?? 0.75;

  for (const suno of candidates) {
    const { score, linkType } = scorePair(suno, aiEntry);
    const effectiveType = linkType || (score >= threshold ? 'auto_lyrics' : null);
    if (!effectiveType || score < threshold) continue;

    const link = await upsertLink({
      chatgptEntryId: aiEntry.id,
      sunoEntryId: suno.id,
      linkType: effectiveType,
      score,
    });
    created.push(link);
  }

  return created;
}

/** @deprecated use autoLinkAiEntry */
export const autoLinkChatGPTEntry = autoLinkAiEntry;
