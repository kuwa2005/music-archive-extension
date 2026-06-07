import Dexie from 'dexie';

export class MusicArchiveDB extends Dexie {
  /** @type {Dexie.Table<import('../types.js').Entry, string>} */
  entries;

  /** @type {Dexie.Table<import('../types.js').Link, string>} */
  links;

  constructor() {
    super('MusicArchiveDB');
    this.version(1).stores({
      entries: 'id, source, clipId, conversationId, title, gptName, capturedAt, [source+clipId], [source+conversationId]',
      links: 'id, chatgptEntryId, sunoEntryId, linkType, createdAt',
    });
    this.entries = this.table('entries');
    this.links = this.table('links');
  }
}

export const db = new MusicArchiveDB();
