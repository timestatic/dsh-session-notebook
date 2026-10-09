import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { acquireMedium } from '../fixtures/medium-guard.js';

async function setup(size) {
  const base = new URL('../../.storage-test-output/', import.meta.url);
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const root = await fs.mkdtemp(new URL('stream-', base).pathname);
  const handle = await fs.open(join(root, 'notebook.json'), 'wx', 0o600);
  // Generate large representative raw-byte medium without a large buffer.
  const block = Buffer.alloc(64 * 1024, 0x61); const hash = createHash('sha256');
  try {
    for (let at = 0; at < size; at += block.length) {
      const chunk = block.subarray(0, Math.min(block.length, size - at));
      await handle.writeFile(chunk); hash.update(chunk);
    }
    await handle.sync();
  } finally { await handle.close(); }
  return { root, digest: hash.digest('hex') };
}

test('cancelled copy refuses published backup and does not remove exclusion', async () => {
  const h = await setup(256 * 1024); const controller = new AbortController();
  const guard = await acquireMedium(h.root, { copyHooks: { signal: controller.signal, afterChunk: async () => controller.abort() } });
  try {
    await assert.rejects(guard.protect(), error => error.name === 'AbortError');
    assert.equal((await fs.readdir(h.root)).filter(file => file.endsWith('.json') && file.includes('.protected-')).length, 0);
    await assert.rejects(acquireMedium(h.root), error => error.code === 'WRITER_EXISTS');
  } finally { try { await guard.release(); } finally { await fs.rm(h.root, { recursive: true, force: true }); } }
});

test('source growth during streaming is detected before publishing protection', async () => {
  const h = await setup(256 * 1024); let changed = false;
  const guard = await acquireMedium(h.root, { copyHooks: { afterChunk: async () => {
    if (!changed) { changed = true; await fs.appendFile(join(h.root, 'notebook.json'), 'changed'); }
  } } });
  try {
    await assert.rejects(guard.protect(), /SOURCE_CHANGED/);
    assert.equal((await fs.readdir(h.root)).filter(file => file.endsWith('.json') && file.includes('.protected-')).length, 0);
  } finally { try { await guard.release(); } finally { await fs.rm(h.root, { recursive: true, force: true }); } }
});

test('bounded streaming protection covers 188MiB without whole-file allocation', async () => {
  const size = 188 * 1024 * 1024; const h = await setup(size);
  const guard = await acquireMedium(h.root, { maximumBytes: 200 * 1024 * 1024 });
  try {
    const protectedCopy = await guard.protect();
    assert.equal(protectedCopy.bytes, size); assert.equal(protectedCopy.sha256, h.digest);
    assert.equal((await fs.stat(protectedCopy.path)).size, size);
  } finally { try { await guard.release(); } finally { await fs.rm(h.root, { recursive: true, force: true }); } }
});

test('interrupted stream leaves only partial artifact, original unchanged and no published backup', async () => {
  const h = await setup(256 * 1024);
  const guard = await acquireMedium(h.root, { copyHooks: { afterChunk: async () => { throw new Error('TEST_INTERRUPT'); } } });
  try {
    await assert.rejects(guard.protect(), /TEST_INTERRUPT/);
    const files = await fs.readdir(h.root);
    assert.equal(files.filter(file => file.endsWith('.partial')).length, 1);
    assert.equal(files.filter(file => file.includes('.protected-') && file.endsWith('.json')).length, 0);
    assert.equal((await fs.stat(join(h.root, 'notebook.json'))).size, 256 * 1024);
  } finally { try { await guard.release(); } finally { await fs.rm(h.root, { recursive: true, force: true }); } }
});
