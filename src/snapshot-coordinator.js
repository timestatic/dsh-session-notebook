import { createHash } from 'node:crypto';
import { measureRequestBytes, measureSnapshotBytes,
  DEFAULT_PREVIEW_REQUEST_BYTES, DEFAULT_PREVIEW_SNAPSHOT_BYTES } from './snapshot-budget.js';

// The Host supplies the single-instance snapshot store. All business mutations
// share this queue and read the store's published global snapshot.
const failure = code => Object.assign(new Error(code), { code });
const fail = code => { throw failure(code); };
const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id)
  && !['__proto__', 'constructor', 'prototype'].includes(id);
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
export function snapshotCoordinator({ domain, maxRequestBytes = DEFAULT_PREVIEW_REQUEST_BYTES,
  maxSnapshotBytes = DEFAULT_PREVIEW_SNAPSHOT_BYTES, maxReceiptBytes = 256 * 1024, maxReceipts = 1000 }) {
  if (!domain || typeof domain.global?.get !== 'function' || typeof domain.global?.set !== 'function'
    || !Number.isSafeInteger(maxRequestBytes) || maxRequestBytes < 1
    || !Number.isSafeInteger(maxSnapshotBytes) || maxSnapshotBytes < 1
    || !Number.isSafeInteger(maxReceiptBytes) || maxReceiptBytes < 1
    || !Number.isSafeInteger(maxReceipts) || maxReceipts < 1 || maxReceipts > 100000) fail('INVALID_CONFIG');
  // Refuse invalid or oversized existing media; caller must never substitute
  // an empty Snapshot for any open/parse/validation failure.
  const checkReceipts = snapshot => {
    if (Object.keys(snapshot.operationReceipts).length > maxReceipts
      || Buffer.byteLength(JSON.stringify(snapshot.operationReceipts), 'utf8') > maxReceiptBytes)
      fail('RECEIPT_LIMIT');
  };
  checkReceipts(measureSnapshotBytes(domain.global.get(), { maxBytes: maxSnapshotBytes }).snapshot);
  let tail = Promise.resolve();
  let closed = false;
  let unknown = false;
  const read = () => {
    if (unknown) fail('COMMIT_UNKNOWN');
    let snapshot;
    try {
      snapshot = measureSnapshotBytes(domain.global.get(), { maxBytes: maxSnapshotBytes }).snapshot;
      checkReceipts(snapshot);
    } catch {
      // A live Domain read failure may conceal an invalid or changed medium.
      // Never let a later successful read silently resume writing on this handle.
      unknown = true;
      fail('READ_UNAVAILABLE');
    }
    return snapshot;
  };
  const refresh = async () => {
    if (unknown) fail('COMMIT_UNKNOWN');
    try {
      if (typeof domain.reload === 'function') await domain.reload();
    } catch (error) {
      if (error?.code === 'STORE_OWNED') fail('READ_UNAVAILABLE');
      unknown = true;
      fail('READ_UNAVAILABLE');
    }
    return read();
  };
  return {
    read,
    refresh,
    mutate(request, candidate) {
      if (closed) return Promise.reject(failure('CLOSED'));
      if (unknown) return Promise.reject(failure('COMMIT_UNKNOWN'));
      // Freeze and measure the raw DTO before queueing; do not let the caller
      // mutate a pending intent. Operation-specific validation belongs to the
      // Host handler and the candidate function.
      let frozen;
      try {
        measureRequestBytes(request, { maxBytes: maxRequestBytes });
        frozen = structuredClone(request);
      } catch (error) { return Promise.reject(error); }
      const result = tail.then(async () => {
        if (unknown) fail('COMMIT_UNKNOWN');
        if (typeof candidate !== 'function' || !validId(frozen.requestId)) fail('VALIDATION_FAILED');
        const current = await refresh();
        if (frozen.epoch !== current.epoch) fail('EPOCH_CONFLICT');
        const hash = createHash('sha256').update(canonical(frozen)).digest('hex');
        const prior = Object.hasOwn(current.operationReceipts, frozen.requestId)
          ? current.operationReceipts[frozen.requestId] : undefined;
        if (prior) {
          if (prior.payloadHash !== hash) fail('REQUEST_ID_REUSED');
          return { epoch: current.epoch, revision: prior.committedRevision,
            ...(prior.resultNoteId && { noteId: prior.resultNoteId }) };
        }
        // A stale page must never overwrite an intervening write; retries with
        // the same durable intent are the only exception (above).
        if (!Number.isSafeInteger(frozen.expectedRevision) || frozen.expectedRevision !== current.revision)
          fail('VERSION_CONFLICT');
        if (Object.keys(current.operationReceipts).length >= maxReceipts) fail('RECEIPT_LIMIT');
        // Candidate code is not trusted to mutate the authoritative read
        // snapshot. Compare against an untouched receipt copy afterward.
        const originalReceipts = canonical(current.operationReceipts);
        const candidateIntent = structuredClone(frozen);
        let next;
        try { next = candidate(current, candidateIntent); }
        catch (error) {
          // Candidate is an internal business function, not an exception body
          // that may be serialized to the Client. Preserve only known codes.
          if (['VALIDATION_FAILED', 'VERSION_CONFLICT', 'CONFIRM_REQUIRED', 'NAME_CONFLICT']
            .includes(error?.code)) fail(error.code);
          fail('VALIDATION_FAILED');
        }
        if (canonical(candidateIntent) !== canonical(frozen)) fail('VALIDATION_FAILED');
        // A candidate must not forge or erase receipts; both candidate and
        // receipt become one validated whole-Snapshot commit.
        if (!next || typeof next !== 'object' || !next.operationReceipts
          || canonical(current.operationReceipts) !== originalReceipts
          || canonical(next.operationReceipts) !== originalReceipts) fail('VALIDATION_FAILED');
        next.operationReceipts[frozen.requestId] = { payloadHash: hash,
          committedRevision: current.revision + 1,
          ...(frozen.id && { resultNoteId: frozen.id }) };
        const checked = measureSnapshotBytes(next, { maxBytes: maxSnapshotBytes }).snapshot;
        checkReceipts(checked);
        if (checked.epoch !== current.epoch || checked.revision !== current.revision + 1)
          fail('VALIDATION_FAILED');
        if (typeof domain.estimateBytes === 'function') {
          const bytes = domain.estimateBytes(checked);
          if (!Number.isSafeInteger(bytes) || bytes < 1) fail('VALIDATION_FAILED');
          // The file store preflight is pure. Reject capacity before entering
          // the uncertain I/O boundary, including metadata/ref overhead.
          if (bytes > maxSnapshotBytes) fail('SNAPSHOT_LIMIT');
        }
        try { await domain.global.set(checked); }
        catch (error) {
          if (['VERSION_CONFLICT', 'EPOCH_CONFLICT'].includes(error?.code)) fail(error.code);
          if (['STORE_OWNED', 'STORE_UNAVAILABLE'].includes(error?.code)) fail('READ_UNAVAILABLE');
          unknown = true;
          fail('COMMIT_UNKNOWN');
        }
        return { epoch: checked.epoch, revision: checked.revision,
          ...(frozen.id && { noteId: frozen.id }) };
      });
      tail = result.then(() => {}, () => {});
      return result;
    },
    async close() { closed = true; await tail; },
  };
}
