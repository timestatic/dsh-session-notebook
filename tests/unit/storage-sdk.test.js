import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { autoTestRoot } from '../fixtures/auto-test-root.js';

// Local synthetic media, NEVER a Profile root. SDK regions execute unchanged;
// only fs fault hooks, backend routing, events and a tiny schema are test seams.
const name = 'dsh-session-notebook-test';
class StorageError extends Error {
  constructor(code, message, options) { super(message, options); this.code = code; }
}
function region(source, start, end) {
  const from = source.indexOf(start); const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'SDK extraction changed; review required');
  return source.slice(from, to);
}
function snapshot(revision) {
  return { schemaVersion: 1, revision, notes: { n1: {
    bodyMarkdown: '第一行\r\n**加粗**\n```js\n  const x = "😀";\n```\n',
    quote: '原文 e\u0301 😀\n第二行', anchor: { exact: '😀', start: 2, end: 4 }, tagIds: ['t1'],
  } }, tags: { t1: { name: '待验证' } }, settings: { quickTagIds: ['t1'] } };
}
const plain = value => JSON.parse(JSON.stringify(value));

async function harness(fault = {}) {
  const root = await autoTestRoot('run-');
  const json = await fs.readFile(new URL('../../.sdk-reference/storage-json/package/lib/index.js', import.meta.url), 'utf8');
  const domain = await fs.readFile(new URL('../../.sdk-reference/storage-domain/package/lib/index.js', import.meta.url), 'utf8');
  const code = region(json, '//#region lib/types/atomic.js', '//#region lib/types/per-record-unit.js')
    + region(domain, '//#region lib/types/error.js', '//#region lib/types/index.js')
    + region(domain, 'var DomainFacility = class', '/**\n* Mount the domain data form');
  const sdk = runInNewContext(`${code}\n({openSingleUnit, DomainFacility, defineDomain})`, {
    ...fs, dirname, join, randomUUID, process, StorageError, UNIT_NAME_RE: /^[a-zA-Z0-9_-]+$/,
    open: async (path, flags, mode) => {
      const handle = await fs.open(path, flags, mode);
      return {
        writeFile: (...args) => handle.writeFile(...args), close: () => handle.close(),
        sync: async () => {
          if (fault.stage === 'file-sync' && flags === 'wx') throw new Error('TEST_FILE_SYNC');
          if (fault.stage === 'directory-sync' && path === root) throw new Error('TEST_DIRECTORY_SYNC');
          await handle.sync();
        },
      };
    },
  });
  const events = [];
  // NOT a full product schema/Zod or full Cordis runtime.
  const schema = {
    safeParse: value => ({ success: value !== null }),
    parse(value) {
      if (!value || value.schemaVersion !== 1 || !Number.isInteger(value.revision) || !value.notes || !value.tags) throw new Error('TEST_SCHEMA');
      return structuredClone(value);
    },
  };
  const spec = sdk.defineDomain({ name, version: 1, layout: 'single', tables: {}, global: { schema, initial: snapshot(0) } });
  const makeFacility = () => new sdk.DomainFacility({
    storage: { backend: { get: backend => {
      assert.equal(backend, 'json');
      return { kv: { open: descriptor => sdk.openSingleUnit(descriptor, root, () => {}) } };
    } } },
    emit: (event, change) => events.push({ event, change }),
    logger: { warn: () => {}, error: () => assert.fail('No backup-and-skip') },
  }, { backend: 'json' });
  const path = join(root, `${name}.json`);
  const disk = async () => JSON.parse(await fs.readFile(path, 'utf8')).global;
  return { root, path, spec, makeFacility, events, disk, fault };
}

test('SDK Snapshot round-trips through close/reopen on dedicated real disk', async () => {
  const h = await harness(); const f = h.makeFacility(); const d = await f.open(h.spec);
  try {
    await d.global.set(snapshot(1));
    assert.deepEqual(plain(d.global.get()), snapshot(1));
    assert.deepEqual(await h.disk(), snapshot(1));
    await d.close();
    const reopened = await f.open(h.spec);
    assert.deepEqual(plain(reopened.global.get()), snapshot(1));
    await reopened.close();
    assert.throws(() => reopened.global.get(), error => error.code === 'closed');
    await assert.rejects(reopened.global.set(snapshot(2)), error => error.code === 'closed');
  } finally { await f.closeAll(); }
});

test('SDK pre-rename failure preserves disk/cache, no commit, queue recovers', async () => {
  const h = await harness(); const f = h.makeFacility(); const d = await f.open(h.spec);
  try {
    await d.global.set(snapshot(1)); h.fault.stage = 'file-sync';
    await assert.rejects(d.global.set(snapshot(2)), /TEST_FILE_SYNC/);
    assert.deepEqual(plain(d.global.get()), snapshot(1));
    assert.deepEqual(await h.disk(), snapshot(1)); assert.equal(h.events.length, 1);
    assert.equal((await fs.readdir(h.root)).filter(file => file.endsWith('.tmp')).length, 0);
    h.fault.stage = undefined; await d.global.set(snapshot(3));
    assert.deepEqual(await h.disk(), snapshot(3));
  } finally { await f.closeAll(); }
});

test('SDK post-rename directory-sync rejection means UNKNOWN commit, not rollback', async () => {
  const h = await harness(); const f = h.makeFacility(); const d = await f.open(h.spec);
  try {
    await d.global.set(snapshot(1)); h.fault.stage = 'directory-sync';
    await assert.rejects(d.global.set(snapshot(2)), /TEST_DIRECTORY_SYNC/);
    assert.deepEqual(plain(d.global.get()), snapshot(1));
    assert.deepEqual(await h.disk(), snapshot(2)); assert.equal(h.events.length, 1);
    // Never mutate divergent handle again: release and reread.
    await d.close(); h.fault.stage = undefined;
    const reopened = await f.open(h.spec);
    assert.deepEqual(plain(reopened.global.get()), snapshot(2)); await reopened.close();
  } finally { await f.closeAll(); }
});

for (const [label, content, code] of [
  ['malformed JSON', '{broken', 'malformed-medium'],
  ['future medium version', JSON.stringify({ unit: { name, version: 2 }, global: snapshot(1), tables: {} }), 'version-mismatch'],
  ['invalid business snapshot', JSON.stringify({ unit: { name, version: 1 }, global: { schemaVersion: 99 }, tables: {} }), 'invalid-record'],
]) {
  test(`SDK refuses ${label} without replacing original medium`, async () => {
    const h = await harness(); const f = h.makeFacility();
    await fs.writeFile(h.path, content, { mode: 0o600 });
    try {
      await assert.rejects(f.open(h.spec), error => error.code === code);
      assert.equal(await fs.readFile(h.path, 'utf8'), content);
      assert.equal(f.get(name), undefined);
      await assert.rejects(f.open(h.spec), error => error.code === code);
    } finally { await f.closeAll(); }
  });
}

test('SDK prevents same-facility duplicate open, NOT two independent writers', async () => {
  const h = await harness(); const f1 = h.makeFacility(); const f2 = h.makeFacility();
  try {
    const a = await f1.open(h.spec); await a.global.set(snapshot(1));
    await assert.rejects(f1.open(h.spec), error => error.code === 'already-open');
    const b = await f2.open(h.spec);
    const aNext = snapshot(2); aNext.notes.fromA = { bodyMarkdown: 'A' };
    const bNext = snapshot(2); bNext.notes.fromB = { bodyMarkdown: 'B' };
    await a.global.set(aNext); await b.global.set(bNext);
    const stored = await h.disk(); assert.equal(stored.notes.fromA, undefined);
    assert.deepEqual(stored.notes.fromB, { bodyMarkdown: 'B' });
    assert.deepEqual(plain(a.global.get()), aNext);
    // Controlled lost-update reproduction, NOT multi-Host safety PASS.
  } finally { await f1.closeAll(); await f2.closeAll(); }
});

test('SDK aliases values and does not validate global.set candidates', async () => {
  const h = await harness(); const f = h.makeFacility(); const d = await f.open(h.spec);
  try {
    const candidate = snapshot(1); await d.global.set(candidate);
    candidate.notes.n1.bodyMarkdown = 'MUTATED OUTSIDE COMMIT';
    assert.equal(d.global.get().notes.n1.bodyMarkdown, 'MUTATED OUTSIDE COMMIT');
    assert.notEqual((await h.disk()).notes.n1.bodyMarkdown, 'MUTATED OUTSIDE COMMIT');
    // Invalid data confined to synthetic medium.
    await d.global.set({ schemaVersion: 99 }); await d.close();
    await assert.rejects(f.open(h.spec), error => error.code === 'invalid-record');
  } finally { await f.closeAll(); }
});
