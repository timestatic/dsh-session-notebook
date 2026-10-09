import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import { apply } from '../../src/host/index.js';
import { TAG_COLORS } from '../../src/tag-colors.js';

test('locked JSON library leaves Host read-only and never mounts write routes', async t => {
  const base = fileURLToPath(new URL('../../.storage-test-output', import.meta.url));
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(join(base, 'json-locked-cordis-'));
  const sentinel = join(root, '.dsh-session-notebook.lock');
  await fs.writeFile(sentinel, 'other owner', { mode: 0o600 });
  const ctx = new Context(); const routes = new Map();
  ctx.provide('connection', { admit: () => ({ peer: { id: 'cordis-operator' } }),
    fetch: { register(route) {
      routes.set(route.path, route);
      return async () => routes.delete(route.path);
    } } });
  t.after(async () => { try { await ctx.fiber.dispose(); } finally { await fs.rm(root, { recursive: true, force: true }); } });
  const fork = await ctx.plugin({ inject: ['connection'], apply }, { storageFile: join(root, 'notes.json') });
  assert.deepEqual([...routes.keys()].sort(), ['/api/dsh-session-notebook/health', '/api/dsh-session-notebook/list']);
  const request = new Request('http://fixture/api/dsh-session-notebook/health');
  const health = await (await routes.get('/api/dsh-session-notebook/health').fetch(request)).json();
  assert.equal(health.storageReady, false);
  assert.equal(health.diagnostic, 'STORE_OWNED');
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'other owner');
  await fork.dispose();
  assert.equal(routes.size, 0);
});

test('production JSON Host initializes and unloads under actual Cordis Context twice', async t => {
  const base = fileURLToPath(new URL('../../.storage-test-output', import.meta.url)); await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(join(base, 'json-cordis-'));
  const ctx = new Context(); const routes = new Map();
  ctx.provide('connection', { admit: () => ({ peer: { id: 'cordis-operator' } }),
    fetch: { register(route) {
      assert.equal(routes.has(route.path), false); routes.set(route.path, route);
      return async () => routes.delete(route.path);
    } } });
  t.after(async () => { try { await ctx.fiber.dispose(); } finally { await fs.rm(root, { recursive: true, force: true }); } });
  const request = new Request('http://fixture/api/dsh-session-notebook/health');
  const call = async (endpoint, payload, rpcId) => {
    const path = `/api/dsh-session-notebook/${endpoint}`;
    return (await routes.get(path).fetch(new Request(`http://fixture${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId,
        method: `dsh-session-notebook/${endpoint}`, payload }),
    }))).json();
  };
  for (let cycle = 0; cycle < 2; cycle++) {
    const fork = await ctx.plugin({ inject: ['connection'], apply }, { storageFile: join(root, 'notes.json') });
    assert.equal(routes.size, 27, JSON.stringify(await (await routes.get('/api/dsh-session-notebook/health').fetch(request)).json()));
    const old = routes.get('/api/dsh-session-notebook/health');
    assert.equal((await (await old.fetch(request)).json()).storageReady, true);
    const tags = (await call('tags/list', {}, `list-${cycle}`)).result.value;
    if (cycle === 0) {
      const created = await call('tags/create', { requestId: 'colored-create', epoch: tags.epoch,
        expectedRevision: tags.revision, name: '彩色标签', color: TAG_COLORS[5] }, 'create-colored');
      assert.equal(created.result.ok, true, JSON.stringify(created.result));
    } else assert.equal(tags.items.find(tag => tag.name === '彩色标签')?.color, TAG_COLORS[5]);
    await fork.dispose();
    assert.equal(routes.size, 0);
    assert.equal((await old.fetch(request)).status, 404);
  }
});
