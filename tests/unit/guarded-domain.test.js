import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { snapshotBackend } from '../fixtures/snapshot-backend.js';
import { notebookSchema, notebookFixture } from '../fixtures/notebook-snapshot.js';

function region(source, from, until) {
  const start = source.indexOf(from); const end = source.indexOf(until, start);
  assert.ok(start >= 0 && end > start, 'SDK boundary changed'); return source.slice(start, end);
}
async function setup(t, productShape = false) {
  const base = new URL('../../.storage-test-output/', import.meta.url);
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const root = await fs.mkdtemp(new URL('domain-', base).pathname);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const json = await fs.readFile(new URL('../../.sdk-reference/storage-json/package/lib/index.js', import.meta.url), 'utf8');
  const domain = await fs.readFile(new URL('../../.sdk-reference/storage-domain/package/lib/index.js', import.meta.url), 'utf8');
  class StorageError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const sdk = runInNewContext(region(json, '//#region lib/types/atomic.js', '//#region lib/types/per-record-unit.js')
    + region(domain, '//#region lib/types/error.js', '//#region lib/types/index.js')
    + region(domain, 'var DomainFacility = class', '/**\n* Mount the domain data form')
    + '\n({openSingleUnit, DomainFacility, defineDomain})',
  { ...fs, dirname, join, randomUUID, process, StorageError, UNIT_NAME_RE: /^[a-zA-Z0-9_-]+$/ });
  let backend;
  const events = [];
  const facility = () => new sdk.DomainFacility({ storage: { backend: { get: name => {
    assert.equal(name, 'notebook-test'); return backend;
  } } }, emit: (...args) => events.push(args), logger: { error: () => assert.fail('no skip') } }, { backend: 'notebook-test' });
  const schema = productShape ? notebookSchema : { safeParse: value => ({ success: value !== null }), parse: value => {
    if (!value || value.revision !== 1 || typeof value.body !== 'string') throw new Error('TEST_SCHEMA');
    return structuredClone(value);
  } };
  backend = snapshotBackend(root, descriptor => sdk.openSingleUnit(descriptor, root, () => {}), schema);
  const spec = sdk.defineDomain({ name: 'notebook', version: 1, layout: 'single', tables: {}, global: { schema, initial: productShape ? notebookFixture() : { revision: 1, body: 'initial' } } });
  return { root, backend, facility, spec, events };
}

test('full product-shaped Snapshot preserves tags, trash, source, anchors and receipts across Domain reopen', async (t) => {
  const h = await setup(t, true); const f = h.facility(); const d = await f.open(h.spec);
  const value = notebookFixture(); value.revision = 1;
  value.notes.trash = { ...structuredClone(value.notes.n1), id: 'trash', deletedAt: value.notes.n1.createdAt };
  value.notes.n1.source.sessionState = 'deleted';
  value.operationReceipts.r1 = { payloadHash: 'a'.repeat(64), resultNoteId: 'n1', committedRevision: 1 };
  try {
    await d.global.set(value);
    const bytes = JSON.stringify(value);
    assert.equal(JSON.stringify(d.global.get()), bytes);
    await d.close();
    const reopened = await f.open(h.spec);
    assert.equal(JSON.stringify(reopened.global.get()), bytes);
    await reopened.close();
  } finally { await f.closeAll(); }
});

test('full Snapshot association error protects exact original before Domain initialization', async (t) => {
  const h = await setup(t, true); const f = h.facility();
  const value = notebookFixture(); value.notes.n1.tagIds = ['missing'];
  const original = JSON.stringify({ unit: { name: 'notebook', version: 1 }, global: value, tables: {} });
  await fs.writeFile(join(h.root, 'notebook.json'), original);
  await assert.rejects(f.open(h.spec), error => error.code === 'MEDIUM_PROTECTED');
  const files = await fs.readdir(h.root); const copy = files.find(name => name.includes('.protected-'));
  assert.ok(copy); assert.equal(await fs.readFile(join(h.root, copy), 'utf8'), original);
  assert.equal(await fs.readFile(join(h.root, 'notebook.json'), 'utf8'), original);
  assert.equal(f.get('notebook'), undefined);
});

test('actual DomainFacility over guarded KvFacet persists, excludes independent facility and reopens', async (t) => {
  const h = await setup(t); const f1 = h.facility(); const f2 = h.facility(); const d = await f1.open(h.spec);
  try {
    await d.global.set({ revision: 1, body: '保存😀\nMarkdown' });
    assert.equal(d.global.get().body, '保存😀\nMarkdown'); assert.equal(h.events.length, 1);
    await assert.rejects(f2.open(h.spec), error => error.code === 'WRITER_EXISTS');
    await d.close(); const next = await f2.open(h.spec);
    assert.equal(next.global.get().body, '保存😀\nMarkdown'); await next.close();
  } finally { await f1.closeAll(); await f2.closeAll(); }
});

test('shared Schema rejects write candidate before publish and Domain cache/event mutation', async (t) => {
  const h = await setup(t); const f = h.facility(); const d = await f.open(h.spec);
  try {
    await d.global.set({ revision: 1, body: 'saved' });
    const path = join(h.root, 'notebook.json'); const before = await fs.readFile(path, 'utf8');
    await assert.rejects(d.global.set({ revision: 99 }), error => error.code === 'VALIDATION_FAILED');
    assert.equal(await fs.readFile(path, 'utf8'), before);
    assert.equal(d.global.get().body, 'saved'); assert.equal(h.events.length, 1);
    await d.global.set({ revision: 1, body: 'queue still healthy' });
    assert.equal(h.events.length, 2);
  } finally { await f.closeAll(); }
});

test('guarded KvFacet rejects foreign, table and per-record descriptors before touching medium', async (t) => {
  const h = await setup(t);
  const valid = { name: 'notebook', version: 1, layout: 'single', hasGlobal: true, tables: [] };
  for (const patch of [{ name: '../escape' }, { version: 2 }, { layout: 'per-record' }, { hasGlobal: false }, { tables: ['notes'] }, { root: 'other' }]) {
    await assert.rejects(h.backend.kv.open({ ...valid, ...patch }), error => error.code === 'DESCRIPTOR_REJECTED');
  }
  assert.deepEqual(await fs.readdir(h.root), []);
  const unit = await h.backend.kv.open(valid);
  try {
    await assert.rejects(unit.putRecord('notes', 'a', {}), error => error.code === 'GLOBAL_ONLY');
    await assert.rejects(unit.deleteRecord('notes', 'a'), error => error.code === 'GLOBAL_ONLY');
  } finally { await unit.close(); }
});

test('shared Schema preflight protects invalid snapshot and retains exclusion before Domain open', async (t) => {
  const h = await setup(t);
  const original = JSON.stringify({ unit: { name: 'notebook', version: 1 }, global: { revision: 99 }, tables: {} });
  await fs.writeFile(join(h.root, 'notebook.json'), original);
  const f = h.facility();
  await assert.rejects(f.open(h.spec), error => error.code === 'MEDIUM_PROTECTED' && error.originalCode === 'invalid-record');
  assert.equal(await fs.readFile(join(h.root, 'notebook.json'), 'utf8'), original);
  const files = await fs.readdir(h.root);
  assert.equal(files.includes('notebook.writer.lock'), true);
  const backups = files.filter(name => name.includes('.protected-') && name.endsWith('.json'));
  assert.equal(backups.length, 1);
  assert.equal(await fs.readFile(join(h.root, backups[0]), 'utf8'), original);
  assert.equal(f.get('notebook'), undefined);
  await assert.rejects(f.open(h.spec), error => error.code === 'WRITER_EXISTS');
});
