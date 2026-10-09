// Package-level integration entry, NOT activated by the installed Host plugin.
// Only a verified, sole-owner storage initializer may call this after Desktop
// admission, lifecycle, and medium ownership gates are satisfied.
const namespace = 'dsh-session-notebook';
const handlers = { 'notes/anchors': 'anchors', 'notes/excerpt': 'excerpt', 'manual/list': 'list', 'manual/get': 'get', 'manual/create': 'create',
  'manual/update': 'update', 'manual/backup': 'exportJson', 'library/query': 'library',
  'markdown/export': 'exportMarkdown',
  'tags/list': 'tagList', 'tags/preview': 'tagPreview', 'tags/create': 'tagCreate',
  'tags/rename': 'tagRename', 'tags/merge': 'tagMerge', 'tags/delete': 'tagDelete',
  'notes/preview': 'notePreview', 'notes/apply': 'noteApply',
  'notes/get': 'noteGet', 'notes/edit': 'noteEdit', 'notes/convert': 'noteConvert',
  'backups/begin': 'backupBegin', 'backups/chunk': 'backupChunk',
  'backups/finish': 'backupFinish', 'backups/preview': 'backupPreview',
  'backups/cancel': 'backupCancel' };
const paths = Object.keys(handlers);
const mutating = new Set(['notes/excerpt', 'manual/create', 'manual/update', 'tags/create',
  'tags/rename', 'tags/merge', 'tags/delete', 'notes/apply', 'notes/edit', 'notes/convert']);
const diagnostic = new Set(['VALIDATION_FAILED', 'VERSION_CONFLICT', 'EPOCH_CONFLICT',
  'COMMIT_UNKNOWN', 'READ_UNAVAILABLE', 'SNAPSHOT_LIMIT', 'REQUEST_LIMIT',
  'RECEIPT_LIMIT', 'REQUEST_ID_REUSED', 'CLOSED', 'NAME_CONFLICT', 'CONFIRM_REQUIRED',
  'UPLOAD_BUSY', 'UPLOAD_NOT_FOUND', 'UPLOAD_CONFLICT', 'UPLOAD_INCOMPLETE',
  'INVALID_BACKUP', 'UNSUPPORTED_BACKUP', 'BACKUP_TOO_LARGE', 'SESSION_ACTIVITY_UNAVAILABLE']);
const failure = code => ({ ok: false, error: { code, message: code, details: {} } });
const result = value => ({ ok: true, value });
const envelope = (rpcId, outcome) => Response.json({ type: 'server-response', rpcId, result: outcome },
  { headers: { 'Cache-Control': 'no-store' } });
const own = (value, key) => Object.hasOwn(value, key);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const validPayload = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const cancelled = rpcId => envelope(rpcId, failure('CANCELLED'));

export function registerPreviewRoutes(ctx, service) {
  if (!ctx?.connection?.fetch?.register || !service || paths.some(path =>
    typeof service[handlers[path]] !== 'function'))
    throw new TypeError('INVALID_PREVIEW_SERVICE');
  const stops = [];
  for (const endpoint of paths) {
    ctx.effect(() => {
      let active = true;
      const method = `${namespace}/${endpoint}`;
      const dispose = ctx.connection.fetch.register({
        path: `/api/${method}`, methods: ['POST'], requestBody: 'buffered',
        async fetch(request) {
          if (!active) return new Response('not found', { status: 404 });
          // Exact routes bypass the shared RPC handler. Reapply the same Host
          // trust/auth boundary explicitly before parsing or touching storage.
          let admission;
          try { admission = ctx.connection.admit?.(request); } catch { /* deny closed */ }
          if (!admission || !Object.hasOwn(admission, 'peer')) return new Response('unauthorized', {
            status: admission?.rejection === 403 ? 403 : 401,
            headers: { 'Cache-Control': 'no-store' },
          });
          if (request.signal.aborted) return cancelled('cancelled');
          if (request.method !== 'POST' || new URL(request.url).search
            || request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json')
            return new Response('invalid request', { status: 400 });
          // Bounded admission even if an HTTP peer omits Content-Length.
          let bytes;
          try {
            const reader = request.body?.getReader();
            if (!reader) throw new Error('EMPTY_BODY');
            const chunks = []; let length = 0;
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              length += value.byteLength;
              if (length > 256 * 1024) { await reader.cancel(); return new Response('request too large', { status: 413 }); }
              chunks.push(value);
            }
            bytes = new Uint8Array(length);
            let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
          } catch { return new Response('invalid request', { status: 400 }); }
          if (!active) return new Response('not found', { status: 404 });
          if (request.signal.aborted) return cancelled('cancelled');
          let body;
          try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
          catch { return new Response('invalid request', { status: 400 }); }
          const rpcId = validId(body?.rpcId) ? body.rpcId : 'invalid-request';
          if (!validPayload(body) || body.type !== 'client-request' || !validId(body.rpcId)
            || body.method !== method || !own(body, 'payload') || !validPayload(body.payload)
            || Object.keys(body).some(key => !['type', 'rpcId', 'method', 'payload'].includes(key)))
            return envelope(rpcId, failure('VALIDATION_FAILED'));
          try {
            if (request.signal.aborted) return cancelled(rpcId);
            if ((['manual/backup', 'tags/list'].includes(endpoint) && Object.keys(body.payload).length)
              || (['manual/get', 'notes/get'].includes(endpoint) && (Object.keys(body.payload).length !== 1
                || !own(body.payload, 'id')))) return envelope(rpcId, failure('VALIDATION_FAILED'));
            if (!mutating.has(endpoint)) await service.refresh?.();
            const value = endpoint === 'manual/backup' ? service.exportJson()
              : endpoint === 'tags/list' ? service.tagList()
              : endpoint === 'manual/get' ? service.get(body.payload.id)
                : endpoint === 'notes/get' ? service.noteGet(body.payload.id)
                : endpoint.startsWith('backups/')
                  ? await service[handlers[endpoint]](admission.peer.id, body.payload)
                  : await service[handlers[endpoint]](body.payload);
            if (!active) return new Response('not found', { status: 404 });
            // A cancellation after a mutation was enqueued cannot undo it;
            // preserve the receipt so the caller can retry its stable intent.
            return envelope(rpcId, result(value));
          } catch (error) {
            if (!active) return new Response('not found', { status: 404 });
            // Transport cancellation must never disguise COMMIT_UNKNOWN.
            return envelope(rpcId, failure(diagnostic.has(error?.code) ? error.code : 'VALIDATION_FAILED'));
          }
        },
      });
      let closing;
      const stop = () => {
        active = false;
        closing ??= Promise.resolve().then(dispose);
        return closing;
      };
      stops.push(stop);
      return stop;
    });
  }
  let closing;
  return () => {
    closing ??= (async () => {
      const outcomes = await Promise.allSettled(stops.map(stop => stop()));
      if (outcomes.some(outcome => outcome.status === 'rejected'))
        throw Object.assign(new Error('CLOSE_FAILED'), { code: 'CLOSE_FAILED' });
    })();
    return closing;
  };
}
