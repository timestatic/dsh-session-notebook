import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';

// Backend-only actual SDK test; not a product Repository/full Cordis test.
async function setup() {
  const parent = new URL('../../.storage-test-output/', import.meta.url);
  await fs.mkdir(parent, { recursive: true, mode: 0o700 });
  const root = await fs.mkdtemp(new URL('capacity-', parent).pathname);
  const source = await fs.readFile(new URL('../../.sdk-reference/storage-json/package/lib/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('//#region lib/types/atomic.js');
  const end = source.indexOf('//#region lib/types/per-record-unit.js', start);
  assert.ok(start >= 0 && end > start);
  class StorageError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const openUnit = runInNewContext(`${source.slice(start, end)}\nopenSingleUnit`, {
    ...fs, dirname, join, randomUUID, process, StorageError,
  });
  const descriptor = { name: 'dsh-session-notebook-capacity-test', version: 1, hasGlobal: true, tables: [] };
  return { root, descriptor, open: () => openUnit(descriptor, root, () => {}) };
}
function fixture(count) {
  const quote = '引用😀中文\n'.repeat(1000); // 6000 code points, under 8000.
  const notes = {};
  for (let i = 0; i < count; i++) notes[`n${i}`] = {
    id: `n${i}`, kind: 'note', version: 1,
    bodyMarkdown: `${i}\n${'正文 Markdown **strong**\n'.repeat(100)}`,
    quote: { format: 'plain_text', content: quote },
    anchor: { exact: quote, prefix: '', suffix: '', start: 0, end: quote.length },
    source: { sessionId: 'synthetic', messageId: `m${i}`, title: '测试来源' }, tagIds: ['t1'],
  };
  return { schemaVersion: 1, revision: 1, notes, tags: { t1: { name: '待验证' } }, settings: { quickTagIds: ['t1'] } };
}

test('SDK 5000 representative quotes and anchors persist and reopen, reports capacity not SLA', async t => {
  const h = await setup(); let unit = await h.open();
  const value = fixture(5000);
  const started = performance.now();
  try {
    await unit.setGlobal(value);
    const commitMs = performance.now() - started;
    const bytes = (await fs.stat(join(h.root, `${h.descriptor.name}.json`))).size;
    await unit.close();
    const reopenStart = performance.now(); unit = await h.open();
    const loaded = (await unit.loadAll()).global;
    const reopenMs = performance.now() - reopenStart;
    assert.equal(JSON.stringify(loaded), JSON.stringify(value));
    const metrics = { count: 5000, bytes, commitMs, reopenMs, rssBytes: process.memoryUsage().rss,
      limitation: 'single backend call, representative fixture, no UI/Host/peak memory/SLA guarantee' };
    await fs.writeFile(join(h.root, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`, { mode: 0o600 });
    t.diagnostic(JSON.stringify(metrics));
  } finally { try { await unit.close(); } finally { await fs.rm(h.root, { recursive: true, force: true }); } }
});

test('SDK backend close drains a pending publish and rejects subsequent writes', async () => {
  const h = await setup(); const unit = await h.open();
  const value = fixture(5);
  const pending = unit.setGlobal(value);
  const closing = unit.close();
  await assert.rejects(unit.setGlobal(fixture(1)), error => error.code === 'closed');
  await pending; await closing;
  const reopened = await h.open();
  try { assert.equal(JSON.stringify((await reopened.loadAll()).global), JSON.stringify(value)); }
  finally { try { await reopened.close(); } finally { await fs.rm(h.root, { recursive: true, force: true }); } }
});
