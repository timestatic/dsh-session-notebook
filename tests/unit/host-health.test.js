import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, inject } from '../../src/host/index.js';

test('connection routes are read-only, reject parameters, honour cancellation and dispose', async () => {
  const routes = new Map();
  const disposers = [];
  assert.deepEqual(inject, ['connection']);
  apply({
    effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose; },
    connection: { rpc: { handle: channel => {
      assert.equal(channel, '/dsh-session-notebook');
      return async () => {};
    }, intercept: () => assert.fail('Notebook must not intercept the shared /api channel') }, fetch: { register: route => {
      assert.deepEqual(route.methods, ['GET', 'POST']);
      assert.equal(route.requestBody, 'buffered');
      assert.equal(routes.has(route.path), false);
      routes.set(route.path, route);
      return async () => { routes.delete(route.path); };
    } } },
  });
  assert.equal(routes.size, 2);
  for (const [path, route] of routes) {
    const response = await route.fetch(new Request(`http://localhost${path}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const result = await response.json();
    assert.equal(result.storageReady, false);
    assert.equal(result.phase, 0);
    if (path.endsWith('/list')) assert.deepEqual(result.items, []);
    else assert.equal(result.status, 'ok');
    const invalid = await route.fetch(new Request(`http://localhost${path}?unknown=value`));
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { code: 'VALIDATION_FAILED' });
    const endpoint = path.slice('/api/'.length);
    const envelope = { type: 'client-request', rpcId: 'fixture-rpc', method: endpoint, payload: {} };
    const post = body => route.fetch(new Request(`http://localhost${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }));
    assert.deepEqual(await (await post(envelope)).json(), {
      type: 'server-response', rpcId: 'fixture-rpc', result: { ok: true, value: result },
    });
    for (const body of [null, [], {}, { ...envelope, method: 'settings/describe' },
      { ...envelope, payload: { unknown: true } }, { ...envelope, payload: [] },
      { ...envelope, type: 'wrong' }, { ...envelope, extra: true }]) {
      assert.equal((await (await post(body)).json()).result.error.code, 'VALIDATION_FAILED');
    }
    assert.equal((await route.fetch(new Request(`http://localhost${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    }))).status, 400);
    assert.equal((await route.fetch(new Request(`http://localhost${path}`, { method: 'POST', body: '{}' }))).status, 415);
    const controller = new AbortController();
    controller.abort();
    const cancelled = await route.fetch(new Request(`http://localhost${path}`, { signal: controller.signal }));
    assert.equal(cancelled.status, 499);
  }
  for (const dispose of disposers.reverse()) await dispose();
  assert.equal(routes.size, 0);
});

test('retained exact handler never succeeds after disposal, including POST paused in body parsing', async () => {
  const routes = new Map();
  const disposers = [];
  apply({
    effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose; },
    connection: { fetch: { register: route => {
      routes.set(route.path, route);
      return async () => { routes.delete(route.path); };
    } } },
  });
  const route = routes.get('/api/dsh-session-notebook/health');
  let release;
  const parsed = new Promise(resolve => { release = resolve; });
  const request = {
    method: 'POST', url: 'http://localhost/api/dsh-session-notebook/health',
    signal: new AbortController().signal,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => parsed,
  };
  const pending = route.fetch(request);
  for (const dispose of disposers.reverse()) await dispose();
  release({ type: 'client-request', rpcId: 'late', method: 'dsh-session-notebook/health', payload: {} });
  assert.equal((await pending).status, 404);
  assert.equal((await route.fetch(new Request(request.url))).status, 404);
  assert.equal(routes.size, 0);
});

test('route is inactive while official async disposer is pending or rejects', async () => {
  const routes = [];
  const disposers = [];
  let failDispose;
  const disposal = new Promise((_resolve, reject) => { failDispose = reject; });
  apply({
    effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose; },
    connection: { fetch: { register: route => {
      routes.push(route);
      return route.path.endsWith('/health') ? () => disposal : async () => {};
    } } },
  });
  const health = routes.find(route => route.path.endsWith('/health'));
  const shutdown = disposers[0]();
  assert.equal((await health.fetch(new Request('http://localhost/api/dsh-session-notebook/health'))).status, 404);
  failDispose(new Error('synthetic release failure'));
  await assert.rejects(shutdown, /synthetic release failure/);
  assert.equal((await health.fetch(new Request('http://localhost/api/dsh-session-notebook/health'))).status, 404);
  await disposers[1]();
});

test('POST cancellation while reading body never returns a successful envelope', async () => {
  const routes = new Map();
  const disposers = [];
  apply({
    effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose; },
    connection: { fetch: { register: route => {
      routes.set(route.path, route);
      return async () => { routes.delete(route.path); };
    } } },
  });
  try {
    for (const reject of [false, true]) {
      const route = routes.get('/api/dsh-session-notebook/health');
      const controller = new AbortController();
      let settle;
      const parsing = new Promise((resolve, fail) => { settle = reject ? fail : resolve; });
      const pending = route.fetch({
        method: 'POST', url: 'http://localhost/api/dsh-session-notebook/health',
        signal: controller.signal,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => parsing,
      });
      controller.abort();
      if (reject) settle(new Error('synthetic aborted body'));
      else settle({ type: 'client-request', rpcId: 'late', method: 'dsh-session-notebook/health', payload: {} });
      const response = await pending;
      assert.equal(response.status, 499);
      assert.deepEqual(await response.json(), { code: 'CANCELLED' });
    }
  } finally { for (const dispose of disposers.reverse()) await dispose(); }
  assert.equal(routes.size, 0);
});

test('POST body parse rejection after unload does not expose a live Notebook route', async () => {
  const routes = new Map();
  const disposers = [];
  apply({
    effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose; },
    connection: { fetch: { register: route => {
      routes.set(route.path, route);
      return async () => { routes.delete(route.path); };
    } } },
  });
  const route = routes.get('/api/dsh-session-notebook/list');
  let rejectBody;
  const parsing = new Promise((_resolve, reject) => { rejectBody = reject; });
  const response = route.fetch({
    method: 'POST', url: 'http://localhost/api/dsh-session-notebook/list',
    signal: new AbortController().signal,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => parsing,
  });
  for (const dispose of disposers.reverse()) await dispose();
  rejectBody(new SyntaxError('malformed late body'));
  assert.equal((await response).status, 404);
  assert.equal(routes.size, 0);
});
