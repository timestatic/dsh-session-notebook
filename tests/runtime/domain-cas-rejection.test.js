import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { DomainFacility, defineDomain } from '@deepseek-ai/dsh-storage-domain';

// Test-only conditional KvUnit stub: tests the actual Domain runtime's cache/event
// behavior. This is NOT an installed backend or SQLite persistence proof.
test('real Domain leaves cache and event unchanged when conditional backend rejects a stale write', async () => {
  const ctx = new Context(); await ctx.plugin(Storage);
  const events = [];
  ctx.on('domain/changed', change => { events.push(change); });
  const medium = { revision: 0, body: 'initial' };
  const error = () => Object.assign(new Error('GENERATION_CONFLICT'), { code: 'GENERATION_CONFLICT' });
  const unit = {
    loadAll: async () => ({ tables: {}, global: structuredClone(medium) }),
    async setGlobal(value) {
      if (value.revision !== medium.revision + 1) throw error();
      medium.revision = value.revision; medium.body = value.body;
    },
    close: async () => {},
  };
  const backend = { kv: { open: async () => unit }, close: async () => {} };
  const unregister = ctx.storage.backend.register('cas_stub', backend);
  const facility = new DomainFacility(ctx, { backend: 'cas_stub' });
  const spec = defineDomain({ name: 'cas_probe', version: 1, layout: 'single', tables: {},
    global: { schema: {
      safeParse(value) { try { return { success: true, data: this.parse(value) }; } catch { return { success: false }; } },
      parse(value) { if (!value || !Number.isSafeInteger(value.revision) || typeof value.body !== 'string') throw error(); return structuredClone(value); },
    }, initial: { revision: 0, body: 'initial' } } });
  try {
    const domain = await facility.open(spec);
    // Another process commits after this Domain cached revision 0.
    medium.revision = 1; medium.body = 'other';
    await assert.rejects(domain.global.set({ revision: 1, body: 'stale' }), cause => cause.code === 'GENERATION_CONFLICT');
    assert.deepEqual(domain.global.get(), { revision: 0, body: 'initial' });
    assert.deepEqual(medium, { revision: 1, body: 'other' });
    assert.equal(events.length, 0);
    // The same Domain cannot safely make an arbitrary next write: reopen/refresh protocol is required.
    await assert.rejects(domain.global.set({ revision: 1, body: 'again' }), cause => cause.code === 'GENERATION_CONFLICT');
    assert.equal(events.length, 0);
    await domain.close();
    const reopened = await facility.open(spec);
    assert.deepEqual(reopened.global.get(), { revision: 1, body: 'other' });
    await reopened.global.set({ revision: 2, body: 'owned' });
    assert.deepEqual(medium, { revision: 2, body: 'owned' });
    assert.equal(events.length, 1);
    await reopened.close();
  } finally { await facility.closeAll(); unregister(); await ctx.fiber.dispose(); }
});
