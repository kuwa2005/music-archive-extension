/**
 * リンク解除リポジトリ関数のユニットテスト（Dexie なし・ロジック検証）
 */
import assert from 'node:assert/strict';

function getLinksBetweenEntryIds(allLinks, entryIds) {
  const idSet = new Set(entryIds);
  return allLinks.filter((l) => idSet.has(l.chatgptEntryId) && idSet.has(l.sunoEntryId));
}

function getLinksForEntry(allLinks, entryId) {
  return allLinks.filter((l) => l.chatgptEntryId === entryId || l.sunoEntryId === entryId);
}

const links = [
  { id: 'l1', chatgptEntryId: 'a1', sunoEntryId: 's1' },
  { id: 'l2', chatgptEntryId: 'a1', sunoEntryId: 's2' },
  { id: 'l3', chatgptEntryId: 'a2', sunoEntryId: 's2' },
  { id: 'l4', chatgptEntryId: 'a2', sunoEntryId: 's3' },
];

assert.equal(getLinksBetweenEntryIds(links, ['a1', 's1']).length, 1);
assert.equal(getLinksBetweenEntryIds(links, ['a1', 's1', 's2']).length, 2);
assert.equal(getLinksBetweenEntryIds(links, ['a1', 'a2']).length, 0);
assert.equal(getLinksBetweenEntryIds(links, ['a1', 's3']).length, 0);

assert.equal(getLinksForEntry(links, 'a1').length, 2);
assert.equal(getLinksForEntry(links, 's2').length, 2);
assert.equal(getLinksForEntry(links, 's3').length, 1);

console.log('test-link-removal: OK');
