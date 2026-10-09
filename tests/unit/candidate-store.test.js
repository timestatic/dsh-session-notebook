import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateStore } from '../fixtures/candidate-store.js';

function initial() { return { epoch: 'test-epoch', revision: 0, receipts: {}, notes: {
  a: { body: 'A', version: 1, quote: 'immutable 😀' }, b: { body: 'B', version: 1, quote: 'immutable B' },
} }; }
function validate(value) {
  assert.equal(value.epoch, 'test-epoch'); assert.ok(Number.isInteger(value.revision));
  for (const note of Object.values(value.notes)) {
    if (!note.body.trim() || !Number.isInteger(note.version)) throw Object.assign(new Error('INVALID'), { code: 'VALIDATION_FAILED' });
  }
}
function request(id, requestId, body = 'edited') { return { id, requestId, body, epoch: 'test-epoch', expectedVersion: 1 }; }
test('receipt count quota rejects fresh intent but retains durable retry after reconstruction', async () => {
  const writes = [];
  const store = candidateStore({ initial: initial(), validate, maxReceipts: 1, persist: async value => { writes.push(value); } });
  const intent = request('a', 'first'); const result = await store.mutate(intent);
  await assert.rejects(store.mutate(request('b', 'second')), error => error.code === 'RECEIPT_LIMIT');
  assert.equal(writes.length, 1); assert.equal(store.read().notes.b.version, 1);
  assert.deepEqual(await store.mutate(intent), result); await store.close();
  const reopened = candidateStore({ initial: writes[0], validate, maxReceipts: 1, persist: async () => assert.fail('retry cannot write') });
  assert.deepEqual(await reopened.mutate(intent), result); await reopened.close();
});

test('receipt byte and complete UTF8 request limits reject before persistence', async () => {
  const store = candidateStore({ initial: initial(), validate, maxReceiptBytes: 10, persist: async () => assert.fail('quota cannot write') });
  await assert.rejects(store.mutate(request('a', 'bytes')), error => error.code === 'RECEIPT_LIMIT');
  assert.deepEqual(store.read(), initial()); await store.close();
  const bounded = candidateStore({ initial: initial(), validate, maxRequestBytes: 180, persist: async () => assert.fail('oversize cannot write') });
  await assert.rejects(bounded.mutate(request('a', 'unicode', '😀'.repeat(40))), error => error.code === 'REQUEST_LIMIT');
  await bounded.close();
});

test('prototype keys, oversized bodies and invalid versions reject without writes', async () => {
  const { store, writes } = setup();
  for (const patch of [
    { requestId: '__proto__' }, { requestId: 'constructor' }, { id: '__proto__' },
    { expectedVersion: 0 }, { expectedVersion: NaN }, { body: 'x'.repeat(100001) },
  ]) await assert.rejects(store.mutate({ ...request('a', 'boundary'), ...patch }), error => error.code === 'VALIDATION_FAILED');
  assert.equal(writes.length, 0);
  await store.mutate(request('a', 'good')); assert.equal(writes.length, 1); await store.close();
});

function setup(persist) {
  const writes = [];
  const store = candidateStore({ initial: initial(), validate, persist: persist ?? (async value => { writes.push(value); }) });
  return { store, writes };
}

test('candidate queue serializes different records and rejects stale same-record edits', async () => {
  const { store, writes } = setup();
  const results = await Promise.allSettled([store.mutate(request('a', '1')), store.mutate(request('b', '2')), store.mutate(request('a', '3'))]);
  assert.deepEqual(results.map(value => value.status), ['fulfilled', 'fulfilled', 'rejected']);
  assert.equal(results[2].reason.code, 'VERSION_CONFLICT');
  assert.equal(store.read().revision, 2); assert.equal(writes.length, 2);
  assert.equal(store.read().notes.a.quote, initial().notes.a.quote);
  await store.close();
});

test('persisted receipt retries survive reconstruction and reject changed intent', async () => {
  const { store, writes } = setup(); const intent = request('a', 'stable');
  const result = await store.mutate(intent);
  assert.deepEqual(await store.mutate({ body: intent.body, id: 'a', expectedVersion: 1, epoch: 'test-epoch', requestId: 'stable' }), result);
  assert.equal(writes.length, 1);
  const restored = candidateStore({ initial: writes[0], validate, persist: async () => assert.fail('retry must not persist') });
  assert.deepEqual(await restored.mutate(intent), result);
  await assert.rejects(restored.mutate({ ...intent, body: 'different' }), error => error.code === 'REQUEST_ID_REUSED');
  await restored.close(); await store.close();
});

test('input, read and persist references cannot mutate authoritative snapshot', async () => {
  const input = initial(); let saved;
  const store = candidateStore({ initial: input, validate, persist: async value => { saved = value; } });
  input.notes.a.body = 'outside'; const intent = request('a', 'frozen', 'inside');
  const pending = store.mutate(intent); intent.body = 'late mutation'; await pending;
  saved.notes.a.body = 'persist mutation'; const read = store.read(); read.notes.a.body = 'read mutation';
  assert.equal(store.read().notes.a.body, 'inside');
  await store.close();
});

test('unknown commit freezes queued/future mutations and preserves old authoritative state', async () => {
  let disk = initial(); let calls = 0;
  const { store } = setup(async value => { disk = value; calls++; throw new Error('simulated post-rename failure'); });
  const results = await Promise.allSettled([store.mutate(request('a', 'one')), store.mutate(request('b', 'two'))]);
  assert.deepEqual(results.map(value => value.reason.code), ['COMMIT_UNKNOWN', 'COMMIT_UNKNOWN']);
  assert.equal(calls, 1); assert.equal(disk.revision, 1); assert.equal(store.read().revision, 0);
  await assert.rejects(store.mutate(request('b', 'three')), error => error.code === 'COMMIT_UNKNOWN');
  await store.close();
});

test('validation and epoch failures do not persist or poison queue; close drains and rejects new work', async () => {
  const { store, writes } = setup();
  await assert.rejects(store.mutate({ ...request('a', 'bad'), quote: 'tamper' }), error => error.code === 'VALIDATION_FAILED');
  await assert.rejects(store.mutate({ ...request('a', 'old'), epoch: 'old-epoch' }), error => error.code === 'EPOCH_CONFLICT');
  await assert.rejects(store.mutate(request('a', 'empty', ' ')), error => error.code === 'VALIDATION_FAILED');
  assert.equal(writes.length, 0);
  const pending = store.mutate(request('b', 'valid')); const closing = store.close();
  await assert.rejects(store.mutate(request('a', 'closed')), error => error.code === 'CLOSED');
  await pending; await closing; assert.equal(writes.length, 1);
});
