import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json';
import { notebookSchema } from '../fixtures/notebook-snapshot.js';
import { fullCapacityFixture } from './capacity-fixture.js';

// Standalone destructive-to-synthetic-data-only probe, never called by plugin code.
const base = new URL('../../.storage-test-output/', import.meta.url);
await fs.mkdir(base, { recursive: true, mode: 0o700 });
const root = await fs.mkdtemp(new URL('capacity-full-', base).pathname);
async function runProbe() {
const baselineRss = process.memoryUsage().rss;
const value = fullCapacityFixture();
const delay = monitorEventLoopDelay({ resolution: 10 }); delay.enable();
await new Promise(resolve => setTimeout(resolve, 30));
const validateStart = performance.now(); notebookSchema.parse(value);
const validationMs = performance.now() - validateStart;
const descriptor = { name: 'notebook', version: 1, tables: [], hasGlobal: true, layout: 'single' };
const backend = new JsonStorageBackend(root);
let unit;
try {
  unit = await backend.kv.open(descriptor);
  const commitStart = performance.now(); await unit.setGlobal(value);
  const commitMs = performance.now() - commitStart;
  await unit.close();
  const reopenStart = performance.now(); unit = await backend.kv.open(descriptor);
  const loaded = await unit.loadAll();
  const reopenMs = performance.now() - reopenStart;
  // Compare all records without allocating two whole-library JSON strings.
  assert.equal(Object.keys(loaded.global.notes).length, 5000);
  for (const [id, note] of Object.entries(value.notes)) assert.deepEqual(loaded.global.notes[id], note);
  for (const key of ['schemaVersion', 'epoch', 'revision', 'tags', 'settings', 'operationReceipts']) assert.deepEqual(loaded.global[key], value[key]);
  await new Promise(resolve => setTimeout(resolve, 30)); delay.disable();
  console.log(JSON.stringify({ count: 5000, bytes: (await fs.stat(join(root, 'notebook.json'))).size,
    validationMs, commitMs, reopenMs, baselineRssBytes: baselineRss,
    maxRssBytes: process.resourceUsage().maxRSS * 1024,
    eventLoopMaxMs: delay.max / 1e6, eventLoopP99Ms: delay.percentile(99) / 1e6,
    node: process.version, platform: process.platform, architecture: process.arch,
    limitation: 'One complete SDK run; maxRSS includes fixture/validation/comparison; delay covers validation and comparison too; not UI SLA or maximum product quota.' }, null, 2));
} finally { delay.disable(); await backend.close(); }
}
try { await runProbe(); }
finally { await fs.rm(root, { recursive: true, force: true }); }
