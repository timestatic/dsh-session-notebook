import test from 'node:test';
import assert from 'node:assert/strict';
import { manualSaveController } from '../../src/client/manual-save-controller.js';

const meta = { epoch: 'test-epoch', revision: 0 };
const error = code => Object.assign(new Error('private error'), { code });

test('Unicode and UTF-8 limits reject without truncating or freezing the editable draft', async () => {
  const calls = [];
  const store = manualSaveController({ createRequestId: () => 'bounded',
    api: { create: async intent => { calls.push(intent); return { epoch: intent.epoch, revision: 1,
      noteId: 'manual_1' }; } } });
  store.editTitle('😀'.repeat(1001)); store.edit('正文');
  await assert.rejects(store.save(meta), { code: 'TITLE_LIMIT' });
  assert.equal(store.snapshot().title, '😀'.repeat(1001));
  store.editTitle('😀'.repeat(501));
  await assert.rejects(store.save(meta), { code: 'TITLE_LIMIT' });
  store.editTitle('😀'.repeat(500)); store.edit('字'.repeat(100001));
  await assert.rejects(store.save(meta), { code: 'BODY_LIMIT' });
  assert.equal(store.snapshot().draft, '字'.repeat(100001));
  store.edit('字'.repeat(90000));
  await assert.rejects(store.save(meta), { code: 'REQUEST_LIMIT' });
  assert.equal(store.snapshot().draft, '字'.repeat(90000));
  assert.equal(store.snapshot().pending, null);
  assert.equal(calls.length, 0);
  store.edit('字'.repeat(100));
  await store.save(meta);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].title, '😀'.repeat(500));
  store.dispose();
});

test('preflight counts the complete RPC envelope at the 256 KiB route boundary', async () => {
  let sent = false;
  const store = manualSaveController({ createRequestId: () => 'bounded',
    api: { create: async () => { sent = true; throw error('INVALID_RESPONSE'); } } });
  const body = '字'.repeat(87330);
  const intent = { requestId: 'bounded', epoch: meta.epoch,
    expectedRevision: meta.revision, bodyMarkdown: body };
  assert.ok(Buffer.byteLength(JSON.stringify(intent)) <= 256 * 1024);
  assert.ok(Buffer.byteLength(JSON.stringify({ type: 'client-request', rpcId: 'x'.repeat(128),
    method: 'dsh-session-notebook/manual/create', payload: intent })) > 256 * 1024);
  store.edit(body);
  await assert.rejects(store.save(meta), { code: 'REQUEST_LIMIT' });
  assert.equal(sent, false);
  assert.equal(store.snapshot().draft, body);
  assert.equal(store.snapshot().pending, null);
  store.dispose();
});

test('definitive Host limit rejection keeps text but releases stale intent for editing', async () => {
  let attempts = 0;
  const store = manualSaveController({ createRequestId: () => `bounded_${++attempts}`,
    api: { create: async intent => {
      if (attempts === 1) throw error('SNAPSHOT_LIMIT');
      return { epoch: intent.epoch, revision: 1, noteId: 'manual_1' };
    } } });
  store.edit('超过当前库限额');
  await assert.rejects(store.save(meta), { code: 'SNAPSHOT_LIMIT' });
  assert.equal(store.snapshot().draft, '超过当前库限额');
  assert.equal(store.snapshot().pending, null);
  store.edit('缩短后重试');
  await store.save(meta);
  assert.equal(attempts, 2);
  store.dispose();
});

test('lost reply retains draft and exact request intent through stable retry', async () => {
  const calls = []; let ids = 0;
  const store = manualSaveController({ createRequestId: () => `intent_${++ids}`,
    api: { create: async (intent, signal) => {
      calls.push({ intent: structuredClone(intent), signal });
      if (calls.length === 1) throw error('TRANSPORT_FAILED');
      return { epoch: intent.epoch, revision: 1, noteId: 'manual_1' };
    } } });
  store.edit(' **正文**\n\n😀 ');
  await assert.rejects(store.save(meta), { code: 'TRANSPORT_FAILED' });
  assert.equal(store.snapshot().draft, ' **正文**\n\n😀 ');
  assert.equal(store.snapshot().status, 'failed');
  assert.equal(ids, 1);
  await assert.rejects(store.save(meta), { code: 'PENDING_INTENT' });
  assert.throws(() => store.edit('different'), { code: 'PENDING_INTENT' });
  await store.retry();
  assert.deepEqual(calls[0].intent, calls[1].intent);
  assert.equal(ids, 1);
  assert.equal(store.snapshot().draft, '');
  assert.equal(store.snapshot().status, 'saved');
  assert.equal(store.snapshot().receipt.noteId, 'manual_1');
  store.dispose();
});

test('external snapshots and transport cannot mutate the stable pending request or published receipt', async () => {
  const calls = []; let published;
  const store = manualSaveController({ createRequestId: () => 'immutable',
    onChange: value => { published = value; },
    api: { create: async intent => {
      calls.push(structuredClone(intent));
      intent.bodyMarkdown = 'transport mutation';
      if (calls.length === 1) throw error('TRANSPORT_FAILED');
      return { epoch: intent.epoch, revision: 1, noteId: 'manual_1' };
    } } });
  store.editTitle('keep title'); store.edit('keep body');
  await assert.rejects(store.save(meta), { code: 'TRANSPORT_FAILED' });
  const exposed = store.snapshot();
  exposed.pending.title = 'tampered'; exposed.pending.bodyMarkdown = 'tampered';
  published.pending.requestId = 'replacement';
  assert.equal(store.snapshot().pending.requestId, 'immutable');
  await store.retry();
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[1].title, 'keep title');
  assert.equal(calls[1].bodyMarkdown, 'keep body');
  published.receipt.noteId = 'tampered';
  const saved = store.snapshot(); saved.receipt.noteId = 'tampered again';
  assert.equal(store.snapshot().receipt.noteId, 'manual_1');
  store.dispose();
});

test('invalid transport receipt retains identical intent and draft for retry', async () => {
  const calls = [];
  const store = manualSaveController({ createRequestId: () => 'stable', api: {
    create: async intent => { calls.push(structuredClone(intent)); return calls.length === 1
      ? { epoch: intent.epoch, revision: 1, noteId: '../outside' }
      : { epoch: intent.epoch, revision: 1, noteId: 'manual_ok' }; },
  } });
  store.edit('should not vanish');
  await assert.rejects(store.save(meta), { code: 'INVALID_RESPONSE' });
  assert.equal(store.snapshot().draft, 'should not vanish');
  assert.equal(store.snapshot().pending.requestId, 'stable');
  await store.retry();
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(store.snapshot().draft, '');
  store.dispose();
});

test('timeout settles even when transport ignores abort; retry keeps intent and ignores late reply', async () => {
  let resolve, signal; let changes = 0; const calls = [];
  const store = manualSaveController({ createRequestId: () => 'stable', timeoutMs: 10,
    onChange: () => { changes++; },
    api: { create: (intent, currentSignal) => {
      calls.push(structuredClone(intent));
      signal = currentSignal;
      if (calls.length > 1) return Promise.resolve({ epoch: intent.epoch, revision: 1, noteId: 'manual_retry' });
      return new Promise(done => { resolve = done; });
    } } });
  store.edit('recoverable');
  await assert.rejects(store.save(meta), { code: 'TIMEOUT' });
  assert.equal(signal.aborted, true);
  assert.equal(store.snapshot().status, 'failed');
  assert.equal(store.snapshot().draft, 'recoverable');
  assert.equal(store.snapshot().pending.requestId, 'stable');
  await store.retry();
  assert.deepEqual(calls[0], calls[1]);
  const before = changes;
  resolve({ epoch: 'test-epoch', revision: 1, noteId: 'manual_late' });
  await new Promise(done => setImmediate(done));
  assert.equal(changes, before);
  assert.equal(store.snapshot().receipt.noteId, 'manual_retry');
  store.dispose();
});

test('dispose settles a stuck request and prevents late publication', async () => {
  let resolve; let changes = 0;
  const store = manualSaveController({ createRequestId: () => 'stable',
    onChange: () => { changes++; },
    api: { create: () => new Promise(done => { resolve = done; }) } });
  store.edit('recoverable');
  const pending = store.save(meta);
  store.dispose();
  const before = changes;
  await assert.rejects(pending, { code: 'CANCELLED' });
  resolve({ epoch: 'test-epoch', revision: 1, noteId: 'manual_late' });
  await new Promise(done => setImmediate(done));
  assert.equal(changes, before);
  assert.equal(store.snapshot().draft, 'recoverable');
});

test('panel cancellation settles a stuck request but retains its intent for the same-ID retry', async () => {
  const calls = []; let finish;
  const store = manualSaveController({ createRequestId: () => 'stable',
    api: { create: (intent, signal) => {
      calls.push({ intent: structuredClone(intent), signal });
      return calls.length === 1 ? new Promise(resolve => { finish = resolve; })
        : Promise.resolve({ epoch: intent.epoch, revision: 1, noteId: 'manual_1' });
    } } });
  store.edit('unsaved');
  const pending = store.save(meta);
  store.cancel();
  await assert.rejects(pending, { code: 'CANCELLED' });
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(store.snapshot().pending.requestId, 'stable');
  assert.equal(store.snapshot().draft, 'unsaved');
  await store.retry();
  assert.deepEqual(calls[0].intent, calls[1].intent);
  finish({ epoch: 'test-epoch', revision: 1, noteId: 'manual_late' });
  assert.equal(store.snapshot().receipt.noteId, 'manual_1');
  store.dispose();
});

test('failed request stays pending until explicit discard, never silently rekeys', async () => {
  const store = manualSaveController({ createRequestId: () => 'stable',
    api: { create: async () => { throw error('COMMIT_UNKNOWN'); } } });
  store.edit('draft');
  await assert.rejects(store.save(meta), { code: 'COMMIT_UNKNOWN' });
  assert.equal(store.snapshot().diagnostic, 'COMMIT_UNKNOWN');
  assert.throws(() => store.edit('new'), { code: 'PENDING_INTENT' });
  store.discardConfirmed();
  store.edit('new');
  assert.equal(store.snapshot().draft, 'new');
  store.dispose();
});

test('edit saves title and original version; conflict preserves draft until explicit latest-state resolution', async () => {
  const calls = []; let sequence = 0;
  const store = manualSaveController({ createRequestId: () => `edit_${++sequence}`,
    api: { create: () => assert.fail('must update'),
      list: async () => ({ epoch: 'test-epoch', revision: 3 }),
      get: async () => ({ epoch: 'test-epoch', revision: 3,
        note: { id: 'manual_1', version: 2, title: 'another user', bodyMarkdown: 'latest server body' } }),
      update: async intent => {
      calls.push(structuredClone(intent));
      if (calls.length === 1) throw error('VERSION_CONFLICT');
      return { epoch: intent.epoch, revision: 4, noteId: intent.id };
    } } });
  store.load({ id: 'manual_1', version: 1, title: 'old', bodyMarkdown: 'original' });
  store.editTitle('new title'); store.edit('my changed draft');
  await assert.rejects(store.save(meta), { code: 'VERSION_CONFLICT' });
  await assert.rejects(store.retry(), { code: 'VERSION_CONFLICT' });
  assert.equal(calls.length, 1);
  assert.equal(store.snapshot().draft, 'my changed draft');
  assert.throws(() => store.resolveConflictConfirmed({ epoch: 'test-epoch', revision: 3,
    note: { id: 'manual_1', version: 2 } }), { code: 'VALIDATION_FAILED' });
  const preview = await store.inspectConflict();
  assert.equal(preview.note.bodyMarkdown, 'latest server body');
  assert.equal(store.snapshot().draft, 'my changed draft');
  const latest = store.resolveConflictConfirmed(preview);
  assert.equal(store.snapshot().draft, 'my changed draft');
  await store.save(latest);
  assert.deepEqual(calls[1], { requestId: 'edit_2', epoch: 'test-epoch', expectedRevision: 3,
    id: 'manual_1', expectedVersion: 2, title: 'new title', bodyMarkdown: 'my changed draft', tagIds: [] });
  assert.equal(store.snapshot().editingId, null);
  store.dispose();
});

test('multiple selected tags survive an uncertain save and exact retry', async () => {
  const calls = [];
  const store = manualSaveController({ createRequestId: () => 'tagged_save',
    api: { create: async intent => {
      calls.push(structuredClone(intent));
      if (calls.length === 1) throw error('TIMEOUT');
      return { epoch: intent.epoch, revision: 1, noteId: 'manual_1' };
    } } });
  store.edit('正文'); store.editTags(['tag_1', 'tag_2']);
  await assert.rejects(store.save(meta), { code: 'TIMEOUT' });
  assert.deepEqual(store.snapshot().pending.tagIds, ['tag_1', 'tag_2']);
  assert.throws(() => store.editTags(['tag_1']), { code: 'PENDING_INTENT' });
  await store.retry();
  assert.deepEqual(calls[1], calls[0]);
  assert.deepEqual(store.snapshot().tagIds, []);
  store.dispose();
});

test('conflict lookup fails closed on stale detail and never changes local draft', async () => {
  let listCalls = 0;
  const store = manualSaveController({ createRequestId: () => 'conflict',
    api: { create: () => assert.fail('must update'),
      update: async () => { throw error('VERSION_CONFLICT'); },
      list: async () => { listCalls++; return { epoch: 'test-epoch', revision: 2 }; },
      get: async () => ({ epoch: 'test-epoch', revision: 3,
        note: { id: 'manual_1', version: 2, bodyMarkdown: 'changed again' } }) } });
  store.load({ id: 'manual_1', version: 1, bodyMarkdown: 'local' });
  store.edit('my edits');
  await assert.rejects(store.save(meta), { code: 'VERSION_CONFLICT' });
  await assert.rejects(store.inspectConflict(), { code: 'READ_UNAVAILABLE' });
  assert.equal(listCalls, 1);
  assert.equal(store.snapshot().conflictPreview, null);
  assert.equal(store.snapshot().pending.requestId, 'conflict');
  assert.equal(store.snapshot().draft, 'my edits');
  assert.throws(() => store.resolveConflictConfirmed({ epoch: 'test-epoch', revision: 2,
    note: { id: 'manual_1', version: 2 } }), { code: 'VALIDATION_FAILED' });
  store.dispose();
});

test('conflict lookup times out even when transport ignores abort, without stale preview', async () => {
  let signal;
  const store = manualSaveController({ createRequestId: () => 'conflict', timeoutMs: 10,
    api: { create: async () => { throw error('VERSION_CONFLICT'); },
      list: (_filter, currentSignal) => { signal = currentSignal; return new Promise(() => {}); } } });
  store.edit('kept draft');
  await assert.rejects(store.save(meta), { code: 'VERSION_CONFLICT' });
  await assert.rejects(store.inspectConflict(), { code: 'TIMEOUT' });
  assert.equal(signal.aborted, true);
  assert.equal(store.snapshot().draft, 'kept draft');
  assert.equal(store.snapshot().conflictPreview, null);
  store.dispose();
});

test('unknown commit cannot be rebased or blindly retried', async () => {
  const store = manualSaveController({ createRequestId: () => 'unknown',
    api: { create: async () => { throw error('COMMIT_UNKNOWN'); } } });
  store.edit('keep me');
  await assert.rejects(store.save(meta), { code: 'COMMIT_UNKNOWN' });
  await assert.rejects(store.retry(), { code: 'COMMIT_UNKNOWN' });
  assert.throws(() => store.resolveConflictConfirmed(meta), { code: 'PENDING_INTENT' });
  assert.equal(store.snapshot().pending.requestId, 'unknown');
  assert.equal(store.snapshot().draft, 'keep me');
  store.dispose();
});

test('blank draft and invalid metadata reject before transport', async () => {
  const store = manualSaveController({ createRequestId: () => 'safe',
    api: { create: () => assert.fail('no request expected') } });
  await assert.rejects(store.save(meta), { code: 'VALIDATION_FAILED' });
  store.edit('  ');
  await assert.rejects(store.save(meta), { code: 'VALIDATION_FAILED' });
  store.edit('正文');
  await assert.rejects(store.save({ epoch: '', revision: -1 }), { code: 'VALIDATION_FAILED' });
  store.dispose();
});
