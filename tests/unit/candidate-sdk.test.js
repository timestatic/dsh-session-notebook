import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { dirname, join, resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { candidateStore } from '../fixtures/candidate-store.js';

// Actual SDK backend + queue prototype; no full Cordis/Domain/product Schema.
async function setup() {
  const base = new URL('../../.storage-test-output/', import.meta.url);
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const root = await fs.mkdtemp(new URL('candidate-', base).pathname);
  const source = await fs.readFile(new URL('../../.sdk-reference/storage-json/package/lib/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('//#region lib/types/atomic.js');
  const end = source.indexOf('//#region lib/types/per-record-unit.js', start);
  assert.ok(start >= 0 && end > start);
  let failDirectory = false;
  class StorageError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const openUnit = runInNewContext(`${source.slice(start, end)}\nopenSingleUnit`, {
    ...fs, dirname, join, randomUUID, process, StorageError,
    open: async (path, flags, mode) => {
      const handle = await fs.open(path, flags, mode);
      return { writeFile: (...args) => handle.writeFile(...args), close: () => handle.close(), sync: async () => {
        if (failDirectory && path === root) throw new Error('TEST_DIRECTORY_SYNC');
        await handle.sync();
      } };
    },
  });
  const descriptor = { name: 'dsh-session-notebook-candidate-test', version: 1, hasGlobal: true, tables: [] };
  const initial = { epoch: 'test', revision: 0, receipts: {}, notes: { a: { version: 1, body: 'old', quote: 'immutable😀' } } };
  const validate = value => {
    assert.equal(value.epoch, 'test'); assert.ok(Number.isInteger(value.revision));
    assert.ok(value.notes.a.body.trim()); assert.ok(value.receipts);
  };
  const unit = await openUnit(descriptor, root, () => {});
  await unit.setGlobal(initial);
  const storeFor = async backend => candidateStore({ initial: (await backend.loadAll()).global, validate,
    persist: value => backend.setGlobal(value) });
  return { unit, storeFor, reopen: () => openUnit(descriptor, root, () => {}),
    injectFailure: () => { failDirectory = true; },
    disk: async () => JSON.parse(await fs.readFile(join(root, `${descriptor.name}.json`), 'utf8')).global,
    async cleanup() {
      const parent = resolve(new URL('../../.storage-test-output/', import.meta.url).pathname);
      if (resolve(dirname(root)) !== parent || !basename(root).startsWith('candidate-'))
        throw new Error('UNSAFE_TEST_CLEANUP');
      await fs.rm(root, { recursive: true, force: true });
    } };
}
const intent = { requestId: 'stable', epoch: 'test', id: 'a', expectedVersion: 1, body: 'new\n😀' };

test('queue + actual SDK persists receipt and retries without a second disk mutation after reopen', async () => {
  const h = await setup(); let backend = h.unit; let store = await h.storeFor(backend);
  try {
    const result = await store.mutate(intent); await store.close(); await backend.close();
    backend = await h.reopen(); store = await h.storeFor(backend);
    assert.deepEqual(await store.mutate(intent), result);
    assert.equal((await h.disk()).revision, 1); assert.equal(store.read().notes.a.quote, 'immutable😀');
  } finally { try { await store.close(); await backend.close(); } finally { await h.cleanup(); } }
});

test('queue + SDK post-rename failure blocks retries on live handle; reopen receipt resolves uncertainty', async () => {
  const h = await setup(); let backend = h.unit; let store = await h.storeFor(backend);
  try {
    h.injectFailure();
    await assert.rejects(store.mutate(intent), error => error.code === 'COMMIT_UNKNOWN');
    assert.equal(store.read().revision, 0); assert.equal((await h.disk()).revision, 1);
    await assert.rejects(store.mutate(intent), error => error.code === 'COMMIT_UNKNOWN');
    await store.close(); await backend.close();
    // Isolated sole-writer test only; production must protect/exclude before reread.
    backend = await h.reopen(); store = await h.storeFor(backend);
    assert.deepEqual(await store.mutate(intent), { id: 'a', version: 2, revision: 1 });
    assert.equal((await h.disk()).revision, 1);
  } finally { try { await store.close(); await backend.close(); } finally { await h.cleanup(); } }
});
