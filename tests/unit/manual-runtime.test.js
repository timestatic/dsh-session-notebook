import test from 'node:test';
import assert from 'node:assert/strict';
import { manualRuntime } from '../../src/host/manual-runtime.js';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';

function harness(domain, failRouteClose = false) {
  const routes = new Map(), effects = []; let stops = 0;
  const ctx = { effect: setup => { const cleanup = setup(); effects.push(cleanup); return cleanup; },
    connection: { admit: () => ({ peer: {} }), rpc: {
      handle: () => assert.fail('reserved carrier'), intercept: () => assert.fail('shared carrier'),
    }, fetch: { register: route => {
      routes.set(route.path, route);
      return async () => { stops++; routes.delete(route.path); if (failRouteClose) throw Error('private path'); };
    } } } };
  return { runtime: manualRuntime(ctx, domain), routes, effects, stops: () => stops };
}
const intent = { requestId: 'create_1', epoch: 'test-epoch', expectedRevision: 0, bodyMarkdown: '保存😀' };

test('runtime shutdown stops routes immediately, drains accepted mutation before closing only its Domain', async () => {
  let snapshot = notebookFixture(), release, entered, closes = 0;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const domain = { global: { get: () => structuredClone(snapshot), set: async next => {
    entered(); await gate; snapshot = structuredClone(next);
  } }, close: async () => { assert.equal(snapshot.revision, 1); closes++; } };
  const h = harness(domain);
  const retained = h.routes.get('/api/dsh-session-notebook/manual/list');
  const pending = h.runtime.service.create(intent); await started;
  const closing = h.runtime.close();
  assert.equal(h.runtime.close(), closing);
  await assert.rejects(h.runtime.service.create({ ...intent, requestId: 'late' }), { code: 'CLOSED' });
  assert.equal((await retained.fetch(new Request('http://localhost/api/dsh-session-notebook/manual/list'))).status, 404);
  assert.equal(closes, 0);
  release(); await pending; await closing;
  assert.equal(closes, 1); assert.equal(h.routes.size, 0); assert.equal(h.stops(), 25);
  for (const dispose of h.effects.reverse()) await dispose();
  assert.equal(closes, 1); assert.equal(h.stops(), 25);
});

test('route cleanup failure still attempts Domain close and remains a fixed memoized failure', async () => {
  let closes = 0;
  const domain = { global: { get: notebookFixture, set: async () => {} }, close: async () => { closes++; } };
  const h = harness(domain, true);
  const closing = h.runtime.close();
  await assert.rejects(closing, { code: 'CLOSE_FAILED', message: 'CLOSE_FAILED' });
  assert.equal(h.runtime.close(), closing); assert.equal(closes, 1); assert.equal(h.routes.size, 0);
  await Promise.allSettled(h.effects.map(dispose => dispose()));
});

test('Domain close failure never reports successful shutdown or retries releasing it', async () => {
  let closes = 0;
  const domain = { global: { get: notebookFixture, set: async () => {} }, close: async () => {
    closes++; throw Error('secret medium');
  } };
  const h = harness(domain);
  await assert.rejects(h.runtime.close(), { code: 'CLOSE_FAILED', message: 'CLOSE_FAILED' });
  await assert.rejects(h.runtime.close(), { code: 'CLOSE_FAILED' });
  assert.equal(closes, 1);
  await Promise.allSettled(h.effects.map(dispose => dispose()));
});
