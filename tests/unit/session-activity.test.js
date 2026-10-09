import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionActivityCatalog } from '../../src/client/session-activity.js';

test('activity reader uses actual catalog rows and omits retained fallbacks', () => {
  const snapshot = { phase: 'ready', ids: ['s2', 's1'], byId: {
    s1: { id: 's1', updatedAt: 100 }, s2: { id: 's2', updatedAt: 200 },
    retained: { id: 'retained', updatedAt: 900 },
  } };
  const before = structuredClone(snapshot);
  assert.deepEqual(sessionActivityCatalog(snapshot), [
    { sessionId: 's2', updatedAt: 200 }, { sessionId: 's1', updatedAt: 100 }]);
  assert.deepEqual(snapshot, before);
  assert.deepEqual(sessionActivityCatalog({ phase: 'ready', ids: [], byId: {} }), []);
});

test('pending, inconsistent membership and invalid times never become an empty available catalog', () => {
  for (const snapshot of [null, { phase: 'pending', ids: [], byId: {} },
    { phase: 'ready', ids: ['s'], byId: {} },
    { phase: 'ready', ids: ['s', 's'], byId: { s: { id: 's', updatedAt: 1 } } },
    { phase: 'ready', ids: ['s'], byId: { s: { id: 'other', updatedAt: 1 } } },
    { phase: 'ready', ids: ['s'], byId: { s: { id: 's', updatedAt: NaN } } }])
    assert.throws(() => sessionActivityCatalog(snapshot), { code: 'SESSION_ACTIVITY_UNAVAILABLE' });
});
