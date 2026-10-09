import test from 'node:test';
import assert from 'node:assert/strict';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { createNote } from '../../src/note-domain.js';
import { notebookSchema } from '../../src/notebook-schema.js';
import { snapshotCoordinator } from '../../src/snapshot-coordinator.js';

const time = '2026-10-05T00:00:00.000Z';
const request = (id, expectedRevision = 0) => ({ requestId: `intent_${id}`, epoch: 'test-epoch', expectedRevision,
  id, bodyMarkdown: `正文 ${id}` });
const candidate = (current, intent) => createNote(current, { kind: 'manual', bodyMarkdown: intent.bodyMarkdown },
  { id: intent.id, time, expectedRevision: intent.expectedRevision }, value => notebookSchema.parse(value));

test('physical metadata overhead rejects before I/O without freezing a later smaller commit', async () => {
  const domain = medium();
  domain.estimateBytes = value => Object.hasOwn(value.notes, 'large') ? 1024 * 1024 + 1 : 4096;
  const store = snapshotCoordinator({ domain });
  await assert.rejects(store.mutate(request('large'), candidate), { code: 'SNAPSHOT_LIMIT' });
  assert.equal(domain.writes(), 0);
  assert.equal(store.read().revision, 0);
  await store.mutate(request('small'), candidate);
  assert.equal(domain.writes(), 1);
  assert.equal(store.read().revision, 1);
  await store.close();
});

test('explicit production receipt capacity supports more than the preview 1000 operations', async () => {
  const initial = notebookFixture();
  for (let index = 0; index < 1000; index++) initial.operationReceipts[`old_${index}`] = {
    payloadHash: 'a'.repeat(64), committedRevision: 0,
  };
  const store = snapshotCoordinator({ domain: medium(initial), maxReceipts: 100000,
    maxReceiptBytes: 16 * 1024 * 1024 });
  await store.mutate(request('next'), candidate);
  assert.equal(Object.keys(store.read().operationReceipts).length, 1001);
  await store.close();
});
function medium(initial = notebookFixture()) {
  let disk = structuredClone(initial);
  let writes = 0;
  return { global: { get: () => structuredClone(disk), async set(value) {
    writes++;
    disk = structuredClone(value);
  } }, readDisk: () => structuredClone(disk), writes: () => writes };
}

test('serialized Domain commits preserve both records, reject stale pages, and drain on close', async () => {
  const domain = medium();
  const store = snapshotCoordinator({ domain });
  const first = request('new1');
  const pending = store.mutate(first, candidate);
  first.bodyMarkdown = 'modified after enqueue';
  const stale = store.mutate(request('new2'), candidate);
  assert.deepEqual(await pending, { epoch: 'test-epoch', revision: 1, noteId: 'new1' });
  await assert.rejects(stale, { code: 'VERSION_CONFLICT' });
  assert.equal(store.read().notes.new1.bodyMarkdown, '正文 new1');
  await store.mutate(request('new2', 1), candidate);
  assert.deepEqual(Object.keys(domain.readDisk().notes).sort(), ['n1', 'new1', 'new2']);
  assert.equal(domain.writes(), 2);
  await store.close();
  await assert.rejects(store.mutate(request('new3', 2), candidate), { code: 'CLOSED' });
});

test('durable receipts replay the same intent across reload without another commit', async () => {
  const domain = medium();
  const store = snapshotCoordinator({ domain });
  const intent = request('new1');
  const first = await store.mutate(intent, candidate);
  const reordered = { bodyMarkdown: intent.bodyMarkdown, expectedRevision: intent.expectedRevision,
    id: intent.id, epoch: intent.epoch, requestId: intent.requestId };
  assert.deepEqual(await store.mutate(reordered, candidate), first);
  await store.close();
  const reopened = snapshotCoordinator({ domain });
  assert.deepEqual(await reopened.mutate(intent, candidate), first);
  await assert.rejects(reopened.mutate({ ...intent, bodyMarkdown: 'tampered' }, candidate),
    { code: 'REQUEST_ID_REUSED' });
  assert.equal(domain.writes(), 1);
  await reopened.close();
});

test('receipt capacity never silently expires an intent', async () => {
  const initial = notebookFixture();
  for (let index = 0; index < 1000; index++) initial.operationReceipts[`old_${index}`] = {
    payloadHash: 'a'.repeat(64), committedRevision: 0 };
  const domain = medium(initial);
  const store = snapshotCoordinator({ domain });
  await assert.rejects(store.mutate(request('new1'), candidate), { code: 'RECEIPT_LIMIT' });
  assert.equal(domain.writes(), 0);
  await store.close();
});

test('receipt byte budget blocks growth without expiring existing intents', async () => {
  const initial = notebookFixture();
  const baseline = Buffer.byteLength(JSON.stringify(initial.operationReceipts), 'utf8');
  assert.equal(baseline, 2);
  const domain = medium(initial);
  const store = snapshotCoordinator({ domain, maxReceiptBytes: 10 });
  await assert.rejects(store.mutate(request('new1'), candidate), { code: 'RECEIPT_LIMIT' });
  assert.equal(domain.writes(), 0);
  await store.close();
  const existing = notebookFixture(); existing.operationReceipts.old = {
    payloadHash: 'a'.repeat(64), committedRevision: 0 };
  assert.throws(() => snapshotCoordinator({ domain: medium(existing), maxReceiptBytes: 10 }),
    { code: 'RECEIPT_LIMIT' });
});

test('candidate cannot tamper with existing receipts through its current argument', async () => {
  const initial = notebookFixture();
  initial.operationReceipts.old = { payloadHash: 'a'.repeat(64), committedRevision: 0 };
  const domain = medium(initial);
  const store = snapshotCoordinator({ domain });
  await assert.rejects(store.mutate(request('new1'), (current, intent) => {
    current.operationReceipts.old.payloadHash = 'b'.repeat(64);
    return candidate(current, intent);
  }), { code: 'VALIDATION_FAILED' });
  assert.equal(domain.writes(), 0);
  assert.deepEqual(domain.readDisk(), initial);
  await store.close();
});

test('candidate cannot mutate the hashed request or forge its receipt result', async () => {
  const domain = medium();
  const store = snapshotCoordinator({ domain });
  const intent = request('new1');
  await assert.rejects(store.mutate(intent, (current, editable) => {
    editable.id = 'forged'; editable.bodyMarkdown = 'forged';
    return candidate(current, editable);
  }), { code: 'VALIDATION_FAILED' });
  assert.equal(domain.writes(), 0);
  const result = await store.mutate(intent, candidate);
  assert.equal(result.noteId, 'new1');
  assert.equal(domain.readDisk().notes.forged, undefined);
  assert.equal(domain.readDisk().notes.new1.bodyMarkdown, intent.bodyMarkdown);
  await store.close();
});

test('a failed live Domain read freezes queued and future writes with safe diagnostics', async () => {
  const domain = medium();
  const originalGet = domain.global.get;
  let failNext = true;
  const store = snapshotCoordinator({ domain });
  domain.global.get = () => {
    if (failNext) { failNext = false; throw new Error('raw path /private/token'); }
    return originalGet();
  };
  const results = await Promise.allSettled([store.mutate(request('new1'), candidate),
    store.mutate(request('new2'), candidate)]);
  assert.deepEqual(results.map(result => result.reason?.code), ['READ_UNAVAILABLE', 'COMMIT_UNKNOWN']);
  assert.equal(results[0].reason.message, 'READ_UNAVAILABLE');
  assert.equal(domain.writes(), 0);
  await assert.rejects(store.mutate(request('new3'), candidate), { code: 'COMMIT_UNKNOWN' });
  assert.throws(() => store.read(), { code: 'COMMIT_UNKNOWN' });
  await store.close();
});

test('bad medium and oversized candidate never become a new empty library', async () => {
  const invalid = notebookFixture(); invalid.schemaVersion = 99;
  assert.throws(() => snapshotCoordinator({ domain: medium(invalid) }), { code: 'VALIDATION_FAILED' });
  const domain = medium();
  const store = snapshotCoordinator({ domain, maxSnapshotBytes: 900 });
  await assert.rejects(store.mutate(request('large'), (current, intent) => candidate(current,
    { ...intent, bodyMarkdown: '😀'.repeat(300) })), { code: 'SNAPSHOT_LIMIT' });
  assert.equal(domain.writes(), 0);
  assert.equal(store.read().revision, 0);
  await store.close();
});

test('unknown result freezes future writes even when medium already committed', async () => {
  const domain = medium();
  const originalSet = domain.global.set;
  domain.global.set = async value => { await originalSet(value); throw new Error('raw path and secret'); };
  const store = snapshotCoordinator({ domain });
  const pending = [store.mutate(request('new1'), candidate), store.mutate(request('new2'), candidate)];
  const settled = await Promise.allSettled(pending);
  assert.deepEqual(settled.map(result => result.reason?.code), ['COMMIT_UNKNOWN', 'COMMIT_UNKNOWN']);
  assert.equal(domain.readDisk().revision, 1);
  await assert.rejects(store.mutate(request('new3', 1), candidate), { code: 'COMMIT_UNKNOWN' });
  assert.equal(domain.writes(), 1);
  await store.close();
});

test('candidate failures expose only allowlisted safe codes and do not poison subsequent writes', async () => {
  const domain = medium();
  const store = snapshotCoordinator({ domain });
  await assert.rejects(store.mutate(request('bad1'), () => {
    throw new Error('private path /sensitive/data');
  }), error => error.code === 'VALIDATION_FAILED' && error.message === 'VALIDATION_FAILED');
  await assert.rejects(store.mutate(request('bad2'), () => {
    throw Object.assign(new Error('secret in domain conflict'), { code: 'VERSION_CONFLICT' });
  }), error => error.code === 'VERSION_CONFLICT' && error.message === 'VERSION_CONFLICT');
  await assert.rejects(store.mutate(request('bad3'), () => {
    throw Object.assign(new Error('private token'), { code: 'UNRECOGNIZED_ERROR' });
  }), error => error.code === 'VALIDATION_FAILED' && error.message === 'VALIDATION_FAILED');
  assert.equal(domain.writes(), 0);
  await store.mutate(request('valid'), candidate);
  assert.equal(domain.writes(), 1);
  await store.close();
});

test('preflight failures do not invoke Domain and allow a later valid write', async () => {
  const domain = medium();
  const store = snapshotCoordinator({ domain, maxRequestBytes: 170 });
  await assert.rejects(store.mutate({ ...request('bad'), extra: '😀'.repeat(100) }, candidate), { code: 'REQUEST_LIMIT' });
  await assert.rejects(store.mutate({ ...request('bad'), bodyMarkdown: undefined }, candidate), { code: 'VALIDATION_FAILED' });
  await assert.rejects(store.mutate({ ...request('bad'), epoch: 'another' }, candidate), { code: 'EPOCH_CONFLICT' });
  assert.equal(domain.writes(), 0);
  await store.mutate(request('valid'), candidate);
  assert.equal(domain.writes(), 1);
  await store.close();
});
