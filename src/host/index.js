import { homedir } from 'node:os';
import { join } from 'node:path';
import { openJsonStore } from './json-store.js';
import { manualRuntime } from './manual-runtime.js';

export const inject = ['connection'];

// Cordis must invoke this callback, not construct it and lose its async initialization.
export const apply = (ctx, config = {}) => {
  let runtime = null, alive = true, storageDiagnostic = null;
  // Exact routes are dispatched before the official shared RPC interceptor.
  // Never install a second /api interceptor or a new physical carrier.
  for (const endpoint of ['health', 'list']) {
    const fallback = endpoint === 'health'
      ? { status: 'ok', phase: 0, storageReady: false }
      : { items: [], phase: 0, storageReady: false };
    ctx.effect(() => {
      let active = true;
      const dispose = ctx.connection.fetch.register({
      path: `/api/dsh-session-notebook/${endpoint}`, methods: ['GET', 'POST'], requestBody: 'buffered',
      fetch: async request => {
        const headers = { 'Cache-Control': 'no-store' };
        // A request already handed the handler must not report success after unload.
        if (!active) return new Response('not found', { status: 404, headers });
        if (request.signal.aborted) return Response.json({ code: 'CANCELLED' }, { status: 499, headers });
        if ([...new URL(request.url).searchParams].length) {
          return Response.json({ code: 'VALIDATION_FAILED' }, { status: 400, headers });
        }
        if (typeof ctx.connection.admit === 'function') {
          let admitted;
          try { admitted = ctx.connection.admit(request); } catch { /* fail closed */ }
          if (!admitted || !Object.hasOwn(admitted, 'peer'))
            return new Response('unauthorized', { status: admitted?.rejection === 403 ? 403 : 401, headers });
        }
        const value = endpoint === 'health' && runtime
          ? await runtime.service.refresh().then(() => {
            runtime.service.list(); return { status: 'ok', phase: 1, storageReady: true };
          }).catch(() => ({ ...fallback, diagnostic: 'READ_UNAVAILABLE' }))
          : endpoint === 'health' && storageDiagnostic ? { ...fallback, diagnostic: storageDiagnostic } : fallback;
        if (request.method === 'GET') return Response.json(value, { headers });
        if (request.method !== 'POST') return new Response('not found', { status: 404, headers });
        if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
          return new Response('content type must be application/json', { status: 415, headers });
        }
        let body;
        try { body = await request.json(); }
        catch {
          if (!active) return new Response('not found', { status: 404, headers });
          if (request.signal.aborted) return Response.json({ code: 'CANCELLED' }, { status: 499, headers });
          return new Response('body is not JSON', { status: 400, headers });
        }
        if (!active) return new Response('not found', { status: 404, headers });
        if (request.signal.aborted) return Response.json({ code: 'CANCELLED' }, { status: 499, headers });
        const valid = body && typeof body === 'object' && !Array.isArray(body)
          && body.type === 'client-request' && typeof body.rpcId === 'string' && body.rpcId.length > 0
          && body.method === `dsh-session-notebook/${endpoint}`
          && Object.keys(body).every(key => ['type', 'rpcId', 'method', 'payload'].includes(key))
          && body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
          && Object.keys(body.payload).length === 0;
        const result = valid ? { ok: true, value } : { ok: false, error: {
          code: 'VALIDATION_FAILED', message: 'Invalid notebook RPC request', details: {},
        } };
        return Response.json({ type: 'server-response',
          rpcId: typeof body?.rpcId === 'string' ? body.rpcId : 'invalid-request', result }, { headers });
      },
      });
      return async () => {
        active = false;
        await dispose();
      };
    });
  }
  // A carrier without the public admission API cannot safely expose writes.
  if (typeof ctx.connection.admit !== 'function') return;
  ctx.effect(() => async () => { alive = false; await runtime?.close(); });
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh');
  const file = Object.hasOwn(config, 'storageFile') ? config.storageFile : join(home,
    'storages', 'dsh-session-notebook', 'notes.json');
  return (async () => {
    let store;
    try {
      store = await openJsonStore({ file, maxSnapshotBytes: 50 * 1024 * 1024 });
      if (!alive) { await store.close(); return; }
      runtime = manualRuntime(ctx, store, { maxSnapshotBytes: 50 * 1024 * 1024,
        maxReceiptBytes: 16 * 1024 * 1024, maxReceipts: 100000 });
    } catch (error) {
      storageDiagnostic = ['STORE_CORRUPT', 'STORE_OWNED', 'STORE_UNSUPPORTED', 'INVALID_CONFIG',
        'SNAPSHOT_LIMIT'].includes(error?.code) ? error.code : 'STORE_UNAVAILABLE';
      await store?.close();
      // Opening failure never substitutes an empty library or exposes paths.
    }
  })();
};
