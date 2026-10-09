import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { apply, inject } from '../../src/host/index.js';
import { registerPreviewRoutes } from '../../src/host/preview-routes.js';
import { manualNotebookService } from '../../src/manual-notebook-service.js';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';

async function registrationService(ctx, dependencies = inject) {
  // Narrow model of Cordis caller-scope service access, not a full Cordis runtime.
  const owner = new Proxy(ctx, {
    get(target, key, receiver) {
      if (key === 'webServer' && !dependencies.includes(key)) {
        throw new Error('cannot get property "webServer" without inject');
      }
      return Reflect.get(target, key, receiver);
    },
  });
  const source = await readFile(new URL('../../.sdk-reference/connection/package/lib/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('const CHANNEL_PATTERN =');
  const end = source.indexOf('//#endregion', start);
  assert.ok(start >= 0 && end > start, 'SDK registration region must remain discoverable');
  const region = source.slice(start, end);
  // Use the real registry, dispatch, validators and response encoder. Only the
  // Cordis base, Peer, trust/auth inputs, bridge and envelope schema are test seams.
  const Service = class { constructor(owner) { this.ctx = owner; } };
  const OperatorPeer = class { dispose() {} };
  const Connection = runInNewContext(`${region}\nHostConnectionService`, {
    Service, OperatorPeer, Request, Response, URL, FormData, Blob, Uint8Array,
    isTrustedApiRequest: request => request.trusted === true,
    clientRequestSchema: { safeParse: data => ({ success: true, data }) },
    RpcId: value => value, INVALID_REQUEST_RPC_ID: 'invalid-request',
    bridge: () => assert.fail('Rejected requests must not reach the HTTP bridge'),
  });
  return new Connection(owner, [], { isAuthenticated: request => request.authenticated === true });
}

// Execute the saved SDK's actual validator rather than a permissive mock.
// These explicit boundaries fail closed if the SDK reference changes shape.
async function channelValidator() {
  const source = await readFile(new URL('../../.sdk-reference/connection/package/lib/index.js', import.meta.url), 'utf8');
  const pattern = source.match(/^const CHANNEL_PATTERN = .+;$/m)?.[0];
  const validator = source.match(/^function assertChannel\(channel\) \{\n[^]*?^\}/m)?.[0];
  assert.ok(pattern && validator, 'SDK channel validator extraction must be reviewed after SDK changes');
  return runInNewContext(`${pattern}\n${validator}\nassertChannel`);
}

test('saved SDK rejects reserved and multi-segment channels', async () => {
  const validate = await channelValidator();
  assert.doesNotThrow(() => validate('/dsh-session-notebook'));
  for (const channel of ['/api', '/rpc/dsh-session-notebook', 'notebook', '/notebook/']) {
    assert.throws(() => validate(channel), /invalid or reserved RPC channel/);
  }
});

test('Host registration satisfies saved SDK channel validator and owns only exact Notebook GET/POST routes', async () => {
  const validate = await channelValidator();
  const channels = [];
  const routes = [];
  const disposers = [];
  apply({
    effect: setup => disposers.push(setup()),
    connection: {
      rpc: {
        intercept: () => assert.fail('Official /api interceptor is reserved'),
        handle(channel) {
          validate(channel);
          channels.push(channel);
          return async () => channels.splice(channels.indexOf(channel), 1);
        },
      },
      fetch: { register(route) {
        assert.match(route.path, /^\/api\/dsh-session-notebook\/(health|list)$/);
        assert.deepEqual(route.methods, ['GET', 'POST']);
        routes.push(route);
        return async () => routes.splice(routes.indexOf(route), 1);
      } },
    },
  });
  assert.deepEqual(channels, []);
  assert.equal(routes.length, 2);
  for (const dispose of disposers.reverse()) await dispose();
  assert.equal(channels.length, 0);
  assert.equal(routes.length, 0);
});

test('saved SDK admission rejects before exact Notebook routes are dispatched', async () => {
  const cleanups = [];
  const owner = {
    effect(setup) { const dispose = setup(); cleanups.push(dispose); return dispose; },
    webServer: { register: () => assert.fail('No physical route added by Notebook') },
  };
  const connection = await registrationService(owner);
  const shared = connection.createSharedFetchHandler('/api');
  await apply({ connection, effect: setup => cleanups.push(setup()) }, { storageFile: null });
  const visit = async (trusted, authenticated) => {
    const request = new Request('http://localhost/api/dsh-session-notebook/health');
    request.trusted = trusted; request.authenticated = authenticated;
    // Mirrors saved connection.apply's admission-before-bridge ordering; trust/auth are explicit test seams.
    const admission = connection.admit(request);
    if ('rejection' in admission) return new Response('', { status: admission.rejection });
    return shared.fetch(request);
  };
  try {
    assert.equal((await visit(false, true)).status, 403);
    assert.equal((await visit(true, false)).status, 401);
    const accepted = await visit(true, true);
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).storageReady, false);
  } finally { for (const dispose of cleanups.reverse()) await dispose(); }
});

test('SDK private channel fails before route registration without caller webServer injection', async () => {
  let registrations = 0;
  const ctx = {
    effect: setup => setup(),
    webServer: { register: () => { registrations++; return () => {}; } },
  };
  const missing = await registrationService(ctx, ['connection']);
  assert.throws(() => missing.rpc.handle('/dsh-session-notebook', async () => ({ ok: true })),
    /cannot get property "webServer" without inject/);
  assert.equal(registrations, 0);
  const declared = await registrationService(ctx, ['connection', 'webServer']);
  const dispose = declared.rpc.handle('/dsh-session-notebook', async () => ({ ok: true }));
  assert.equal(registrations, 1);
  await dispose();
});

for (const gatewayFirst of [true, false]) {
  test(`SDK registry preserves Gateway across reloads (Gateway first: ${gatewayFirst})`, async () => {
    const webRoutes = new Map();
    const cleanups = [];
    const owner = {
      effect(setup) {
        const cleanup = setup();
        let disposed = false;
        const once = async () => { if (!disposed) { disposed = true; await cleanup(); } };
        cleanups.push(once);
        return once;
      },
      webServer: { register(route) {
        assert.equal(webRoutes.has(route.path), false);
        webRoutes.set(route.path, route);
        return () => webRoutes.delete(route.path);
      } },
    };
    const connection = await registrationService(owner);
    const shared = connection.createSharedFetchHandler('/api');
    const service = manualNotebookService({ domain: { global: { get: notebookFixture,
      set: () => assert.fail('read-only query must not write') } } });
    const gatewayHandler = async () => ({ ok: true, value: { settings: [] } });
    let gateway;
    const addGateway = () => {
      connection.rpc.intercept('/api', endpoint => endpoint === 'settings/describe', gatewayHandler);
      gateway = connection.interceptors.get('/api');
    };
    const post = () => new Request('http://localhost/api/settings/describe', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'test', method: 'settings/describe', payload: {} }),
    });
    if (gatewayFirst) addGateway();
    for (let cycle = 0; cycle < 2; cycle++) {
      const pluginCleanups = [];
      await apply({ connection, effect: setup => pluginCleanups.push(setup()) }, { storageFile: null });
      registerPreviewRoutes({ connection, effect: setup => pluginCleanups.push(setup()) }, service);
      if (!gateway) addGateway();
      assert.equal(connection.interceptors.get('/api'), gateway);
      const settings = await shared.fetch(post());
      assert.equal(settings.status, 200);
      assert.equal((await settings.json()).result.ok, true);
      for (const endpoint of ['health', 'list']) {
        const notebookRequest = new Request(`http://localhost/api/dsh-session-notebook/${endpoint}`);
        notebookRequest.trusted = true; notebookRequest.authenticated = true;
        const response = await shared.fetch(notebookRequest);
        assert.equal(response.status, 200);
        assert.equal((await response.json()).storageReady, false);
      }
      const libraryMethod = 'dsh-session-notebook/library/query';
      const libraryRequest = new Request(`http://localhost/api/${libraryMethod}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'library-test',
          method: libraryMethod, payload: { scope: 'session', sessionId: 'synthetic' } }),
      });
      libraryRequest.trusted = true; libraryRequest.authenticated = true;
      const libraryResponse = await shared.fetch(libraryRequest);
      assert.equal(libraryResponse.status, 200);
      assert.deepEqual((await libraryResponse.json()).result.value.ids, ['n1']);
      const tagsMethod = 'dsh-session-notebook/tags/list';
      const tagsRequest = new Request(`http://localhost/api/${tagsMethod}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'tags-test', method: tagsMethod, payload: {} }),
      });
      tagsRequest.trusted = true; tagsRequest.authenticated = true;
      assert.deepEqual((await (await shared.fetch(tagsRequest)).json()).result.value.items.map(tag => tag.id), ['t1']);
      const markdownMethod = 'dsh-session-notebook/markdown/export';
      const markdownRequest = new Request(`http://localhost/api/${markdownMethod}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'markdown-test', method: markdownMethod,
          payload: { epoch: 'test-epoch', expectedRevision: 0, ids: ['n1'] } }),
      });
      markdownRequest.trusted = true; markdownRequest.authenticated = true;
      assert.match((await (await shared.fetch(markdownRequest)).json()).result.value.content, /引用😀/);
      const notesMethod = 'dsh-session-notebook/notes/preview';
      const notesRequest = new Request(`http://localhost/api/${notesMethod}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'notes-test', method: notesMethod,
          payload: { action: 'trash', ids: ['n1'] } }),
      });
      notesRequest.trusted = true; notesRequest.authenticated = true;
      assert.equal((await (await shared.fetch(notesRequest)).json()).result.value.count, 1);
      const getMethod = 'dsh-session-notebook/notes/get';
      const getRequest = new Request(`http://localhost/api/${getMethod}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'note-get-test', method: getMethod,
          payload: { id: 'n1' } }),
      });
      getRequest.trusted = true; getRequest.authenticated = true;
      assert.equal((await (await shared.fetch(getRequest)).json()).result.value.note.id, 'n1');
      assert.equal(webRoutes.size, 0);
      for (const endpoint of ['health', 'list']) {
        const method = `dsh-session-notebook/${endpoint}`;
        const request = new Request(`http://localhost/api/${method}`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'client-request', rpcId: 'notebook-test', method, payload: {} }),
        });
        request.trusted = true; request.authenticated = true;
        const response = await shared.fetch(request);
        assert.equal(response.status, 200);
        const envelope = await response.json();
        assert.equal(envelope.rpcId, 'notebook-test');
        assert.equal(envelope.result.ok, true);
      }
      for (const cleanup of pluginCleanups.reverse()) await cleanup();
      assert.equal(webRoutes.size, 0);
      assert.equal(connection.fetchRoutes.size, 0);
      assert.equal(connection.interceptors.get('/api'), gateway);
      assert.equal((await shared.fetch(post())).status, 200);
      assert.equal((await shared.fetch(new Request('http://localhost/api/dsh-session-notebook/health'))).status, 404);
      assert.equal((await shared.fetch(new Request('http://localhost/api/dsh-session-notebook/library/query'))).status, 404);
      assert.equal((await shared.fetch(new Request('http://localhost/api/dsh-session-notebook/tags/list'))).status, 404);
      assert.equal((await shared.fetch(new Request('http://localhost/api/dsh-session-notebook/notes/preview'))).status, 404);
      assert.equal((await shared.fetch(new Request('http://localhost/api/dsh-session-notebook/notes/get'))).status, 404);
      assert.equal((await shared.fetch(new Request('http://localhost/api/dsh-session-notebook/notes/edit'))).status, 404);
    }
    await service.close();
    for (const cleanup of cleanups.reverse()) await cleanup();
    assert.equal(connection.interceptors.size, 0);
  });
}
