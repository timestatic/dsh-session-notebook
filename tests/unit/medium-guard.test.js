import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { acquireMedium } from '../fixtures/medium-guard.js';

async function root(t) {
  const base = new URL('../../.storage-test-output/', import.meta.url);
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const dir = await fs.mkdtemp(new URL('guard-', base).pathname);
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test('acquire directory sync failure leaves a rejecting residual lock', async (t) => {
  const dir = await root(t);
  await assert.rejects(acquireMedium(dir, { beforeDirectorySync: async () => { throw new Error('SYNC_FAIL'); } }), error => error.code === 'LOCK_FAILED');
  await assert.rejects(acquireMedium(dir), error => error.code === 'WRITER_EXISTS');
});

test('release waits for pending protection and refuses new work', async (t) => {
  const dir = await root(t); await fs.writeFile(join(dir, 'notebook.json'), 'original');
  let entered; const atSync = new Promise(resolve => { entered = resolve; });
  let proceed; const gate = new Promise(resolve => { proceed = resolve; });
  const guard = await acquireMedium(dir, { beforeDirectorySync: async stage => {
    if (stage === 'protect') { entered(); await gate; }
  } });
  const protecting = guard.protect(); await atSync;
  const closing = guard.release();
  try {
    await assert.rejects(guard.protect(), error => error.code === 'GUARD_CLOSED');
    await assert.rejects(acquireMedium(dir), error => error.code === 'WRITER_EXISTS');
  } finally { proceed(); await protecting; await closing; }
  const next = await acquireMedium(dir); await next.release();
});

test('protection directory sync failure rejects success and keeps original plus lock', async (t) => {
  const dir = await root(t); await fs.writeFile(join(dir, 'notebook.json'), '{broken');
  const guard = await acquireMedium(dir, { beforeDirectorySync: async stage => {
    if (stage === 'protect') throw new Error('PROTECTION_SYNC_FAIL');
  } });
  try {
    await assert.rejects(guard.protect(), /PROTECTION_SYNC_FAIL/);
    assert.equal(await fs.readFile(join(dir, 'notebook.json'), 'utf8'), '{broken');
    await assert.rejects(acquireMedium(dir), error => error.code === 'WRITER_EXISTS');
  } finally { await guard.release(); }
});

test('guard rejects symlink and oversized source without creating a protection copy', async (t) => {
  for (const kind of ['symlink', 'oversized']) {
    const dir = await root(t);
    if (kind === 'symlink') {
      await fs.writeFile(join(dir, 'other.json'), 'private synthetic data');
      await fs.symlink(join(dir, 'other.json'), join(dir, 'notebook.json'));
    } else await fs.writeFile(join(dir, 'notebook.json'), Buffer.alloc(1024 * 1024 + 1));
    const guard = await acquireMedium(dir);
    try {
      await assert.rejects(guard.protect(), error => error.code === 'UNSAFE_MEDIUM');
      assert.equal((await fs.readdir(dir)).filter(name => name.includes('.protected-')).length, 0);
    } finally { await guard.release(); }
  }
});

test('offline-only close refuses release, retains exact lock and requires separately authorized recovery', async (t) => {
  const dir = await root(t);
  const guard = await acquireMedium(dir, { retainLockOnClose: true });
  await assert.rejects(guard.release(), error => error.code === 'OFFLINE_RECOVERY_REQUIRED');
  await assert.rejects(guard.release(), error => error.code === 'OFFLINE_RECOVERY_REQUIRED');
  await assert.rejects(guard.protect(), error => error.code === 'GUARD_CLOSED');
  await assert.rejects(acquireMedium(dir), error => error.code === 'WRITER_EXISTS');
  assert.ok((await fs.readdir(dir)).includes('notebook.writer.lock'));
});

test('release directory-sync failure after unlink exposes a new-writer window; not safe to promote', async (t) => {
  const dir = await root(t);
  const guard = await acquireMedium(dir, { beforeDirectorySync: async stage => {
    if (stage === 'release') throw new Error('TEST_RELEASE_SYNC_FAILURE');
  } });
  await assert.rejects(guard.release(), error => error.code === 'RELEASE_UNKNOWN' && !error.message.includes('TEST_'));
  await assert.rejects(guard.release(), error => error.code === 'RELEASE_UNKNOWN');
  await assert.rejects(guard.protect(), error => error.code === 'GUARD_CLOSED');
  assert.equal((await fs.readdir(dir)).includes('notebook.writer.lock'), false);
  // This is an observed unsafe behavior, not acceptance: once unlink happened,
  // the old owner cannot fail closed if directory fsync rejects.
  const next = await acquireMedium(dir);
  await next.release();
});

test('guard rejects second writer and only releases owned exact lock', async (t) => {
  const dir = await root(t); const guard = await acquireMedium(dir);
  await assert.rejects(acquireMedium(dir), error => error.code === 'WRITER_EXISTS');
  await guard.release(); await guard.release();
  const next = await acquireMedium(dir); await next.release();
  await assert.rejects(guard.protect(), error => error.code === 'GUARD_CLOSED');
});

test('existing unknown/corrupt/stale lock fails closed and is never auto removed', async (t) => {
  const dir = await root(t); const path = join(dir, 'notebook.writer.lock');
  await fs.writeFile(path, 'stale unknown owner');
  await assert.rejects(acquireMedium(dir), error => error.code === 'WRITER_EXISTS');
  assert.equal(await fs.readFile(path, 'utf8'), 'stale unknown owner');
});

test('guard protects raw corrupt medium byte-for-byte without changing original', async (t) => {
  const dir = await root(t); const original = Buffer.from([0xff, 0, 0x7b, 0x41]);
  await fs.writeFile(join(dir, 'notebook.json'), original);
  const guard = await acquireMedium(dir);
  try {
    const first = await guard.protect(); const second = await guard.protect();
    assert.equal(first.bytes, original.length); assert.equal(first.sha256, second.sha256);
    assert.notEqual(first.path, second.path);
    assert.deepEqual(await fs.readFile(first.path), original);
    assert.deepEqual(await fs.readFile(join(dir, 'notebook.json')), original);
    assert.equal((await fs.stat(first.path)).mode & 0o777, 0o600);
  } finally { await guard.release(); }
});

test('missing medium protection fails without substituting an empty library', async (t) => {
  const dir = await root(t); const guard = await acquireMedium(dir);
  try {
    await assert.rejects(guard.protect(), error => error.code === 'ENOENT');
    assert.deepEqual((await fs.readdir(dir)).sort(), ['notebook.writer.lock']);
  } finally { await guard.release(); }
});

test('guard does not remove a replacement lock or authorize protection after ownership changes', async (t) => {
  const dir = await root(t); const guard = await acquireMedium(dir);
  const path = join(dir, 'notebook.writer.lock');
  // Deliberate ownership corruption within this synthetic test only.
  await fs.writeFile(path, 'replacement');
  await assert.rejects(guard.release(), error => error.code === 'LOCK_OWNERSHIP_LOST');
  await assert.rejects(guard.protect(), error => error.code === 'GUARD_CLOSED');
  assert.equal(await fs.readFile(path, 'utf8'), 'replacement');
});
