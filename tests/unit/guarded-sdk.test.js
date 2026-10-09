import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { openGuardedUnit } from '../fixtures/guarded-unit.js';
import { acquireMedium } from '../fixtures/medium-guard.js';

async function setup(t) {
  const base = new URL('../../.storage-test-output/', import.meta.url);
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const root = await fs.mkdtemp(new URL('guarded-sdk-', base).pathname);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = await fs.readFile(new URL('../../.sdk-reference/storage-json/package/lib/index.js', import.meta.url), 'utf8');
  const from = source.indexOf('//#region lib/types/atomic.js'); const to = source.indexOf('//#region lib/types/per-record-unit.js', from);
  assert.ok(from >= 0 && to > from);
  const fault = {};
  class StorageError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const open = runInNewContext(`${source.slice(from, to)}\nopenSingleUnit`, {
    ...fs, dirname, join, randomUUID, process, StorageError,
    rename: async (...args) => { await fault.beforeRename?.(); await fs.rename(...args); },
    open: async (path, flags, mode) => {
      const handle = await fs.open(path, flags, mode);
      return { writeFile: (...args) => handle.writeFile(...args), close: () => handle.close(), sync: async () => {
        if (fault.directory && path === root) throw new Error('TEST_SYNC_FAILED');
        await handle.sync();
      } };
    },
  });
  const descriptor = { name: 'notebook', version: 1, hasGlobal: true, tables: [] };
  return { root, fault, open: () => open(descriptor, root, () => {}) };
}

for (const [label, bytes] of [
  ['corrupt JSON', '{broken'],
  ['future version', JSON.stringify({ unit: { name: 'notebook', version: 99 }, global: {}, tables: {} })],
]) test(`failed open protects ${label} raw bytes and retains exclusion`, async (t) => {
  const h = await setup(t); const original = join(h.root, 'notebook.json');
  await fs.writeFile(original, bytes);
  await assert.rejects(openGuardedUnit(h.root, h.open), error => error.code === 'MEDIUM_PROTECTED');
  assert.equal(await fs.readFile(original, 'utf8'), bytes);
  const copies = (await fs.readdir(h.root)).filter(name => name.includes('.protected-') && name.endsWith('.json'));
  assert.equal(copies.length, 1); assert.equal(await fs.readFile(join(h.root, copies[0]), 'utf8'), bytes);
  await assert.rejects(acquireMedium(h.root), error => error.code === 'WRITER_EXISTS');
});

test('failed open protection failure never reports protected or releases the lock', async (t) => {
  const h = await setup(t); await fs.writeFile(join(h.root, 'notebook.json'), '{broken');
  await assert.rejects(openGuardedUnit(h.root, h.open, { guardHooks: { beforeDirectorySync: async stage => {
    if (stage === 'protect') throw new Error('TEST_PROTECT_FAIL');
  } } }), error => error.code === 'PROTECTION_FAILED');
  assert.equal(await fs.readFile(join(h.root, 'notebook.json'), 'utf8'), '{broken');
  await assert.rejects(acquireMedium(h.root), error => error.code === 'WRITER_EXISTS');
});

test('live protection failure freezes pending writes and retains lock after close', async (t) => {
  const h = await setup(t); const adapter = await openGuardedUnit(h.root, h.open, { guardHooks: { beforeDirectorySync: async stage => {
    if (stage === 'protect') throw new Error('TEST_PROTECT_FAIL');
  } } });
  await adapter.setGlobal({ revision: 1 });
  const results = await Promise.allSettled([adapter.protect(), adapter.setGlobal({ revision: 2 })]);
  assert.deepEqual(results.map(result => result.reason.code), ['PROTECTION_FAILED', 'PROTECTION_FAILED']);
  await assert.rejects(adapter.close(), error => error.code === 'PROTECTION_FAILED');
  assert.equal(JSON.parse(await fs.readFile(join(h.root, 'notebook.json'), 'utf8')).global.revision, 1);
  await assert.rejects(acquireMedium(h.root), error => error.code === 'WRITER_EXISTS');
});

test('preexisting lock ownership loss freezes SDK writes before publish without removing replacement', async (t) => {
  const h = await setup(t); const adapter = await openGuardedUnit(h.root, h.open);
  await adapter.setGlobal({ revision: 1 });
  const lock = join(h.root, 'notebook.writer.lock');
  await fs.writeFile(lock, 'foreign-test-owner'); // Synthetic medium only; never replace a real lock.
  await assert.rejects(adapter.setGlobal({ revision: 2 }), error => error.code === 'OWNERSHIP_UNKNOWN');
  await assert.rejects(adapter.setGlobal({ revision: 3 }), error => error.code === 'COMMIT_UNKNOWN');
  await assert.rejects(adapter.close(), error => error.code === 'COMMIT_UNKNOWN');
  assert.equal(JSON.parse(await fs.readFile(join(h.root, 'notebook.json'), 'utf8')).global.revision, 1);
  assert.equal(await fs.readFile(lock, 'utf8'), 'foreign-test-owner');
});

test('guarded SDK queues snapshot protection after commit and releases only after close', async (t) => {
  const h = await setup(t); const adapter = await openGuardedUnit(h.root, h.open);
  const value = { revision: 1, quote: '原始😀\n引用' };
  try {
    const writing = adapter.setGlobal(value); value.quote = 'outside';
    const protecting = adapter.protect();
    await writing; const backup = await protecting;
    assert.equal(JSON.parse(await fs.readFile(backup.path, 'utf8')).global.quote, '原始😀\n引用');
    await assert.rejects(acquireMedium(h.root), error => error.code === 'WRITER_EXISTS');
  } finally { await adapter.close(); }
  const reopened = await openGuardedUnit(h.root, h.open);
  try { assert.equal((await reopened.loadAll()).global.revision, 1); }
  finally { await reopened.close(); }
});

test('guarded SDK close drains paused commit and rejects new requests without early unlock', async (t) => {
  const h = await setup(t); let reached; const atRename = new Promise(resolve => { reached = resolve; });
  let resume; const gate = new Promise(resolve => { resume = resolve; });
  h.fault.beforeRename = async () => { reached(); await gate; };
  const adapter = await openGuardedUnit(h.root, h.open);
  const writing = adapter.setGlobal({ revision: 1 }); await atRename;
  const closing = adapter.close();
  try {
    await assert.rejects(adapter.setGlobal({ revision: 2 }), error => error.code === 'CLOSED');
    await assert.rejects(acquireMedium(h.root), error => error.code === 'WRITER_EXISTS');
  } finally { resume(); await writing; await closing; }
  const next = await acquireMedium(h.root); await next.release();
});

test('ambiguous SDK write closes unit but retains exclusion and rejects later access', async (t) => {
  const h = await setup(t); const adapter = await openGuardedUnit(h.root, h.open);
  h.fault.directory = true;
  await assert.rejects(adapter.setGlobal({ revision: 1 }), error => error.code === 'COMMIT_UNKNOWN');
  await assert.rejects(adapter.protect(), error => error.code === 'COMMIT_UNKNOWN');
  await assert.rejects(adapter.close(), error => error.code === 'COMMIT_UNKNOWN');
  await assert.rejects(acquireMedium(h.root), error => error.code === 'WRITER_EXISTS');
  assert.equal(JSON.parse(await fs.readFile(join(h.root, 'notebook.json'), 'utf8')).global.revision, 1);
});

test('SDK close failure retains lock and repeated close preserves rejected disposal', async (t) => {
  const h = await setup(t); const error = new Error('TEST_CLOSE_FAILURE');
  let closeCalls = 0;
  const adapter = await openGuardedUnit(h.root, async () => {
    const unit = await h.open();
    return { loadAll: () => unit.loadAll(), setGlobal: value => unit.setGlobal(value),
      close: async () => { closeCalls++; await unit.close(); throw error; } };
  });
  await adapter.setGlobal({ revision: 1 });
  const first = adapter.close(); assert.equal(adapter.close(), first);
  await assert.rejects(first, cause => cause === error);
  assert.equal(closeCalls, 1);
  await assert.rejects(acquireMedium(h.root), cause => cause.code === 'WRITER_EXISTS');
});
