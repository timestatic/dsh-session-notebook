import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { observe } from '../../diagnostics/desktop-http-observer/index.js';
const apply = ctx => observe(ctx, { record() {}, close: async () => {} });

function fixture({ loggingFails = false } = {}) {
  let listener;
  const disposers = [];
  const logs = [];
  apply({
    logger: () => ({ info: (...args) => { if (loggingFails) throw Error('LOG_FAILED'); logs.push(args); } }),
    effect: setup => disposers.push(setup()),
    on: (name, fn) => {
      assert.equal(name, 'connection/request'); listener = fn;
      disposers.push(() => { listener = null; });
    },
  });
  return { call: (...args) => listener(...args), logs, dispose: () => disposers.reverse().forEach(fn => fn()) };
}
test('saved Cordis dispatch and waterfall deliver the observer with Host argument shape', async () => {
  const source = await readFile(new URL('../../.sdk-reference/cordis/package/lib/index.js', import.meta.url), 'utf8');
  const dispatch = source.match(/\tdispatch\(type, args\) \{[\s\S]*?\n\t\}/)?.[0];
  const waterfall = source.match(/\twaterfall\(\.\.\.args\) \{[\s\S]*?\n\t\}/)?.[0];
  assert.ok(dispatch && waterfall, 'exact SDK methods must be available');
  const make = new Script(`(hooks => ({ _hooks: hooks, emit() {}, ${dispatch}, ${waterfall} }))`)
    .runInContext(createContext({ Context: { filter: Symbol('filter') } }));
  const hooks = {}; const cleanups = []; const logs = [];
  const events = make(hooks);
  apply({
    logger: () => ({ info: (...args) => logs.push(args) }),
    effect: setup => cleanups.push(setup()),
    on: (name, callback) => { hooks[name] = [{ callback, ctx: {} }]; cleanups.push(() => { hooks[name] = []; }); },
  });
  const res = response(); let count = 0;
  assert.equal(await events.waterfall('connection/request', request, res, () => { count++; res.emit('finish'); return 'gateway'; }), 'gateway');
  assert.equal(count, 1); assert.equal(logs.length, 1);
  for (const cleanup of cleanups.reverse()) cleanup();
  await events.waterfall('connection/request', request, response(), () => { count++; });
  assert.equal(count, 2); assert.equal(logs.length, 1);
});

function response() { const value = new EventEmitter(); value.statusCode = 200; return value; }
const request = { method: 'POST', url: '/api/settings/describe',
  get headers() { throw Error('HEADERS_MUST_NOT_BE_READ'); },
  get body() { throw Error('BODY_MUST_NOT_BE_READ'); } };

test('observer delegates once and reports only response completion, not next settlement', async () => {
  const f = fixture(); const res = response(); let delegated = 0;
  assert.equal(await f.call(request, res, async () => { delegated++; return 'unchanged'; }), 'unchanged');
  assert.equal(delegated, 1); assert.equal(f.logs.length, 0);
  res.emit('finish');
  assert.deepEqual(f.logs, [['SETTINGS_HTTP_FINISH count=%d status=%d', 1, 200]]);
  assert.equal(res.listenerCount('finish'), 0); assert.equal(res.listenerCount('close'), 0);
  res.emit('finish'); assert.equal(f.logs.length, 1); f.dispose();
});
test('unknown paths, query variants and methods delegate without adding listeners', async () => {
  const f = fixture();
  for (const req of [{ method: 'GET', url: request.url }, { method: 'POST', url: request.url + '?secret=not-read' }, { method: 'POST', url: '/api/other' }]) {
    const res = response(); let count = 0;
    await f.call(req, res, () => { count++; }); assert.equal(count, 1);
    assert.equal(res.listenerCount('finish'), 0);
  }
  assert.equal(f.logs.length, 0); f.dispose();
});
test('delegate failure propagates identity and removes pending listeners', async () => {
  const f = fixture(); const res = response(); const error = Error('private carrier failure');
  await assert.rejects(f.call(request, res, () => { throw error; }), actual => actual === error);
  assert.equal(res.listenerCount('finish'), 0); assert.equal(res.listenerCount('close'), 0);
  assert.equal(f.logs.length, 0); f.dispose();
});
test('close and unload remove listeners and ignore late response completion across two loads', async () => {
  for (let round = 0; round < 2; round++) {
    const f = fixture(); const closed = response(); const late = response();
    await f.call(request, closed, async () => {}); closed.emit('close');
    assert.equal(closed.listenerCount('finish'), 0);
    await f.call(request, late, async () => {}); f.dispose(); late.emit('finish');
    assert.equal(late.listenerCount('finish'), 0); assert.equal(late.listenerCount('close'), 0);
    assert.equal(f.logs.length, 0);
  }
});
test('bounded pending and completed observations never block unobserved requests', async () => {
  const f = fixture(); const pending = [];
  for (let i = 0; i < 17; i++) {
    const res = response(); pending.push(res); await f.call(request, res, async () => {});
  }
  assert.equal(pending[16].listenerCount('finish'), 0);
  for (const res of pending) res.emit('finish');
  for (let i = 0; i < 20; i++) {
    const res = response(); await f.call(request, res, async () => {}); res.emit('finish');
  }
  assert.equal(f.logs.length, 32); f.dispose();
});
test('near completion cap, overlapping responses cannot reserve more than 32 summaries', async () => {
  const f = fixture();
  for (let i = 0; i < 31; i++) {
    const res = response(); await f.call(request, res, async () => {}); res.emit('finish');
  }
  const last = response(); const extra = response();
  await f.call(request, last, async () => {});
  let delegated = 0;
  await f.call(request, extra, async () => { delegated++; });
  assert.equal(delegated, 1);
  assert.equal(extra.listenerCount('finish'), 0);
  last.emit('finish'); extra.emit('finish');
  assert.equal(f.logs.length, 32); f.dispose();
});

test('logger failure cannot change delegation outcome', async () => {
  const f = fixture({ loggingFails: true }); const res = response();
  assert.equal(await f.call(request, res, async () => { res.emit('finish'); return 42; }), 42);
  assert.equal(res.listenerCount('finish'), 0); f.dispose();
});
