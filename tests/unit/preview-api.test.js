import test from 'node:test';
import assert from 'node:assert/strict';
import { previewApi } from '../../src/client/preview-api.js';

test('replacement Client refuses forged counts and inconsistent capacity before showing an impact', async () => {
  const valid = { token: 'token', mode: 'replace-whole-library',
    current: { epoch: 'e', revision: 0, notes: 2, trashed: 1, tags: 1 },
    backup: { backupVersion: 1, schemaVersion: 1, notes: 3, trashed: 0, tags: 2 },
    impact: { notesRemoved: 1, notesReplaced: 1, notesAdded: 2,
      tagsRemoved: 0, tagsReplaced: 1, tagsAdded: 1 },
    capacity: { estimatedBytes: 1001, limitBytes: 1000, fits: false } };
  let value = structuredClone(valid);
  const api = previewApi({ rpc: { call: async () => ({ ok: true, value }) } });
  const read = () => api.backupPreview({ token: 'token' }, new AbortController().signal);
  assert.deepEqual(await read(), valid);
  for (const alter of [item => { item.current.trashed = 3; },
    item => { item.impact.notesAdded = 99; }, item => { item.impact.tagsRemoved = -1; },
    item => { item.capacity.fits = true; }, item => { delete item.capacity; },
    item => { item.backup.schemaVersion = 2; }]) {
    value = structuredClone(valid); alter(value);
    await assert.rejects(read(), { code: 'INVALID_RESPONSE' });
  }
});

test('every read endpoint settles on local timeout even when carrier ignores abort', async () => {
  for (const method of ['list', 'get', 'backup', 'library', 'tagsList', 'tagsPreview',
    'notesPreview', 'notesGet']) {
    let carrierSignal, resolve;
    const api = previewApi({ rpc: { call: (_channel, _method, _payload, signal) => {
      carrierSignal = signal;
      return new Promise(done => { resolve = done; });
    } } }, { timeoutMs: 5 });
    const signal = new AbortController().signal;
    const waiting = method === 'get' ? api.get('n1', signal)
      : method === 'list' ? api.list({}, signal)
        : method === 'library' ? api.library({}, signal)
          : method === 'tagsList' ? api.tagsList(signal)
            : method === 'tagsPreview' ? api.tagsPreview({ action: 'delete', sourceId: 't1' }, signal)
              : method === 'notesPreview' ? api.notesPreview({ action: 'trash', ids: ['n1'] }, signal)
                : method === 'notesGet' ? api.notesGet('n1', signal)
              : api.backup(signal);
    await assert.rejects(waiting, { code: 'TIMEOUT' });
    assert.equal(carrierSignal.aborted, true);
    resolve({ ok: true, value: null });
    await new Promise(done => setImmediate(done));
  }
});

test('generic detail rejects malformed note before conversion UI can use it', async () => {
  let value = { epoch: 'e', revision: 1, note: { id: 'n1', kind: 'note',
    bodyMarkdown: '正文', version: 1, tagIds: [] } };
  const api = previewApi({ rpc: { call: async () => ({ ok: true, value }) } });
  await assert.rejects(api.notesGet('n1', new AbortController().signal), { code: 'INVALID_RESPONSE' });
  value = { ...value, note: { ...value.note, quote: { content: '原文', format: 'plain_text' } } };
  assert.equal((await api.notesGet('n1', new AbortController().signal)).note.bodyMarkdown, '正文');
});

test('note preview rejects missing or reordered impact entries', async () => {
  const payload = { action: 'trash', ids: ['n2', 'n1'] };
  let value = { action: 'trash', epoch: 'test', revision: 1, count: 2,
    entries: [{ id: 'n1', title: 'first', kind: 'note', version: 1 },
      { id: 'n2', title: 'second', kind: 'note', version: 1 }] };
  const api = previewApi({ rpc: { call: async () => ({ ok: true, value }) } });
  await assert.rejects(api.notesPreview(payload, new AbortController().signal), { code: 'INVALID_RESPONSE' });
  value = { ...value, entries: [value.entries[1]] };
  await assert.rejects(api.notesPreview(payload, new AbortController().signal), { code: 'INVALID_RESPONSE' });
});

test('tag Client rejects a note receipt and retains fixed conflict codes', async () => {
  let response = { ok: true, value: { epoch: 'test', revision: 1, noteId: 'wrong' } };
  const api = previewApi({ rpc: { call: async () => response } });
  await assert.rejects(api.tagsCreate({ requestId: 'r' }, new AbortController().signal),
    { code: 'INVALID_RESPONSE' });
  response = { ok: false, error: { code: 'NAME_CONFLICT', message: 'private name' } };
  await assert.rejects(api.tagsRename({ requestId: 'r' }, new AbortController().signal),
    { code: 'NAME_CONFLICT', message: 'NAME_CONFLICT' });
});

test('generic edit uses the exact carrier and requires the edited note ID in its receipt', async () => {
  const payload = { requestId: 'edit_note', epoch: 'e', expectedRevision: 0,
    id: 'n1', expectedVersion: 1, bodyMarkdown: '正文' };
  let result = { ok: true, value: { epoch: 'e', revision: 1, noteId: 'wrong' } };
  const api = previewApi({ rpc: { call: async (channel, method, actual) => {
    assert.equal(channel, '/api'); assert.equal(method, 'dsh-session-notebook/notes/edit');
    assert.deepEqual(actual, payload); return result;
  } } });
  await assert.rejects(api.notesEdit(payload, new AbortController().signal), { code: 'INVALID_RESPONSE' });
  result = { ok: true, value: { epoch: 'e', revision: 1, noteId: 'n1' } };
  assert.deepEqual(await api.notesEdit(payload, new AbortController().signal), result.value);
});

test('library transport rejects a malformed success result through the exact carrier', async () => {
  let method;
  let value = { epoch: 'test', revision: 1, total: 1,
    ids: ['n1'], pageIds: ['n1'], items: [] };
  const api = previewApi({ rpc: { call: async (channel, requested) => {
    assert.equal(channel, '/api'); method = requested;
    return { ok: true, value };
  } } });
  await assert.rejects(api.library({}, new AbortController().signal), { code: 'INVALID_RESPONSE' });
  value = { epoch: 'test', revision: 1, total: 1, ids: ['n1'], pageIds: ['n2'],
    selectedVisibleIds: [], hiddenSelectedCount: 0, items: [{ id: 'n2', kind: 'note',
      title: '', excerpt: '', tagIds: [], source: null, createdAt: '2026-10-05T00:00:00Z',
      updatedAt: '2026-10-05T00:00:00Z', deletedAt: null, version: 1 }] };
  await assert.rejects(api.library({}, new AbortController().signal), { code: 'INVALID_RESPONSE' });
  assert.equal(method, 'dsh-session-notebook/library/query');
});

test('Markdown transport validates complete UTF-8 content and selected revision', async () => {
  const payload = { epoch: 'test', expectedRevision: 2, ids: ['n1'] };
  let value = { epoch: 'test', revision: 2, count: 1, content: '完整 😀', bytes: 11 };
  const api = previewApi({ rpc: { call: async (channel, method, requested) => {
    assert.equal(channel, '/api');
    assert.equal(method, 'dsh-session-notebook/markdown/export');
    assert.deepEqual(requested, payload);
    return { ok: true, value };
  } } });
  assert.equal((await api.markdown(payload, new AbortController().signal)).content, '完整 😀');
  value = { ...value, content: '摘要' };
  await assert.rejects(api.markdown(payload, new AbortController().signal), { code: 'INVALID_RESPONSE' });
  value = { ...value, revision: 3 };
  await assert.rejects(api.markdown(payload, new AbortController().signal), { code: 'INVALID_RESPONSE' });
});

test('caller cancellation settles an unresponsive carrier without exposing its late failure', async () => {
  let reject;
  const caller = new AbortController();
  const api = previewApi({ rpc: { call: () => new Promise((_resolve, fail) => { reject = fail; }) } });
  const waiting = api.list({}, caller.signal);
  caller.abort();
  await assert.rejects(waiting, { code: 'CANCELLED' });
  reject(Error('private path/token'));
  await new Promise(done => setImmediate(done));
});
