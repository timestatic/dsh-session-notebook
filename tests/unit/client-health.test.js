import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { apply as applyHost } from '../../src/host/index.js';

async function harness(fetcher, rpcCall) {
  let definition;
  const timers = new Set();
  new Script(await readFile(new URL('../../src/client/index.js', import.meta.url), 'utf8'))
    .runInContext(createContext({
      window: { __ModuleLoader__: { load: value => { definition = value; } } },
      fetch: fetcher, AbortController,
      setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn),
    }));
  const views = new Map();
  const effects = [];
  const states = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useEffect: fn => effects.push(fn),
    useState: initial => [initial, value => states.push(value)],
  };
  definition.factory(() => React).apply({
    get: key => key === 'sidebarRightTabs' ? { register: () => () => {} } : { openTab() {} },
    effect: setup => setup(),
    connection: { rpc: { call: rpcCall ?? (async (channel, endpoint, payload, signal) => {
      assert.equal(channel, '/api');
      const response = await fetcher(`/api/${endpoint}`, { signal, credentials: 'same-origin',
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'test', method: endpoint, payload }) });
      return response.ok ? { ok: true, value: await response.json() } : { ok: false, error: { code: 'TEST_FAILURE' } };
    }) } },
    locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({ revision: 1 }) },
    slots: {
      inject: (_key, setup) => setup(),
      register: (opts, view) => { views.set(opts.key ?? opts.id, view); return () => {}; },
    },
  });
  const panel = views.get('dsh-session-notebook')({ sessionId: 'fixture', useTabInfo: () => ({}) });
  const status = panel.children.at(-1).type;
  const mountStatus = () => { status(); return effects.shift()(); };
  const cleanup = mountStatus();
  const versionLabel = () => panel.children.find(child => child.type?.name === 'VersionLabel').type();
  return { states, timers, cleanup, mountStatus, versionLabel };
}

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('client and actual Host handlers complete an in-process round trip', async () => {
  const routes = new Map();
  const disposers = [];
  applyHost({
    effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose; },
    connection: { rpc: { handle: channel => {
      assert.equal(channel, '/dsh-session-notebook');
      return async () => {};
    }, intercept: () => assert.fail('Shared API interceptor must remain untouched') }, fetch: { register: route => {
      routes.set(route.path, route);
      return async () => routes.delete(route.path);
    } } },
  });
  const calls = [];
  const h = await harness(async (path, options) => {
    calls.push(path);
    const response = await routes.get(path).fetch(new Request(`http://localhost${path}`, options));
    return { ok: response.ok, json: async () => (await response.json()).result.value };
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.states.at(-1), 'connected');
  assert.deepEqual(calls, ['/api/dsh-session-notebook/health', '/api/dsh-session-notebook/list']);
  h.cleanup();
  for (const dispose of disposers.reverse()) await dispose();
  assert.equal(routes.size, 0);
});

test('unknown RPC error text and codes never leak into diagnostics', async () => {
  const h = await harness(null, async () => ({ ok: false, error: {
    code: 'private-token-example', message: 'sensitive-server-message',
  } }));
  await flush();
  assert.equal(h.states.at(-1), 'failed');
  assert.equal(h.states.includes('RPC_FAILED'), true);
  assert.equal(h.states.includes('private-token-example'), false);
  assert.equal(h.states.includes('sensitive-server-message'), false);
  h.cleanup();
});

test('transport throws null safely and gets a fixed diagnostic', async () => {
  const h = await harness(null, async () => { throw null; });
  await flush();
  assert.equal(h.states.at(-1), 'failed');
  assert.equal(h.states.includes('TRANSPORT_FAILED'), true);
  h.cleanup();
});

test('known cancellation result is distinguished from transport failure', async () => {
  const h = await harness(null, async () => ({ ok: false, error: { code: 'gateway/cancelled' } }));
  await flush();
  assert.equal(h.states.includes('RPC:gateway/cancelled'), true);
  h.cleanup();
});

test('HTTP 401 becomes failed without requesting a list', async () => {
  let calls = 0;
  const h = await harness(async () => { calls++; return { ok: false, status: 401 }; });
  await flush();
  assert.equal(h.states.at(-1), 'failed');
  assert.equal(calls, 1);
  h.cleanup();
});

test('invalid list response is not reported as connected', async () => {
  const h = await harness(async path => ({ ok: true, json: async () => path.endsWith('health')
    ? { status: 'ok', phase: 0, storageReady: false }
    : { items: ['unexpected'], phase: 0, storageReady: false } }));
  await flush();
  assert.equal(h.states.at(-1), 'failed');
  h.cleanup();
});

test('timeout aborts pending transport and reports failure once', async () => {
  let signal;
  const h = await harness((_path, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  });
  for (const timer of h.timers) timer();
  await flush();
  assert.equal(signal.aborted, true);
  assert.equal(h.states.at(-1), 'failed');
  assert.equal(h.states.filter(state => state === 'failed').length, 1);
  assert.equal(h.timers.size, 0);
  h.cleanup();
});

test('a remounted health timeout revokes shared storage readiness from an earlier success', async () => {
  let responsive = true;
  const h = await harness(null, async (_channel, endpoint) => {
    if (!responsive) return new Promise(() => {});
    return { ok: true, value: endpoint.endsWith('/health')
      ? { status: 'ok', phase: 1, storageReady: true }
      : { epoch: 'e', revision: 0, total: 0, ids: [], items: [] } };
  });
  await flush();
  assert.equal(h.states.at(-1), 'ready');
  assert.match(h.versionLabel().children[0], /^v\d+\.\d+\.\d+$/);
  h.cleanup();
  responsive = false;
  const cleanup = h.mountStatus();
  try {
    for (const timer of [...h.timers]) timer();
    await flush();
    assert.equal(h.states.at(-1), 'failed');
    assert.equal(h.states.includes('TIMEOUT'), true);
    assert.match(h.versionLabel().children[0], /^v\d+\.\d+\.\d+$/);
  } finally { cleanup(); }
});

test('client health validates both results and reports connected', async () => {
  const calls = [];
  const h = await harness(async (path, options) => {
    calls.push(path);
    assert.equal(options.credentials, 'same-origin');
    return { ok: true, json: async () => path.endsWith('health')
      ? { status: 'ok', phase: 0, storageReady: false }
      : { items: [], phase: 0, storageReady: false } };
  });
  await flush();
  assert.equal(h.states.at(-1), 'connected');
  assert.equal(calls.length, 2);
  assert.equal(h.timers.size, 0);
  h.cleanup();
});

test('client rejects malformed success instead of treating it as an empty library', async () => {
  const h = await harness(async () => ({ ok: true, json: async () => ({ status: 'ok' }) }));
  await flush();
  assert.equal(h.states.at(-1), 'failed');
  h.cleanup();
});

test('unmount aborts pending request and prevents late state updates', async () => {
  let signal;
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const h = await harness((_path, options) => { signal = options.signal; return pending; });
  h.cleanup();
  assert.equal(signal.aborted, true);
  const before = h.states.length;
  resolve({ ok: false });
  await flush();
  assert.equal(h.states.length, before);
  assert.equal(h.timers.size, 0);
});
