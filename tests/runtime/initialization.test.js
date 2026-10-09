import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json';
import { DomainFacility, defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { snapshotBackend } from '../fixtures/snapshot-backend.js';
import { notebookSchema, notebookFixture } from '../fixtures/notebook-snapshot.js';
import { autoTestRoot } from '../fixtures/auto-test-root.js';
async function setup() {
  const dir = await autoTestRoot('init-');
  const ctx = new Context(); await ctx.plugin(Storage); const raw = new JsonStorageBackend(dir);
  const backend = snapshotBackend(dir, descriptor => raw.kv.open(descriptor), notebookSchema);
  const unregister = ctx.storage.backend.register('init_test', backend);
  const facility = new DomainFacility(ctx, { backend: 'init_test' });
  const spec = defineDomain({ name: 'notebook', version: 1, layout: 'single', tables: {}, global: { schema: notebookSchema, initial: notebookFixture() } });
  return { dir, facility, spec, backend, cleanup: async () => { await facility.closeAll(); unregister(); await raw.close(); await ctx.fiber.dispose(); } };
}
test('explicitly absent medium initializes once; removed builtin tag never resurrects on reopen', async () => {
  const h = await setup();
  try {
    let domain = await h.facility.open(h.spec); const value = structuredClone(domain.global.get());
    assert.equal(value.tags.t1.isBuiltin, true);
    await assert.rejects(fs.stat(join(h.dir, 'notebook.json')), error => error.code === 'ENOENT');
    // Domain initial is memory-only: caller must commit before claiming durable setup.
    await domain.global.set(value); await domain.close();
    domain = await h.facility.open(h.spec);
    assert.deepEqual(domain.global.get(), value);
    assert.equal(JSON.parse(await fs.readFile(join(h.dir, 'notebook.json'), 'utf8')).global.tags.t1.isBuiltin, true);
    // Test-only deletion candidate also clears all associations/settings atomically.
    value.notes.n1.tagIds = []; value.settings.quickTagIds = []; delete value.tags.t1; value.revision++;
    await domain.global.set(value); await domain.close();
    const reopened = await h.facility.open(h.spec);
    assert.deepEqual(reopened.global.get(), value); assert.deepEqual(reopened.global.get().tags, {});
    await reopened.close(); await h.backend.close();
  } finally { await h.cleanup(); }
});
for (const globalFields of [{ global: null }, {}]) test(`existing ${'global' in globalFields ? 'null' : 'missing'} global is protected, never initialized`, async () => {
  const h = await setup(); const original = JSON.stringify({ unit: { name: 'notebook', version: 1 }, ...globalFields, tables: {} });
  try {
    await fs.writeFile(join(h.dir, 'notebook.json'), original);
    await assert.rejects(h.facility.open(h.spec), error => error.code === 'MEDIUM_PROTECTED');
    assert.equal(await fs.readFile(join(h.dir, 'notebook.json'), 'utf8'), original);
    assert.equal(h.facility.get('notebook'), undefined);
    await assert.rejects(h.backend.close(), AggregateError);
    assert.equal((await fs.readdir(h.dir)).includes('notebook.writer.lock'), true);
  } finally { await h.cleanup(); }
});
