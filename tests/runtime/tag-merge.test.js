import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json';
import { DomainFacility, defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { notebookSchema, notebookFixture } from '../fixtures/notebook-snapshot.js';
import { mergeTags } from '../fixtures/merge-tags.js';
import { autoTestRoot } from '../fixtures/auto-test-root.js';

test('complete SDK whole Snapshot tag merge: failed commit leaves all associations/cache/disk unchanged', async () => {
  const dir = await autoTestRoot('tag-merge-');
  const ctx = new Context(); await ctx.plugin(Storage);
  const raw = new JsonStorageBackend(dir); let fail = false;
  // Explicit before-SDK-write failure seam; proves Domain cache behavior, not fsync faults.
  const backend = { close: () => raw.close(), kv: { open: async descriptor => {
    const unit = await raw.kv.open(descriptor);
    return { loadAll: () => unit.loadAll(), close: () => unit.close(), setGlobal: async value => {
      if (fail) throw new Error('TEST_BEFORE_WRITE'); await unit.setGlobal(value);
    } };
  } } };
  const unregister = ctx.storage.backend.register('tag_merge_test', backend);
  const facility = new DomainFacility(ctx, { backend: 'tag_merge_test' });
  const initial = notebookFixture();
  initial.tags.t2 = { ...initial.tags.t1, id: 't2', name: '重要', normalizedKey: '重要' };
  initial.notes.trash = { ...structuredClone(initial.notes.n1), id: 'trash', deletedAt: initial.notes.n1.createdAt };
  initial.notes.n1.tagIds = ['t1', 't2']; initial.settings.quickTagIds = ['t1', 't2'];
  const spec = defineDomain({ name: 'notebook', version: 1, layout: 'single', tables: {}, global: { schema: notebookSchema, initial } });
  try {
    const domain = await facility.open(spec); await domain.global.set(initial);
    const before = await fs.readFile(join(dir, 'notebook.json'), 'utf8');
    const candidate = mergeTags(initial, 't1', 't2', 0);
    fail = true; await assert.rejects(domain.global.set(candidate), /TEST_BEFORE_WRITE/);
    assert.deepEqual(domain.global.get(), initial);
    assert.equal(await fs.readFile(join(dir, 'notebook.json'), 'utf8'), before);
    assert.deepEqual(initial.notes.n1.tagIds, ['t1', 't2']);
    fail = false; await domain.global.set(candidate); await domain.close();
    const reopened = await facility.open(spec); assert.deepEqual(reopened.global.get(), candidate);
    assert.deepEqual(candidate.notes.n1.tagIds, ['t2']); assert.deepEqual(candidate.notes.trash.tagIds, ['t2']);
    assert.deepEqual(candidate.settings.quickTagIds, ['t2']);
    assert.equal(candidate.tags.t1, undefined);
    assert.throws(() => mergeTags(candidate, 't2', 't1', 0), error => error.code === 'REVISION_CONFLICT');
  } finally { await facility.closeAll(); unregister(); await raw.close(); await ctx.fiber.dispose(); }
});
