import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json';
import { DomainFacility, defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { manualRuntime } from '../../src/host/manual-runtime.js';
import { notebookSchema } from '../../src/notebook-schema.js';
import { createInitialSnapshot } from '../../src/initial-snapshot.js';

test('actual Cordis owner unload releases its Domain and routes across two load cycles; persisted note reads back', async (t) => {
  const base = new URL('../../.storage-test-output/', import.meta.url);
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const dir = await fs.mkdtemp(new URL('manual-runtime-', base).pathname);
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const ctx = new Context(); await ctx.plugin(Storage);
  const backend = new JsonStorageBackend(dir);
  const unregister = ctx.storage.backend.register('manual_runtime_test', backend);
  const facility = new DomainFacility(ctx, { backend: 'manual_runtime_test' });
  const spec = defineDomain({ name: 'manual_runtime_test', version: 1, layout: 'single', tables: {},
    global: { schema: notebookSchema, initial: createInitialSnapshot({ epoch: 'runtime-epoch',
      time: '2026-10-06T00:00:00.000Z' }) } });
  const routes = new Map(); let runtime;
  // The real carrier is separately tested: this seam supplies only exact-route
  // registration. Context effects, Domain, backend and disk are actual SDK.
  ctx.provide('connection', { admit: () => ({ peer: { id: 'runtime-operator' } }), fetch: { register: route => {
    assert.equal(routes.has(route.path), false); routes.set(route.path, route);
    return async () => { routes.delete(route.path); };
  } } });
  const plugin = { inject: ['connection'], async apply(owner) {
    const domain = await facility.open(spec);
    runtime = manualRuntime(owner, domain);
  } };
  try {
    for (let cycle = 0; cycle < 2; cycle++) {
      const fork = await ctx.plugin(plugin);
      assert.equal(routes.size, 25);
      assert.equal(routes.has('/api/dsh-session-notebook/library/query'), true);
      assert.equal(routes.has('/api/dsh-session-notebook/markdown/export'), true);
      assert.equal(routes.has('/api/dsh-session-notebook/tags/delete'), true);
      assert.equal(routes.has('/api/dsh-session-notebook/notes/apply'), true);
      assert.equal(routes.has('/api/dsh-session-notebook/notes/convert'), true);
      assert.equal(routes.has('/api/dsh-session-notebook/notes/edit'), true);
      assert.equal(routes.has('/api/dsh-session-notebook/backups/preview'), true);
      const value = runtime.service.list();
      if (cycle === 0) {
        assert.equal(value.items.length, 0);
        await runtime.service.create({ requestId: 'first', epoch: value.epoch,
          expectedRevision: value.revision, title: '重启', bodyMarkdown: '**读回**😀' });
        const current = runtime.service.list();
        const response = await routes.get('/api/dsh-session-notebook/manual/create').fetch(new Request(
          'https://desktop.test/api/dsh-session-notebook/manual/create', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type: 'client-request', rpcId: 'untitled-create',
              method: 'dsh-session-notebook/manual/create', payload: {
                requestId: 'untitled', epoch: current.epoch, expectedRevision: current.revision,
                bodyMarkdown: '无标题测试', tagIds: ['builtin_todo'],
              } }),
          }));
        assert.equal((await response.json()).result.ok, true);
      } else {
        const notes = runtime.service.list().items;
        assert.equal(notes.length, 2);
        assert.ok(notes.some(note => note.title === '重启'));
        const untitled = notes.map(note => runtime.service.get(note.id).note)
          .find(note => note.bodyMarkdown === '无标题测试');
        assert.equal(untitled?.title, undefined);
        assert.deepEqual(untitled?.tagIds, ['builtin_todo']);
        assert.deepEqual(new Set(runtime.service.tagList().items.map(tag => tag.id)),
          new Set(['builtin_todo', 'builtin_important', 'builtin_verify']));
      }
      await fork.dispose();
      assert.equal(routes.size, 0);
      assert.equal(facility.get(spec.name), undefined);
      await assert.rejects(runtime.service.create({ requestId: 'late', epoch: value.epoch,
        expectedRevision: value.revision, bodyMarkdown: 'late' }), { code: 'CLOSED' });
    }
  } finally {
    await facility.closeAll(); unregister(); await backend.close(); await ctx.fiber.dispose();
  }
});
