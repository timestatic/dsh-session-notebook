import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { snapshotBackend } from '../fixtures/snapshot-backend.js';
import { autoTestRoot } from '../fixtures/auto-test-root.js';
const descriptor = { name: 'notebook', version: 1, layout: 'single', hasGlobal: true, tables: [] };
async function root() {
  return autoTestRoot('snapshot-lifecycle-');
}
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('failed pending open is observable on close and preserves residual exclusion', async () => {
  const dir = await root(); const entered = defer(); const resume = defer();
  const backend = snapshotBackend(dir, async () => { entered.resolve(); await resume.promise; throw new Error('TEST_OPEN'); }, { parse: value => value });
  const opening = backend.kv.open(descriptor);
  const rejectedOpen = assert.rejects(opening, error => error.code === 'OPEN_FAILED');
  await entered.promise; const closing = backend.close();
  const rejectedClose = assert.rejects(closing, error => error instanceof AggregateError && error.errors[0].code === 'OPEN_FAILED');
  resume.resolve(); await rejectedOpen; await rejectedClose;
  assert.equal((await fs.readdir(dir)).includes('notebook.writer.lock'), true);
  assert.equal(backend.close(), closing);
});

test('invalid descriptor refusal does not poison clean backend disposal', async () => {
  const dir = await root();
  const backend = snapshotBackend(dir, async () => { assert.fail('no SDK open'); }, { parse: value => value });
  await assert.rejects(backend.kv.open({ ...descriptor, name: 'foreign' }), error => error.code === 'DESCRIPTOR_REJECTED');
  await backend.close(); assert.deepEqual(await fs.readdir(dir), []);
});

test('backend close drains in-flight open and commit, rejects new opens and memoizes disposal', async () => {
  const dir = await root(); const entered = defer(); const resume = defer(); let rawClosed = 0;
  const backend = snapshotBackend(dir, async () => {
    entered.resolve(); await resume.promise;
    return { loadAll: async () => ({ global: null, tables: {} }), close: async () => { rawClosed++; } };
  }, { parse: value => value });
  const opening = backend.kv.open(descriptor); await entered.promise;
  const closing = backend.close(); assert.equal(backend.close(), closing);
  await assert.rejects(backend.kv.open(descriptor), error => error.code === 'CLOSED');
  assert.equal(rawClosed, 0); resume.resolve(); await opening; await closing;
  assert.equal(rawClosed, 1); assert.equal((await fs.readdir(dir)).includes('notebook.writer.lock'), false);
});

test('backend close waits for queued commit and reports ambiguous failure with residual lock', async () => {
  const dir = await root(); const entered = defer(); const resume = defer();
  const backend = snapshotBackend(dir, async () => ({
    loadAll: async () => ({ global: null, tables: {} }), close: async () => {},
    setGlobal: async () => { entered.resolve(); await resume.promise; throw new Error('TEST_UNKNOWN'); },
  }), { parse: value => value });
  const unit = await backend.kv.open(descriptor); const writing = unit.setGlobal({ test: true });
  const rejectedWrite = assert.rejects(writing, error => error.code === 'COMMIT_UNKNOWN');
  await entered.promise; const closing = backend.close();
  const rejectedClose = assert.rejects(closing, error => error instanceof AggregateError && error.errors[0].code === 'COMMIT_UNKNOWN');
  resume.resolve(); await rejectedWrite; await rejectedClose;
  assert.equal(backend.close(), closing);
  assert.equal((await fs.readdir(dir)).includes('notebook.writer.lock'), true);
});
