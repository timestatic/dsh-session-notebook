import test from 'node:test';
import assert from 'node:assert/strict';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { measureRequestBytes, measureSnapshotBytes } from '../../src/snapshot-budget.js';

test('complete serialized UTF-8 Snapshot fits an explicit bounded preview budget', () => {
  const source = notebookFixture();
  const original = structuredClone(source);
  const { snapshot, bytes } = measureSnapshotBytes(source);
  assert.equal(bytes, Buffer.byteLength(JSON.stringify(source), 'utf8'));
  assert.ok(bytes > JSON.stringify(source).length, 'emoji and Chinese require additional UTF-8 bytes');
  snapshot.notes.n1.bodyMarkdown = 'outside';
  assert.deepEqual(source, original);
  assert.throws(() => measureSnapshotBytes(source, { maxBytes: bytes - 1 }), { code: 'SNAPSHOT_LIMIT' });
  assert.equal(measureSnapshotBytes(source, { maxBytes: bytes }).bytes, bytes);
  assert.equal(source.notes.n1.quote.content, original.notes.n1.quote.content);
});

test('bad or future business snapshots cannot be misreported as empty or over budget', () => {
  for (const mutate of [value => { value.schemaVersion = 99; },
    value => { value.notes.n1.quote.content = ''; },
    value => { value.tags.t1.deletedAt = value.tags.t1.createdAt; }]) {
    const value = notebookFixture(); mutate(value);
    assert.throws(() => measureSnapshotBytes(value), { code: 'VALIDATION_FAILED' });
  }
  assert.throws(() => measureSnapshotBytes(notebookFixture(), { maxBytes: 0 }), { code: 'INVALID_LIMIT' });
});

test('raw request preflight measures bytes and refuses lossy JSON or getters', () => {
  const request = { requestId: 'req_1', bodyMarkdown: '😀中文\n'.repeat(50) };
  const bytes = Buffer.byteLength(JSON.stringify(request), 'utf8');
  assert.equal(measureRequestBytes(request, { maxBytes: bytes }), bytes);
  assert.throws(() => measureRequestBytes(request, { maxBytes: bytes - 1 }), { code: 'REQUEST_LIMIT' });
  for (const value of [{ field: undefined }, { field: NaN }, { field: Infinity }, { field: () => 1 },
    { list: [, 'x'] }, { list: ['x'] }]) {
    if (value.list?.length === 1 && 0 in value.list) value.list.extra = 'hidden';
    assert.throws(() => measureRequestBytes(value), { code: 'VALIDATION_FAILED' });
  }
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => measureRequestBytes(cyclic), { code: 'VALIDATION_FAILED' });
  let called = false;
  const getter = {};
  Object.defineProperty(getter, 'body', { enumerable: true, get() { called = true; return 'unsafe'; } });
  assert.throws(() => measureRequestBytes(getter), { code: 'VALIDATION_FAILED' });
  assert.equal(called, false);
});
