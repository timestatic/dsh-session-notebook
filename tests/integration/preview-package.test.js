import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { manualNotebookService } from '../../src/manual-notebook-service.js';
import { registerPreviewRoutes } from '../../src/host/preview-routes.js';
import { previewApi } from '../../src/client/preview-api.js';
import { manualSaveController } from '../../src/client/manual-save-controller.js';
import { backupJson, inspectBackupJson } from '../../src/json-backup.js';
import { backupFile } from '../../src/client/backup-file.js';
import { stageBackupFile } from '../../src/client/restore-transfer.js';
import { markdownFile } from '../../src/client/markdown-file.js';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { notebookSchema } from '../../src/notebook-schema.js';
import { checkedTestRoot } from '../fixtures/test-root.js';
import { TAG_COLORS } from '../../src/tag-colors.js';

const require = createRequire(new URL('../runtime/package.json', import.meta.url));
const { Context } = require('@deepseek-ai/cordis');
const Storage = require('@deepseek-ai/dsh-storage').default;
const { JsonStorageBackend } = require('@deepseek-ai/dsh-storage-json');
const { DomainFacility, defineDomain } = require('@deepseek-ai/dsh-storage-domain');
const name = 'notebook_preview_integration';
const spec = defineDomain({ name, version: 1, layout: 'single', tables: {},
  global: { schema: notebookSchema, initial: notebookFixture() } });
const request = (id, revision) => ({ requestId: id, epoch: 'test-epoch',
  expectedRevision: revision, bodyMarkdown: '段落 **Markdown** 😀\n\n- [ ] 待办' });

function wire(service) {
  const routes = new Map(); const dispose = [];
  const ctx = { effect: setup => { const cleanup = setup(); dispose.push(cleanup); return cleanup; },
    connection: { rpc: { intercept: () => assert.fail('shared interceptor forbidden') },
      admit: () => ({ peer: { id: 'integration-operator' } }),
      fetch: { register: route => {
        assert.equal(routes.has(route.path), false);
        assert.equal(route.path.startsWith('/api/dsh-session-notebook/manual/')
          || route.path === '/api/dsh-session-notebook/library/query'
          || route.path === '/api/dsh-session-notebook/markdown/export'
          || route.path.startsWith('/api/dsh-session-notebook/tags/')
          || route.path.startsWith('/api/dsh-session-notebook/notes/')
          || route.path.startsWith('/api/dsh-session-notebook/backups/'), true);
        routes.set(route.path, route);
        return async () => { routes.delete(route.path); };
      } } } };
  registerPreviewRoutes(ctx, service);
  let counter = 0;
  const transportApi = previewApi({ rpc: { call: async (channel, method, payload, signal) => {
    assert.equal(channel, '/api');
    const path = `/api/${method}`;
    const handler = routes.get(path);
    assert.ok(handler, `route ${path} must be registered`);
    const rpcId = `integration_${++counter}`;
    const response = await handler.fetch(new Request(`http://localhost${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal,
      body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
    }));
    const body = await response.json();
    assert.equal(body.type, 'server-response'); assert.equal(body.rpcId, rpcId);
    return body.result;
  } } });
  const api = {
    list: payload => transportApi.list(payload, new AbortController().signal),
    get: id => transportApi.get(id, new AbortController().signal),
    create: payload => transportApi.create(payload, new AbortController().signal),
    update: payload => transportApi.update(payload, new AbortController().signal),
    backup: () => transportApi.backup(new AbortController().signal),
    backupBegin: payload => transportApi.backupBegin(payload, new AbortController().signal),
    backupChunk: payload => transportApi.backupChunk(payload, new AbortController().signal),
    backupFinish: payload => transportApi.backupFinish(payload, new AbortController().signal),
    backupPreview: payload => transportApi.backupPreview(payload, new AbortController().signal),
    backupCancel: payload => transportApi.backupCancel(payload, new AbortController().signal),
    library: payload => transportApi.library(payload, new AbortController().signal),
    markdown: payload => transportApi.markdown(payload, new AbortController().signal),
    tagsList: () => transportApi.tagsList(new AbortController().signal),
    tagsPreview: payload => transportApi.tagsPreview(payload, new AbortController().signal),
    tagsCreate: payload => transportApi.tagsCreate(payload, new AbortController().signal),
    tagsRename: payload => transportApi.tagsRename(payload, new AbortController().signal),
    tagsMerge: payload => transportApi.tagsMerge(payload, new AbortController().signal),
    tagsDelete: payload => transportApi.tagsDelete(payload, new AbortController().signal),
    notesPreview: payload => transportApi.notesPreview(payload, new AbortController().signal),
    notesApply: payload => transportApi.notesApply(payload, new AbortController().signal),
    notesGet: id => transportApi.notesGet(id, new AbortController().signal),
    notesEdit: payload => transportApi.notesEdit(payload, new AbortController().signal),
    notesConvert: payload => transportApi.notesConvert(payload, new AbortController().signal),
  };
  return { api, routes, close: async () => { for (const cleanup of dispose.reverse()) await cleanup(); } };
}

test('whole package entry + real Cordis Domain + exact RPC carrier round trip', async t => {
  const base = new URL('../../.storage-test-output/', import.meta.url);
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const rootDir = await fs.mkdtemp(new URL('preview-integration-', base).pathname);
  t.after(async () => { await checkedTestRoot(rootDir); await fs.rm(rootDir, { recursive: true }); });
  const root = new Context(); await root.plugin(Storage);
  const backend = new JsonStorageBackend(rootDir);
  const unregister = root.storage.backend.register('json', backend);
  const facility = new DomainFacility(root, { backend: 'json' });
  try {
    let domain = await facility.open(spec);
    let service = manualNotebookService({ domain, now: () => '2026-10-05T00:00:00.000Z' });
    let transport = wire(service);
    const { api } = transport;
    assert.equal((await api.list()).total, 0);
    const initialLibrary = await api.library({ scope: 'session', sessionId: 'synthetic' });
    assert.deepEqual(initialLibrary.ids, ['n1']);
    assert.equal(initialLibrary.items[0].source.messageId, 'm1');
    await assert.rejects(api.list({ unsupported: 'x' }), { code: 'VALIDATION_FAILED' });
    const first = await api.create(request('manual_first', 0));
    assert.equal(first.revision, 1);
    assert.deepEqual((await api.library({ kind: 'manual' })).ids, [first.noteId]);
    await assert.rejects(api.library({ unexpected: true }), { code: 'VALIDATION_FAILED' });
    await assert.rejects(api.create(request('stale', 0)), { code: 'VERSION_CONFLICT' });
    assert.equal((await api.get(first.noteId)).note.bodyMarkdown, request('manual_first', 0).bodyMarkdown);
    const edited = await api.update({ requestId: 'edit_first', epoch: first.epoch,
      expectedRevision: 1, id: first.noteId, expectedVersion: 1, bodyMarkdown: '改写 😀' });
    assert.equal(edited.revision, 2);
    assert.deepEqual((await api.tagsList()).items.map(tag => tag.id), ['t1']);
    assert.equal((await api.tagsCreate({ requestId: 'new_tag', epoch: first.epoch,
      expectedRevision: 2, name: '重要', color: TAG_COLORS[5] })).revision, 3);
    const newTag = (await api.tagsList()).items.find(tag => tag.name === '重要');
    assert.equal(newTag.color, TAG_COLORS[5]);
    const tagPreview = await api.tagsPreview({ action: 'delete', sourceId: newTag.id });
    assert.equal(tagPreview.activeAffected, 0);
    await assert.rejects(api.tagsDelete({ requestId: 'delete_tag', epoch: first.epoch,
      expectedRevision: 3, sourceId: newTag.id,
      preview: { ...tagPreview, activeAffected: 1 } }), { code: 'CONFIRM_REQUIRED' });
    assert.equal((await api.tagsDelete({ requestId: 'delete_tag', epoch: first.epoch,
      expectedRevision: 3, sourceId: newTag.id, preview: tagPreview })).revision, 4);
    const trash = await api.notesPreview({ action: 'trash', ids: ['n1'] });
    await assert.rejects(api.notesApply({ requestId: 'trash_note', epoch: trash.epoch,
      expectedRevision: trash.revision, action: 'trash', preview: trash,
      confirmed: false }), { code: 'CONFIRM_REQUIRED' });
    assert.equal((await api.notesApply({ requestId: 'trash_note', epoch: trash.epoch,
      expectedRevision: trash.revision, action: 'trash', preview: trash,
      confirmed: true })).revision, 5);
    assert.deepEqual((await api.library({ trashOnly: true })).ids, ['n1']);
    assert.equal((await api.notesGet('n1')).note.deletedAt, '2026-10-05T00:00:00.000Z');
    const restore = await api.notesPreview({ action: 'restore', ids: ['n1'] });
    assert.equal((await api.notesApply({ requestId: 'restore_note', epoch: restore.epoch,
      expectedRevision: restore.revision, action: 'restore', preview: restore,
      confirmed: true })).revision, 6);
    assert.deepEqual((await api.library({ trashOnly: true })).ids, []);
    const detail = await api.notesGet('n1');
    assert.equal(detail.note.kind, 'note');
    assert.equal((await api.notesConvert({ requestId: 'convert_note', epoch: detail.epoch,
      expectedRevision: detail.revision, id: 'n1', expectedVersion: detail.note.version,
      kind: 'manual', bodyMarkdown: detail.note.quote.content })).revision, 7);
    assert.equal((await api.notesGet('n1')).note.kind, 'manual');
    assert.equal((await api.backup()).revision, 7);
    const markdown = await api.markdown({ epoch: first.epoch, expectedRevision: 7,
      ids: ['n1', first.noteId] });
    assert.equal(markdown.count, 2);
    assert.match(markdown.content, /引用😀/);
    assert.match(markdown.content, /改写 😀/);
    const file = markdownFile(markdown);
    assert.equal(file.blob.type, 'text/markdown;charset=utf-8');
    assert.equal(await file.blob.text(), markdown.content);
    await assert.rejects(api.markdown({ epoch: first.epoch, expectedRevision: 6,
      ids: ['n1'] }), { code: 'VERSION_CONFLICT' });
    const beforeEdit = (await api.notesGet('n1')).note;
    const noteEdit = { requestId: 'edit_quoted', epoch: first.epoch, expectedRevision: 7,
      id: 'n1', expectedVersion: beforeEdit.version, title: '修改标题',
      bodyMarkdown: '完整编辑正文 😀', tagIds: [] };
    assert.equal((await api.notesEdit(noteEdit)).revision, 8);
    assert.deepEqual((await api.library({ scope: 'session', sessionId: 'synthetic',
      sort: 'session', sessionActivity: [{ sessionId: 'synthetic', updatedAt: 1234 }] })).ids, ['n1']);
    await assert.rejects(api.library({ scope: 'session', sessionId: 'synthetic',
      sort: 'session', sessionActivity: [] }), { code: 'SESSION_ACTIVITY_UNAVAILABLE' });
    assert.deepEqual((await api.notesGet('n1')).note.quote, beforeEdit.quote);
    assert.deepEqual((await api.notesGet('n1')).note.source, beforeEdit.source);
    assert.equal((await api.notesEdit(noteEdit)).revision, 8);
    const imported = backupJson(notebookFixture());
    const bytes = Buffer.from(imported.content, 'utf8');
    const begin = { uploadId: 'preview_only', bytes: bytes.length };
    const staged = await api.backupBegin(begin);
    assert.deepEqual(await api.backupBegin(begin), staged);
    for (let index = 0; index * 128 < bytes.length; index++) {
      const payload = { token: staged.token, index,
        base64: bytes.subarray(index * 128, (index + 1) * 128).toString('base64') };
      assert.equal((await api.backupChunk(payload)).nextIndex, index + 1);
      assert.equal((await api.backupChunk(payload)).nextIndex, index + 1);
    }
    const finished = await api.backupFinish({ token: staged.token });
    assert.equal(finished.summary.noteCount, 1);
    const impact = await api.backupPreview({ token: staged.token });
    assert.equal(impact.current.revision, 8);
    assert.equal(impact.backup.notes, 1);
    assert.equal(impact.capacity.limitBytes, 1024 * 1024);
    assert.equal(impact.capacity.fits, true);
    assert.ok(impact.capacity.estimatedBytes > 0);
    assert.equal((await api.backup()).revision, 8, 'preview cannot replace the library');
    const beforeRefresh = await api.notesGet('n1');
    assert.equal((await api.notesEdit({ requestId: 'edit_before_refresh', epoch: first.epoch,
      expectedRevision: 8, id: 'n1', expectedVersion: beforeRefresh.note.version,
      title: '预览期间更新', bodyMarkdown: beforeRefresh.note.bodyMarkdown,
      tagIds: beforeRefresh.note.tagIds })).revision, 9);
    const refreshed = await api.backupPreview({ token: staged.token });
    assert.equal(refreshed.current.revision, 9);
    assert.equal(refreshed.token, impact.token);
    assert.deepEqual(await api.backupCancel({ token: staged.token }), { cancelled: true });
    await assert.rejects(api.backupPreview({ token: staged.token }), { code: 'UPLOAD_NOT_FOUND' });
    assert.deepEqual(await api.backupCancel({ uploadId: 'late_begin' }), { cancelled: true });
    await assert.rejects(api.backupBegin({ uploadId: 'late_begin', bytes: bytes.length }),
      { code: 'UPLOAD_NOT_FOUND' });
    const large = notebookFixture();
    large.notes.n1.bodyMarkdown = '中文😀'.repeat(20000);
    large.notes.n2 = { ...large.notes.n1, id: 'n2', bodyMarkdown: 'large note '.repeat(8000) };
    const largeBackup = backupJson(large);
    assert.ok(largeBackup.bytes > 128 * 1024);
    const transferred = await stageBackupFile(new Blob([largeBackup.content]), api,
      { uploadId: 'client_to_host', signal: new AbortController().signal });
    assert.equal(transferred.summary.noteCount, 2);
    assert.equal(transferred.preview.backup.notes, 2);
    assert.equal((await api.backup()).revision, 9, 'Client upload and preview cannot write');
    assert.deepEqual(await api.backupCancel({ uploadId: 'client_to_host' }), { cancelled: true });
    await transport.close(); await service.close(); await domain.close();
    assert.equal(transport.routes.size, 0);
    domain = await facility.open(spec);
    service = manualNotebookService({ domain, now: () => '2026-10-05T00:00:01.000Z' });
    transport = wire(service);
    assert.equal((await transport.api.get(first.noteId)).note.bodyMarkdown, '改写 😀');
    assert.equal((await transport.api.notesGet('n1')).note.bodyMarkdown, '完整编辑正文 😀');
    assert.equal((await transport.api.create(request('manual_first', 0))).noteId, first.noteId);
    await transport.close(); await service.close(); await domain.close();
  } finally {
    await facility.closeAll(); unregister(); await backend.close(); await root.fiber.dispose();
  }
});

test('manual Controller through exact RPC and real Domain persists create, edit, backup and reopen', async t => {
  const base = new URL('../../.storage-test-output/', import.meta.url);
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const rootDir = await fs.mkdtemp(new URL('controller-roundtrip-', base).pathname);
  t.after(async () => { await checkedTestRoot(rootDir); await fs.rm(rootDir, { recursive: true }); });
  const root = new Context(); await root.plugin(Storage);
  const backend = new JsonStorageBackend(rootDir);
  const unregister = root.storage.backend.register('manual_controller_test', backend);
  const facility = new DomainFacility(root, { backend: 'manual_controller_test' });
  const ownSpec = defineDomain({ name: 'manual_controller_test', version: 1, layout: 'single', tables: {},
    global: { schema: notebookSchema, initial: notebookFixture() } });
  let domain, transport, controller;
  try {
    domain = await facility.open(ownSpec);
    transport = wire(manualNotebookService({ domain }));
    let counter = 0;
    let dropFirstCreateReply = true;
    const adapter = previewApi({ rpc: { call: async (_channel, method, payload, signal) => {
      const rpcId = `controller_${++counter}`;
      const path = `/api/${method}`;
      const handler = transport.routes.get(path);
      assert.ok(handler);
      const response = await handler.fetch(new Request(`http://localhost${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal,
        body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
      }));
      const result = (await response.json()).result;
      if (method === 'dsh-session-notebook/manual/create' && dropFirstCreateReply) {
        dropFirstCreateReply = false;
        throw new Error('connection dropped committed reply');
      }
      return result;
    } } });
    let intentNumber = 0;
    controller = manualSaveController({ api: adapter, createRequestId: () => `intent_${++intentNumber}` });
    const meta = await adapter.list({}, new AbortController().signal);
    controller.editTitle('组合 **标题**');
    controller.edit('## 段落\n\n[文档](https://example.com)\n\n- [ ] 任务😀');
    await assert.rejects(controller.save(meta), { code: 'TRANSPORT_FAILED' });
    assert.equal(controller.snapshot().pending.requestId, 'intent_1');
    assert.equal(controller.snapshot().draft, '## 段落\n\n[文档](https://example.com)\n\n- [ ] 任务😀');
    const first = await controller.retry();
    assert.equal(intentNumber, 1);
    await assert.rejects(controller.save(meta), { code: 'VALIDATION_FAILED' });
    assert.equal(first.revision, 1);
    assert.equal(domain.global.get().revision, 1);
    assert.equal(Object.keys(domain.global.get().operationReceipts).length, 1);
    assert.equal(controller.snapshot().draft, '');
    const listing = await adapter.list({}, new AbortController().signal);
    assert.deepEqual(listing.ids, [first.noteId]);
    const detail = await adapter.get(first.noteId, new AbortController().signal);
    assert.equal(detail.note.title, '组合 **标题**');
    controller.load(detail.note);
    controller.editTitle('已更新'); controller.edit('修改后 😀');
    const updated = await controller.save({ epoch: listing.epoch, revision: listing.revision });
    assert.equal(updated.revision, 2);
    const backup = await adapter.backup(new AbortController().signal);
    const file = backupFile(backup);
    assert.match(file.filename, /^dsh-session-notebook-rev-2-\d{14}\.json$/);
    assert.equal(inspectBackupJson(await file.blob.text(), { declaredBytes: file.bytes })
      .snapshot.notes[first.noteId].bodyMarkdown, '修改后 😀');
    controller.dispose(); controller = null;
    await transport.close(); transport = null; await domain.close(); domain = null;
    domain = await facility.open(ownSpec);
    const persisted = manualNotebookService({ domain });
    assert.equal(persisted.get(first.noteId).note.bodyMarkdown, '修改后 😀');
    await persisted.close(); await domain.close(); domain = null;
  } finally {
    controller?.dispose(); if (transport) await transport.close();
    if (domain) await domain.close();
    await facility.closeAll(); unregister(); await backend.close(); await root.fiber.dispose();
  }
});

test('lost RPC reply after a persisted write retries the identical Controller intent without duplicate commit', async () => {
  const snapshot = notebookFixture(); let writes = 0;
  const domain = { global: { get: () => structuredClone(snapshot), async set(next) {
    Object.assign(snapshot, structuredClone(next)); writes++;
  } } };
  const service = manualNotebookService({ domain });
  const transport = wire(service);
  let calls = 0;
  const api = previewApi({ rpc: { call: async (channel, method, payload, signal) => {
    assert.equal(channel, '/api');
    assert.equal(signal.aborted, false);
    const path = `/api/${method}`;
    const response = await transport.routes.get(path).fetch(new Request(`http://localhost${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal,
      body: JSON.stringify({ type: 'client-request', rpcId: `lost_${++calls}`, method, payload }),
    }));
    const envelope = await response.json();
    if (calls === 1) throw new Error('lost reply after Host committed');
    return envelope.result;
  } } });
  let minted = 0;
  const controller = manualSaveController({ api, createRequestId: () => `lost_intent_${++minted}` });
  try {
    controller.edit('未收到响应😀');
    await assert.rejects(controller.save({ epoch: snapshot.epoch, revision: 0 }), { code: 'TRANSPORT_FAILED' });
    assert.equal(controller.snapshot().pending.requestId, 'lost_intent_1');
    assert.equal(controller.snapshot().draft, '未收到响应😀');
    assert.equal(snapshot.revision, 1);
    const receipt = await controller.retry();
    assert.equal(receipt.revision, 1);
    assert.equal(controller.snapshot().draft, '');
    assert.equal(minted, 1);
    assert.equal(writes, 1);
    assert.equal(Object.keys(snapshot.notes).length, 2);
  } finally {
    controller.dispose(); await transport.close(); await service.close();
  }
});

test('version conflict reads matching Host detail before explicit rebase and preserves unsaved edits', async () => {
  const snapshot = notebookFixture();
  const domain = { global: { get: () => structuredClone(snapshot), async set(next) {
    Object.assign(snapshot, structuredClone(next));
  } } };
  const service = manualNotebookService({ domain }); const transport = wire(service);
  let rpcSequence = 0;
  const api = previewApi({ rpc: { call: async (channel, method, payload, signal) => {
    assert.equal(channel, '/api');
    const path = `/api/${method}`;
    const response = await transport.routes.get(path).fetch(new Request(`http://localhost${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal,
      body: JSON.stringify({ type: 'client-request', rpcId: `version_${++rpcSequence}`, method, payload }),
    }));
    return (await response.json()).result;
  } } });
  const controller = manualSaveController({ api, createRequestId: (() => { let next = 0;
    return () => `version_${++next}`; })() });
  try {
    const created = await api.create(request('first_note', 0), new AbortController().signal);
    const loaded = await api.get(created.noteId, new AbortController().signal);
    controller.load(loaded.note); controller.edit('mine **draft**');
    const external = await api.update({ requestId: 'other_editor', epoch: created.epoch,
      expectedRevision: 1, id: created.noteId, expectedVersion: 1, bodyMarkdown: 'other editor' },
    new AbortController().signal);
    assert.equal(external.revision, 2);
    await assert.rejects(controller.save({ epoch: created.epoch, revision: 1 }), { code: 'VERSION_CONFLICT' });
    assert.equal(controller.snapshot().draft, 'mine **draft**');
    const preview = await controller.inspectConflict();
    assert.equal(preview.note.bodyMarkdown, 'other editor');
    assert.equal(preview.note.version, 2);
    assert.equal(controller.snapshot().draft, 'mine **draft**');
    const latest = controller.resolveConflictConfirmed(preview);
    const receipt = await controller.save(latest);
    assert.equal(receipt.revision, 3);
    assert.equal((await api.get(created.noteId, new AbortController().signal)).note.bodyMarkdown, 'mine **draft**');
  } finally { controller.dispose(); await transport.close(); await service.close(); }
});

test('post-enqueue cancellation preserves Host receipt and never pretends to roll back', async () => {
  const snapshot = notebookFixture(); let writes = 0;
  let resume, started;
  const entered = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { resume = resolve; });
  const domain = { global: { get: () => structuredClone(snapshot), async set(next) {
    started(); await gate;
    Object.assign(snapshot, structuredClone(next)); writes++;
  } } };
  const service = manualNotebookService({ domain });
  const transport = wire(service);
  const path = '/api/dsh-session-notebook/manual/create';
  const controller = new AbortController();
  const envelope = { type: 'client-request', rpcId: 'pending',
    method: 'dsh-session-notebook/manual/create', payload: request('pending_write', 0) };
  const startedRequest = transport.routes.get(path).fetch(new Request(`http://localhost${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope), signal: controller.signal,
  }));
  await entered;
  controller.abort(); resume();
  const response = await startedRequest;
  assert.equal((await response.json()).result.value.revision, 1);
  assert.equal(writes, 1);
  assert.equal((await transport.api.create(envelope.payload)).revision, 1);
  assert.equal(writes, 1);
  await transport.close(); await service.close();
});

test('preview transport rejects malformed envelope and cancelled requests without writes', async () => {
  const snapshot = notebookFixture(); let writes = 0;
  const domain = { global: { get: () => structuredClone(snapshot), set: async () => { writes++; } } };
  const service = manualNotebookService({ domain });
  const transport = wire(service);
  const path = '/api/dsh-session-notebook/manual/create';
  const route = transport.routes.get(path);
  const invalid = await route.fetch(new Request(`http://localhost${path}`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      type: 'client-request', rpcId: 'negative', method: 'settings/describe', payload: request('x', 0),
    }) }));
  assert.equal((await invalid.json()).result.error.code, 'VALIDATION_FAILED');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(previewApi({ rpc: { call: () => assert.fail('must not call carrier') } })
    .create(request('cancel', 0), controller.signal), { code: 'CANCELLED' });
  await assert.rejects(previewApi({ rpc: { call: async () => ({ ok: true, value: { revision: 1 } }) } })
    .create(request('malformed', 0), new AbortController().signal), { code: 'INVALID_RESPONSE' });
  const deniedService = manualNotebookService({ domain });
  const deniedRoutes = new Map(), deniedCleanup = [];
  registerPreviewRoutes({ effect: setup => deniedCleanup.push(setup()), connection: {
    admit: () => ({ rejection: 401 }), fetch: { register: route => {
      deniedRoutes.set(route.path, route); return async () => deniedRoutes.delete(route.path);
    } },
  } }, deniedService);
  const denied = await deniedRoutes.get(path).fetch(new Request(`http://localhost${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'unauthorized',
      method: 'dsh-session-notebook/manual/create', payload: request('denied', 0) }),
  }));
  assert.equal(denied.status, 401);
  const deniedTagPath = '/api/dsh-session-notebook/tags/create';
  const deniedTag = await deniedRoutes.get(deniedTagPath).fetch(new Request(`http://localhost${deniedTagPath}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'unauthorized-tag',
      method: 'dsh-session-notebook/tags/create', payload: { requestId: 'denied-tag',
        epoch: snapshot.epoch, expectedRevision: snapshot.revision, name: '秘密' } }),
  }));
  assert.equal(deniedTag.status, 401);
  const deniedMarkdownPath = '/api/dsh-session-notebook/markdown/export';
  const deniedMarkdown = await deniedRoutes.get(deniedMarkdownPath).fetch(new Request(
    `http://localhost${deniedMarkdownPath}`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'unauthorized-markdown',
        method: 'dsh-session-notebook/markdown/export',
        payload: { epoch: snapshot.epoch, expectedRevision: snapshot.revision, ids: ['n1'] } }),
    }));
  assert.equal(deniedMarkdown.status, 401);
  const deniedEditPath = '/api/dsh-session-notebook/notes/edit';
  const deniedEdit = await deniedRoutes.get(deniedEditPath).fetch(new Request(
    `http://localhost${deniedEditPath}`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'unauthorized-edit',
        method: 'dsh-session-notebook/notes/edit', payload: { requestId: 'denied-edit',
          epoch: snapshot.epoch, expectedRevision: snapshot.revision, id: 'n1',
          expectedVersion: 1, bodyMarkdown: 'no write' } }),
    }));
  assert.equal(deniedEdit.status, 401);
  assert.equal(writes, 0);
  for (const cleanup of deniedCleanup.reverse()) await cleanup();
  await deniedService.close();
  await transport.close(); await service.close();
  assert.equal(transport.routes.size, 0);
});

test('Host without public admission remains read-only and opens no storage', async () => {
  const { apply } = await import('../../src/host/index.js');
  const paths = [];
  const cleanup = [];
  apply({ effect: setup => { cleanup.push(setup()); }, connection: { fetch: { register: route => {
    paths.push(route.path); return async () => {};
  } } } });
  assert.deepEqual(paths, ['/api/dsh-session-notebook/health', '/api/dsh-session-notebook/list']);
  for (const dispose of cleanup.reverse()) await dispose();
});

test('pack manifest ships business dependencies and production delegates through runtime assembly', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  for (const entry of ['src/manual-notebook-service.js', 'src/host/preview-routes.js',
    'src/client/preview-api.js', 'src/client/backup-file.js', 'src/client/markdown-file.js',
    'src/client/input-draft.js',
    'src/notebook-schema.js', 'src/snapshot-coordinator.js']) {
    assert.ok(manifest.files.includes(entry), entry);
  }
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-session'));
  const rootFile = await fs.readFile(new URL('../../src/host/index.js', import.meta.url), 'utf8');
  assert.equal(rootFile.includes('registerPreviewRoutes'), false);
  assert.equal(rootFile.includes('manualNotebookService'), false);
});
