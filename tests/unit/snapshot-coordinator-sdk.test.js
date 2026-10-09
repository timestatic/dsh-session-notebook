import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { notebookSchema } from '../../src/notebook-schema.js';
import { createNote } from '../../src/note-domain.js';
import { snapshotCoordinator } from '../../src/snapshot-coordinator.js';
import { manualNotebookService } from '../../src/manual-notebook-service.js';
import { autoTestRoot } from '../fixtures/auto-test-root.js';

// Saved SDK's actual single-unit + DomainFacility methods, but only a
// synthetic workspace medium and tiny test Context. NOT Desktop runtime proof.
const name = 'notebook-coordinator-sdk-test';
const time = '2026-10-05T00:00:00.000Z';
const intent = { requestId: 'stable_intent', epoch: 'test-epoch', expectedRevision: 0,
  id: 'manual1', bodyMarkdown: '## 标题\n- [ ] 待办\n`😀`' };
const candidate = (current, dto) => createNote(current,
  { kind: 'manual', bodyMarkdown: dto.bodyMarkdown },
  { id: dto.id, time, expectedRevision: dto.expectedRevision }, notebookSchema.parse.bind(notebookSchema));
const region = (source, start, end) => {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'Saved SDK region changed; inspect before updating');
  return source.slice(from, to);
};
async function setup() {
  const root = await autoTestRoot('coordinator-');
  const json = await fs.readFile(new URL('../../.sdk-reference/storage-json/package/lib/index.js', import.meta.url), 'utf8');
  const domain = await fs.readFile(new URL('../../.sdk-reference/storage-domain/package/lib/index.js', import.meta.url), 'utf8');
  let rejectDirectory = false;
  class StorageError extends Error { constructor(code, message, options) { super(message, options); this.code = code; } }
  const code = region(json, '//#region lib/types/atomic.js', '//#region lib/types/per-record-unit.js')
    + region(domain, '//#region lib/types/error.js', '//#region lib/types/index.js')
    + region(domain, 'var DomainFacility = class', '/**\n* Mount the domain data form');
  const sdk = runInNewContext(`${code}\n({openSingleUnit, DomainFacility, defineDomain})`, {
    ...fs, dirname, join, randomUUID, process, StorageError, UNIT_NAME_RE: /^[a-zA-Z0-9_-]+$/,
    open: async (path, flags, mode) => {
      const handle = await fs.open(path, flags, mode);
      return { writeFile: (...args) => handle.writeFile(...args), close: () => handle.close(),
        sync: async () => {
          if (rejectDirectory && path === root) throw new Error('PRIVATE_TEST_DIRECTORY_SYNC');
          await handle.sync();
        } };
    },
  });
  // The extracted SDK executes in a separate VM realm. Its object literals
  // have foreign prototypes; normalize this test seam as JSON wire data,
  // without weakening the production Snapshot validator.
  const normalize = value => JSON.parse(JSON.stringify(value));
  const schema = { safeParse: value => notebookSchema.safeParse(normalize(value)),
    parse: value => notebookSchema.parse(normalize(value)) };
  const spec = sdk.defineDomain({ name, version: 1, layout: 'single', tables: {},
    global: { schema, initial: notebookFixture() } });
  const facility = new sdk.DomainFacility({
    storage: { backend: { get: backend => {
      assert.equal(backend, 'json');
      return { kv: { open: descriptor => sdk.openSingleUnit(descriptor, root, () => {}) } };
    } } }, emit: () => {}, logger: { warn: () => {}, error: () => assert.fail('unexpected backup') },
  }, { backend: 'json' });
  const disk = async () => JSON.parse(await fs.readFile(join(root, `${name}.json`), 'utf8')).global;
  return { spec, facility, disk, injectDirectoryFailure: () => { rejectDirectory = true; },
    restoreDirectory: () => { rejectDirectory = false; } };
}

test('coordinator over saved SDK persists one receipt and replays after Domain reopen', async () => {
  const h = await setup();
  try {
    let domain = await h.facility.open(h.spec);
    const store = snapshotCoordinator({ domain });
    const first = await store.mutate(intent, candidate);
    assert.deepEqual(first, { epoch: intent.epoch, revision: 1, noteId: intent.id });
    await store.close(); await domain.close();
    domain = await h.facility.open(h.spec);
    const reopened = snapshotCoordinator({ domain });
    assert.deepEqual(await reopened.mutate(intent, candidate), first);
    assert.equal((await h.disk()).revision, 1);
    assert.equal((await h.disk()).notes.manual1.bodyMarkdown, intent.bodyMarkdown);
    await reopened.close(); await domain.close();
  } finally { await h.facility.closeAll(); }
});

test('manual service creates, edits, and reads after saved SDK Domain reopen', async () => {
  const h = await setup();
  try {
    let domain = await h.facility.open(h.spec);
    const first = manualNotebookService({ domain, now: () => time });
    const draft = { requestId: 'sdk_manual', epoch: 'test-epoch', expectedRevision: 0,
      title: '持久手工笔记', bodyMarkdown: '第一行\n\n```js\nconst x = 1\n```' };
    const created = await first.create(draft);
    assert.equal(first.list().total, 1);
    assert.equal(first.get(created.noteId).note.bodyMarkdown, draft.bodyMarkdown);
    const edited = await first.update({ requestId: 'sdk_edit', epoch: draft.epoch,
      expectedRevision: 1, id: created.noteId, expectedVersion: 1, bodyMarkdown: '更新 😀' });
    assert.equal(edited.revision, 2);
    await first.close(); await domain.close();
    domain = await h.facility.open(h.spec);
    const reopened = manualNotebookService({ domain, now: () => time });
    assert.equal(reopened.get(created.noteId).note.bodyMarkdown, '更新 😀');
    assert.equal((await reopened.create(draft)).noteId, created.noteId);
    assert.equal((await h.disk()).revision, 2);
    await reopened.close(); await domain.close();
  } finally { await h.facility.closeAll(); }
});

test('saved SDK post-rename failure freezes live coordinator until sole-writer reopen', async () => {
  const h = await setup();
  try {
    let domain = await h.facility.open(h.spec);
    const store = snapshotCoordinator({ domain });
    h.injectDirectoryFailure();
    await assert.rejects(store.mutate(intent, candidate), { code: 'COMMIT_UNKNOWN' });
    await assert.rejects(store.mutate(intent, candidate), { code: 'COMMIT_UNKNOWN' });
    assert.equal((await h.disk()).revision, 1);
    await store.close(); await domain.close();
    h.restoreDirectory();
    // Sole-writer isolation belongs to this test only; no production lock.
    domain = await h.facility.open(h.spec);
    const reopened = snapshotCoordinator({ domain });
    assert.deepEqual(await reopened.mutate(intent, candidate),
      { epoch: intent.epoch, revision: 1, noteId: intent.id });
    assert.equal((await h.disk()).revision, 1);
    await reopened.close(); await domain.close();
  } finally { await h.facility.closeAll(); }
});
