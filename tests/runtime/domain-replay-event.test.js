import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { DomainFacility, defineDomain } from '@deepseek-ai/dsh-storage-domain';

// Negative design test: a KvUnit that resolves for an idempotent replay tells the
// real Domain it performed a new write. This is NOT a SQLite/production backend.
test('real Domain emits a duplicate changed event if backend resolves a replayed setGlobal', async () => {
  const ctx = new Context(); await ctx.plugin(Storage);
  const events = [];
  ctx.on('domain/changed', change => events.push(change));
  const durable = { revision: 1, body: 'new' };
  let replays = 0;
  const unit = {
    loadAll: async () => ({ tables: {}, global: structuredClone(durable) }),
    async setGlobal(value) {
      if (value.revision !== durable.revision || value.body !== durable.body) throw new Error('TEST_MISMATCH');
      // Existing receipt: no new medium mutation, but the KvUnit contract returns void.
      replays++;
    },
    close: async () => {},
  };
  const backend = { kv: { open: async () => unit }, close: async () => {} };
  const unregister = ctx.storage.backend.register('replay_stub', backend);
  const facility = new DomainFacility(ctx, { backend: 'replay_stub' });
  const spec = defineDomain({ name: 'replay_probe', version: 1, layout: 'single', tables: {},
    global: { schema: {
      safeParse(value) { return { success: value?.revision === 1 && typeof value.body === 'string', data: value }; },
      parse(value) { if (value?.revision !== 1 || typeof value.body !== 'string') throw new Error('TEST_SCHEMA'); return value; },
    }, initial: { revision: 1, body: 'new' } } });
  try {
    const domain = await facility.open(spec);
    await domain.global.set({ revision: 1, body: 'new' });
    assert.deepEqual(domain.global.get(), { revision: 1, body: 'new' });
    assert.deepEqual(durable, { revision: 1, body: 'new' });
    assert.equal(replays, 1);
    assert.equal(events.length, 1, 'the real Domain emits even though the backend performed only a replay');
    await domain.close();
  } finally { await facility.closeAll(); unregister(); await ctx.fiber.dispose(); }
});
