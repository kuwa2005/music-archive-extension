/**
 * sunoCreatedAt の保存マージと capture 応答アンラップの単体テスト
 */
import { coerceSunoCreatedAt, pickSunoCreatedAt } from '../src/lib/suno-created-at.js';
import { resolveSavePayload, unwrapCapturePayload, mergeSunoCreatedAtFields, prepareSaveEntry } from '../src/lib/capture-payload.js';

const ISO = '2026-05-10T03:25:15.936Z';

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  }
}

function testCoerceSunoCreatedAt() {
  assert(coerceSunoCreatedAt(ISO) === ISO, 'ISO string preserved');
  assert(coerceSunoCreatedAt(`  ${ISO}  `) === ISO, 'trimmed ISO string');
  assert(coerceSunoCreatedAt('') === undefined, 'empty string → undefined');
  assert(coerceSunoCreatedAt(undefined) === undefined, 'undefined stays undefined');
  assert(
    coerceSunoCreatedAt(new Date(ISO).getTime()) === ISO,
    'numeric timestamp coerced to ISO',
  );
}

function testPickSunoCreatedAt() {
  assert(
    pickSunoCreatedAt({ sunoCreatedAt: ISO }, { sunoCreatedAt: '2026-01-01T00:00:00.000Z' }) === ISO,
    'incoming value wins over existing',
  );
  assert(
    pickSunoCreatedAt({}, { sunoCreatedAt: ISO }) === ISO,
    'falls back to existing when incoming missing',
  );
  assert(
    pickSunoCreatedAt({ sunoCreatedAt: '   ' }, { sunoCreatedAt: ISO }) === ISO,
    'blank incoming falls back to existing',
  );
}

function testUnwrapCapturePayload() {
  const entry = {
    source: 'suno_song',
    title: 'test',
    sunoCreatedAt: ISO,
    clipId: '5aa8a82d-851a-4f3a-a135-eb5a84b9083e',
  };
  assert(
    JSON.stringify(unwrapCapturePayload({ success: true, data: entry })) === JSON.stringify(entry),
    'nested data payload unwrapped',
  );
  assert(
    unwrapCapturePayload({ success: true, ...entry })?.sunoCreatedAt === ISO,
    'flat capture payload unwrapped',
  );
  assert(unwrapCapturePayload({ success: false }) === null, 'failed capture → null');
  const listEntries = [
    { source: 'suno_list', title: 'a', clipId: '11111111-1111-1111-1111-111111111111' },
    { source: 'suno_workspace', title: 'b', clipId: '22222222-2222-2222-2222-222222222222' },
  ];
  assert(
    JSON.stringify(unwrapCapturePayload({ success: true, data: listEntries })) ===
      JSON.stringify(listEntries),
    'list capture array payload unwrapped',
  );
}

function testResolveSavePayload() {
  const entry = { source: 'suno_song', title: 't', clipId: 'abc' };
  assert(
    resolveSavePayload({ data: { ...entry, sunoCreatedAt: ISO } }).sunoCreatedAt === ISO,
    'saveEntry data field',
  );
  assert(
    resolveSavePayload({ captured: { ...entry, sunoCreatedAt: ISO } }).sunoCreatedAt === ISO,
    'saveCapturedData captured field',
  );
  assert(
    resolveSavePayload({ ...entry, sunoCreatedAt: ISO, action: 'saveEntry' }).sunoCreatedAt === ISO,
    'flat saveEntry request fields',
  );
  assert(
    resolveSavePayload({
      data: entry,
      sunoCreatedAt: ISO,
    }).sunoCreatedAt === ISO,
    'top-level sunoCreatedAt merged into nested data',
  );
}

function testPrepareSaveEntry() {
  const entry = { source: 'suno_song', title: 't', clipId: 'abc' };
  assert(
    prepareSaveEntry(entry, { sunoCreatedAt: ISO })?.sunoCreatedAt === ISO,
    'prepareSaveEntry merges top-level sunoCreatedAt',
  );
  assert(prepareSaveEntry({}, { sunoCreatedAt: ISO }) === null, 'prepareSaveEntry rejects empty');
}

function testUnwrapTopLevelSunoCreatedAt() {
  const entry = { source: 'suno_song', title: 't', clipId: 'abc' };
  assert(
    unwrapCapturePayload({ success: true, data: entry, sunoCreatedAt: ISO })?.sunoCreatedAt === ISO,
    'unwrap merges top-level sunoCreatedAt into nested data',
  );
}

testCoerceSunoCreatedAt();
testPickSunoCreatedAt();
testUnwrapCapturePayload();
testResolveSavePayload();
testPrepareSaveEntry();
testUnwrapTopLevelSunoCreatedAt();

if (process.exitCode) {
  console.error('\nSome save-path tests failed.');
  process.exit(1);
}
console.log('\nOK: save-path sunoCreatedAt tests');
