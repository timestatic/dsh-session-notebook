import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import * as NotebookHost from '../../src/host/index.js';

// Actual Cordis fiber lifecycle with a narrow, owned Connection Fetch stand-in.
// This is not Desktop admission, HTTP dispatch or an internal Host listener inventory.
test('Notebook Host owns only its two routes across real Cordis fiber disposal', async () => {
  const root = new Context();
  const officialRoute = { path: '/api/settings/describe', owner: 'gateway' };
  const routes = new Map([[officialRoute.path, officialRoute]]);
  const registrations = new Map();
  const releases = new Map();
  const connection = {
    fetch: { register(route) {
      assert.match(route.path, /^\/api\/dsh-session-notebook\/(?:health|list)$/);
      assert.equal(routes.has(route.path), false, `duplicate route ${route.path}`);
      routes.set(route.path, route);
      registrations.set(route.path, (registrations.get(route.path) ?? 0) + 1);
      let disposed = false;
      return async () => {
        assert.equal(disposed, false, `duplicate disposal ${route.path}`);
        disposed = true;
        assert.equal(routes.get(route.path), route);
        routes.delete(route.path);
        releases.set(route.path, (releases.get(route.path) ?? 0) + 1);
      };
    } },
    rpc: { handle: () => assert.fail('reserved RPC registration'),
      intercept: () => assert.fail('shared /api interceptor is owned by Gateway') },
  };
  root.provide('connection', connection);
  try {
    for (let cycle = 1; cycle <= 2; cycle++) {
      const fiber = await root.plugin(NotebookHost);
      assert.equal(routes.size, 3);
      assert.equal(routes.get(officialRoute.path), officialRoute);
      for (const endpoint of ['health', 'list']) {
        const path = `/api/dsh-session-notebook/${endpoint}`;
        assert.equal(registrations.get(path), cycle);
        assert.equal(releases.get(path) ?? 0, cycle - 1);
      }
      await fiber.dispose();
      assert.equal(routes.size, 1);
      assert.equal(routes.get(officialRoute.path), officialRoute);
      for (const endpoint of ['health', 'list']) {
        assert.equal(releases.get(`/api/dsh-session-notebook/${endpoint}`), cycle);
      }
    }
  } finally { await root.fiber.dispose(); }
});

test('failed second route registration releases first without touching Gateway', async () => {
  const root = new Context();
  const gateway = { path: '/api/settings/describe' };
  const routes = new Map([[gateway.path, gateway]]);
  let releases = 0;
  root.provide('connection', { fetch: { register(route) {
    if (route.path.endsWith('/list')) throw new Error('synthetic second registration failure');
    routes.set(route.path, route);
    return async () => { releases++; routes.delete(route.path); };
  } } });
  try {
    await assert.rejects(async () => { await root.plugin(NotebookHost); }, /synthetic second registration failure/);
    assert.equal(routes.size, 1);
    assert.equal(routes.get(gateway.path), gateway);
    assert.equal(releases, 1);
  } finally { await root.fiber.dispose(); }
});
