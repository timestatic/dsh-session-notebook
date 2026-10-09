import { randomBytes } from 'node:crypto';
import { inspectBackupJson, DEFAULT_BACKUP_BYTES } from './json-backup.js';

export const RESTORE_CHUNK_BYTES = 128 * 1024;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const actorId = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
const bounded = (value, maximum) => Number.isSafeInteger(value) && value >= 1 && value <= maximum;

// One bounded, non-authoritative import candidate. The caller binds `actor`
// to the Host-admitted peer and owns this object for one plugin lifecycle.
export function restoreUpload({ maxBytes = DEFAULT_BACKUP_BYTES,
  maxChunkBytes = RESTORE_CHUNK_BYTES, ttlMs = 10 * 60 * 1000,
  now = Date.now } = {}) {
  if (!bounded(maxBytes, DEFAULT_BACKUP_BYTES) || !bounded(maxChunkBytes, RESTORE_CHUNK_BYTES)
    || !bounded(ttlMs, Number.MAX_SAFE_INTEGER) || typeof now !== 'function') fail('INVALID_CONFIG');
  let pending = null;
  let closed = false;
  const cancelled = new Map();
  let overflowAt = null;
  const key = (actor, uploadId) => `${actor}\0${uploadId}`;
  const rememberCancel = (actor, uploadId) => {
    const name = key(actor, uploadId);
    cancelled.delete(name);
    cancelled.set(name, now());
    if (cancelled.size > 32) {
      cancelled.delete(cancelled.keys().next().value);
      // An evicted ID may still have a delayed begin in flight. Refuse new
      // candidates for one TTL instead of silently reopening that ID.
      overflowAt = now();
    }
  };
  const live = () => {
    if (closed) fail('CLOSED');
    const time = now();
    if (pending && time - pending.lastUsedAt >= ttlMs) pending = null;
    for (const [name, cancelledAt] of cancelled) {
      if (time - cancelledAt >= ttlMs) cancelled.delete(name);
    }
    if (overflowAt !== null && time - overflowAt >= ttlMs) overflowAt = null;
  };
  const owned = (actor, token) => {
    live();
    if (!actorId(actor) || !id(token) || !pending || pending.actor !== actor || pending.token !== token)
      fail('UPLOAD_NOT_FOUND');
    return pending;
  };
  const progress = entry => ({ token: entry.token, nextIndex: entry.nextIndex,
    receivedBytes: entry.receivedBytes });
  return {
    begin({ actor, uploadId, bytes }) {
      live();
      if (!actorId(actor) || !id(uploadId) || !bounded(bytes, maxBytes)) fail('VALIDATION_FAILED');
      if (cancelled.has(key(actor, uploadId))) fail('UPLOAD_NOT_FOUND');
      if (pending) {
        if (pending.actor === actor && pending.uploadId === uploadId && pending.bytes === bytes) {
          pending.lastUsedAt = now();
          return progress(pending);
        }
        fail('UPLOAD_BUSY');
      }
      if (overflowAt !== null) fail('UPLOAD_BUSY');
      pending = { actor, uploadId, bytes, token: randomBytes(16).toString('hex'),
        chunks: [], nextIndex: 0, receivedBytes: 0, lastUsedAt: now(), inspected: null };
      return progress(pending);
    },
    append({ actor, token, index, base64 }) {
      const entry = owned(actor, token);
      if (entry.inspected || !Number.isSafeInteger(index) || index < 0
        || typeof base64 !== 'string' || base64.length > 4 * Math.ceil(maxChunkBytes / 3)
        || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))
        fail('VALIDATION_FAILED');
      const chunk = Buffer.from(base64, 'base64');
      if (!chunk.length || chunk.length > maxChunkBytes || chunk.toString('base64') !== base64)
        fail('VALIDATION_FAILED');
      if (index < entry.chunks.length) {
        if (!entry.chunks[index].equals(chunk)) fail('UPLOAD_CONFLICT');
        entry.lastUsedAt = now();
        return progress(entry);
      }
      if (index !== entry.chunks.length || entry.receivedBytes + chunk.length > entry.bytes)
        fail('UPLOAD_CONFLICT');
      entry.chunks.push(chunk); entry.nextIndex++; entry.receivedBytes += chunk.length;
      entry.lastUsedAt = now();
      return progress(entry);
    },
    finish({ actor, token }) {
      const entry = owned(actor, token);
      if (entry.inspected) return { ...progress(entry), summary: structuredClone(entry.inspected.summary) };
      if (entry.receivedBytes !== entry.bytes) fail('UPLOAD_INCOMPLETE');
      let inspected;
      try {
        const content = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(entry.chunks));
        inspected = inspectBackupJson(content, { declaredBytes: entry.bytes, maxBytes });
      } catch (error) {
        pending = null;
        fail(['BACKUP_TOO_LARGE', 'INVALID_BACKUP', 'UNSUPPORTED_BACKUP', 'VALIDATION_FAILED']
          .includes(error?.code) ? error.code : 'INVALID_BACKUP');
      }
      entry.chunks = [];
      entry.inspected = inspected;
      entry.lastUsedAt = now();
      return { ...progress(entry), summary: structuredClone(inspected.summary) };
    },
    candidate({ actor, token }) {
      const entry = owned(actor, token);
      if (!entry.inspected) fail('UPLOAD_INCOMPLETE');
      return structuredClone(entry.inspected);
    },
    cancel({ actor, token, uploadId }) {
      live();
      if (!actorId(actor) || (token === undefined) === (uploadId === undefined)
        || (token !== undefined ? !id(token) : !id(uploadId))) fail('UPLOAD_NOT_FOUND');
      if (token !== undefined) {
        if (!pending || pending.actor !== actor || pending.token !== token) fail('UPLOAD_NOT_FOUND');
        rememberCancel(actor, pending.uploadId);
        pending = null;
        return;
      }
      if (pending?.uploadId === uploadId && pending.actor !== actor) fail('UPLOAD_NOT_FOUND');
      if (pending?.actor === actor && pending.uploadId === uploadId) pending = null;
      rememberCancel(actor, uploadId);
    },
    close() { closed = true; pending = null; cancelled.clear(); overflowAt = null; },
  };
}
