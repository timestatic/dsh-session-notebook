import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { apply } from '../../src/host/index.js';
import { previewApi } from '../../src/client/preview-api.js';

async function fixture(run) {
  const base = resolve('.storage-test-output');
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(join(base, 'json-notebook-'));
  try { await run(join(root, 'notes.json')); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
}
async function boot(file, authorized = true) {
  const routes = new Map(), cleanup = [];
  const gateway = { identity: 'official' };
  routes.set('/api/settings/describe', gateway);
  await apply({ effect(setup) { const stop = setup(); cleanup.push(stop); }, connection: {
    admit: () => authorized ? { peer: { id: 'synthetic-operator' } } : { rejection: 401 },
    rpc: { intercept: () => assert.fail('shared interceptor') },
    fetch: { register(route) {
      assert.equal(routes.has(route.path), false); routes.set(route.path, route);
      return async () => routes.delete(route.path);
    } },
  } }, { storageFile: file });
  const call = async (endpoint, payload = {}) => {
    const response = await routes.get(`/api/dsh-session-notebook/${endpoint}`).fetch(new Request(
      `http://fixture/api/dsh-session-notebook/${endpoint}`, { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'rpc_fixture',
          method: `dsh-session-notebook/${endpoint}`, payload }) }));
    return response;
  };
  const api = previewApi({ rpc: { call: async (channel, endpoint, payload) => {
    assert.equal(channel, '/api');
    const response = await call(endpoint.slice('dsh-session-notebook/'.length), payload);
    assert.equal(response.status, 200);
    return (await response.json()).result;
  } } });
  return { api, call, routes, async close() {
    for (const stop of cleanup.reverse()) await stop();
    assert.equal(routes.size, 1); assert.equal(routes.get('/api/settings/describe'), gateway);
  } };
}
test('production JSON Host saves manual notes and text excerpts, reopens and exports backups', async () => fixture(async file => {
  let host = await boot(file);
  const signal = new AbortController().signal;
  try {
    assert.deepEqual((await (await host.call('health')).json()).result.value,
      { status: 'ok', phase: 1, storageReady: true });
    let version = await host.api.list({}, signal);
    await host.api.create({ requestId: 'manual1', epoch: version.epoch, expectedRevision: version.revision,
      title: '长文 😀', bodyMarkdown: '# 本地记录\n\n**内容**' }, signal);
    version = await host.api.list({}, signal);
    const intent = { requestId: 'excerpt1', epoch: version.epoch, expectedRevision: version.revision,
      kind: 'note', bodyMarkdown: '我的批注', tagIds: [], quote: { format: 'plain_text', content: '原文两字' },
      anchor: { exact: '原文两字', prefix: '前文', suffix: '后文' }, source: { sessionId: 'session-fixture' } };
    const receipt = await host.api.excerpt(intent, signal);
    assert.equal(typeof receipt.noteId, 'string');
    assert.deepEqual(await host.api.excerpt(intent, signal), receipt);
    const anchors = await host.api.anchors({ sessionId: 'session-fixture' }, signal);
    assert.equal(anchors.total, 1); assert.equal(anchors.items[0].anchor.exact, '原文两字');
    const detail = await host.api.notesGet(receipt.noteId, signal);
    assert.equal(detail.note.source.messageId, undefined);
    assert.equal(detail.note.bodyMarkdown, '我的批注');
    await assert.rejects(host.api.excerpt({ ...intent, requestId: 'fake_id',
      source: { ...intent.source, messageId: 'fake' } }, signal), { code: 'VALIDATION_FAILED' });
    await host.close(); host = await boot(file);
    assert.equal((await host.api.library({ scope: 'all' }, signal)).total, 2);
    assert.equal((await host.api.anchors({ sessionId: 'session-fixture' }, signal)).total, 1);
    assert.match((await host.api.backup(signal)).content, /我的批注/);
  } finally { await host.close(); }
}));
test('corrupt metadata keeps production read-only without replacing the original', async () => fixture(async file => {
  const original = Buffer.from('{bad private bytes'); await fs.writeFile(file, original);
  const host = await boot(file);
  try {
    assert.equal((await (await host.call('health')).json()).result.value.storageReady, false);
    assert.equal(host.routes.has('/api/dsh-session-notebook/manual/create'), false);
    assert.deepEqual(await fs.readFile(file), original);
  } finally { await host.close(); }
}));
test('production health and mutation routes enforce admission', async () => fixture(async file => {
  const host = await boot(file, false);
  try {
    assert.equal((await host.call('health')).status, 401);
    assert.equal((await host.call('manual/create')).status, 401);
  } finally { await host.close(); }
}));

test('excerpt with a new tag commits one revision and retries without duplicate tags', async () => fixture(async file => {
  const host = await boot(file); const signal = new AbortController().signal;
  try {
    const version = await host.api.library({ scope: 'all' }, signal);
    const intent = { requestId: 'tagged_excerpt', epoch: version.epoch, expectedRevision: version.revision,
      kind: 'highlight', tagIds: ['builtin_todo'], newTagName: 'Research',
      quote: { format: 'plain_text', content: 'Tagged source' }, anchor: { exact: 'Tagged source' }, source: { sessionId: 'fixture' } };
    const receipt = await host.api.excerpt(intent, signal);
    assert.equal(receipt.revision, version.revision + 1);
    assert.deepEqual(await host.api.excerpt(intent, signal), receipt);
    const detail = await host.api.notesGet(receipt.noteId, signal);
    assert.equal(detail.note.tagIds.length, 2);
    assert.equal((await host.api.tagsList(signal)).items.filter(tag => tag.name === 'Research').length, 1);
  } finally { await host.close(); }
}));
