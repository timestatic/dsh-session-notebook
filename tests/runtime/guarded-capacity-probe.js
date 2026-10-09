import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json';
import { snapshotBackend } from '../fixtures/snapshot-backend.js';
import { notebookSchema } from '../fixtures/notebook-snapshot.js';
import { fullCapacityFixture } from './capacity-fixture.js';

// Explicit opt-in probe, never shipped or called by default test scripts.
// All files are synthesized inside a new ignored workspace test root.
const base = new URL('../../.storage-test-output/', import.meta.url);
await fs.mkdir(base, { recursive: true, mode: 0o700 });
const root = await fs.mkdtemp(new URL('guard-capacity-', base).pathname);
const descriptor = { name: 'notebook', version: 1, tables: [], hasGlobal: true, layout: 'single' };
const maximumBytes = 256 * 1024 * 1024; // Experiment only, NOT a product quota.
const source = join(root, 'notebook.json');
const digest = async path => {
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(path, { highWaterMark: 64 * 1024 })) {
    hash.update(chunk); bytes += chunk.length;
  }
  return { bytes, sha256: hash.digest('hex') };
};
const sdk = new JsonStorageBackend(root);
let unit;
try {
  unit = await sdk.kv.open(descriptor);
  const value = fullCapacityFixture();
  value.schemaVersion = 99; // Deliberately invalid business schema; preserve full raw medium.
  await unit.setGlobal(value);
} finally { await sdk.close(); }
const before = await digest(source);
assert.ok(before.bytes > 200 * 1024 * 1024 && before.bytes < maximumBytes);
const guardedSdk = new JsonStorageBackend(root);
const backend = snapshotBackend(root, spec => guardedSdk.kv.open(spec), notebookSchema,
  { guardHooks: { maximumBytes } });
const started = performance.now();
try {
  await assert.rejects(backend.kv.open(descriptor), error => error.code === 'MEDIUM_PROTECTED' && error.originalCode === 'invalid-record');
  const protectMs = performance.now() - started;
  const files = await fs.readdir(root);
  assert.equal(files.includes('notebook.writer.lock'), true);
  const copies = files.filter(file => /^notebook\.protected-[0-9a-f-]+\.json$/.test(file));
  assert.equal(copies.length, 1);
  const protectedCopy = await digest(join(root, copies[0]));
  assert.deepEqual(protectedCopy, before);
  assert.deepEqual(await digest(source), before);
  await assert.rejects(backend.close(), error => error instanceof AggregateError && error.errors.some(item => item.code === 'MEDIUM_PROTECTED'));
  await assert.rejects(snapshotBackend(root, () => { throw new Error('must not open SDK'); }, notebookSchema).kv.open(descriptor),
    error => error.code === 'WRITER_EXISTS');
  console.log(JSON.stringify({ count: 5000, bytes: before.bytes, sha256: before.sha256, protectMs,
    maxRssBytes: process.resourceUsage().maxRSS * 1024, testMaximumBytes: maximumBytes,
    originalAndCopyEqual: true, lockRetained: true,
    limitation: 'One synthetic schema-failure protection run; 256MiB is test-only; no production quota, crash/ENOSPC or Host evidence.' }, null, 2));
} finally { await guardedSdk.close(); }
