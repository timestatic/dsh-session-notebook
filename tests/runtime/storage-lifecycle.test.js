import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { Context } from '@deepseek-ai/cordis';
import Storage, { storageBackendServiceKey } from '@deepseek-ai/dsh-storage';
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json';
import { DomainFacility, defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { snapshotBackend } from '../fixtures/snapshot-backend.js';
import { notebookSchema, notebookFixture } from '../fixtures/notebook-snapshot.js';
import { autoTestRoot } from '../fixtures/auto-test-root.js';

test('dedicated backend coexists with official json name and never mounts default domain form', async () => {
  const root = new Context(); await root.plugin(Storage);
  const official = { close: async () => {} };
  const unregisterOfficial = root.storage.backend.register('json', official);
  try {
    for (let cycle = 0; cycle < 2; cycle++) {
      const dedicated = { close: async () => {} };
      const unregister = root.storage.backend.register('notebook_test', dedicated);
      assert.equal(root.storage.backend.get('json'), official);
      assert.equal(root.storage.backend.get('notebook_test'), dedicated);
      assert.equal(root.get('storageDomain'), undefined);
      assert.throws(() => root.storage.backend.register('json', dedicated), error => error.code === 'duplicate-backend');
      unregister();
      assert.equal(root.storage.backend.get('json'), official);
      assert.deepEqual(root.storage.backend.names(), ['json']);
    }
  } finally { unregisterOfficial(); await root.fiber.dispose(); }
});

test('complete Cordis Context: independent backend, injected Domain, two lifecycle rounds', async () => {
  const rootDir = await autoTestRoot('cordis-');
  const root = new Context(); await root.plugin(Storage);
  const key = storageBackendServiceKey('notebook_test');
  const spec = defineDomain({ name: 'notebook', version: 1, layout: 'single', tables: {},
    global: { schema: notebookSchema, initial: notebookFixture() } });
  let cleanup = 0;
  try {
    for (let round = 0; round < 2; round++) {
      let facility;
      let resumeWrite; let enteredWrite;
      const paused = new Promise(resolve => { enteredWrite = resolve; });
      const resume = new Promise(resolve => { resumeWrite = resolve; });
      const plugin = Object.assign(ctx => {
        const raw = new JsonStorageBackend(rootDir);
        const backend = snapshotBackend(rootDir, async descriptor => {
          const unit = await raw.kv.open(descriptor);
          return { ...unit, loadAll: () => unit.loadAll(), close: () => unit.close(),
            setGlobal: async value => {
              if (round === 0) { enteredWrite(); await resume; }
              await unit.setGlobal(value);
            } };
        }, notebookSchema);
        ctx.effect(() => {
          const unregister = ctx.storage.backend.register('notebook_test', backend);
          return async () => {
            unregister();
            try { await backend.close(); } finally { await raw.close(); }
            cleanup++;
          };
        });
        ctx.provide(key, backend);
        const injected = ctx.inject([key, 'storage'], domainCtx => {
          facility = new DomainFacility(domainCtx, { backend: 'notebook_test' });
          domainCtx.effect(() => async () => { await facility.closeAll(); });
        });
        return Promise.resolve(injected).then(() => {});
      }, { inject: ['storage'] });
      const fiber = await root.plugin(plugin);
      assert.ok(facility, 'real inject must activate');
      assert.deepEqual(root.storage.backend.names(), ['notebook_test']);
      const domain = await facility.open(spec);
      const value = notebookFixture(); value.revision = 1;
      if (round === 0) {
        const writing = domain.global.set(value); await paused;
        let disposed = false;
        const disposing = fiber.dispose().then(() => { disposed = true; });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(disposed, false, 'unload must await pending commit');
        assert.equal((await fs.readdir(rootDir)).includes('notebook.writer.lock'), true);
        resumeWrite(); await writing; await disposing;
      } else {
        assert.deepEqual(domain.global.get(), value);
        await fiber.dispose();
      }
      assert.deepEqual(root.storage.backend.names(), []);
      assert.equal(root.get(key), undefined);
      assert.equal((await fs.readdir(rootDir)).includes('notebook.writer.lock'), false);
    }
    assert.equal(cleanup, 2);
  } finally { await root.fiber.dispose(); }
});
