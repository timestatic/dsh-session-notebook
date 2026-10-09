import { createHash } from 'node:crypto';

// Test-only design prototype. Not shipped or bound to a production Domain.
// JSON-only requests; key sorting makes object insertion order irrelevant.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function failure(code) { const error = new Error(code); error.code = code; return error; }
export function candidateStore({ initial, persist, validate,
  maxReceipts = 1000, maxReceiptBytes = 1024 * 1024, maxRequestBytes = 1024 * 1024 }) {
  for (const limit of [maxReceipts, maxReceiptBytes, maxRequestBytes]) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw failure('INVALID_LIMIT');
  }
  const receiptSize = receipts => Buffer.byteLength(JSON.stringify(receipts), 'utf8');
  validate(initial);
  if (Object.keys(initial.receipts).length > maxReceipts || receiptSize(initial.receipts) > maxReceiptBytes) throw failure('RECEIPT_LIMIT');
  let current = structuredClone(initial);
  let tail = Promise.resolve(); let protectedState = false; let closed = false;
  const queue = job => {
    if (closed) return Promise.reject(failure('CLOSED'));
    const result = tail.then(job); tail = result.then(() => {}, () => {}); return result;
  };
  return {
    read: () => structuredClone(current),
    mutate(raw) {
      // Freeze intent before it reaches the queue; validate before persistence.
      const request = structuredClone(raw);
      return queue(async () => {
        if (protectedState) throw failure('COMMIT_UNKNOWN');
        const { requestId, epoch, expectedVersion, id, body } = request;
        if (Buffer.byteLength(canonical(request), 'utf8') > maxRequestBytes) throw failure('REQUEST_LIMIT');
        if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)
          || ['__proto__', 'constructor', 'prototype'].includes(requestId)
          || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)
          || ['__proto__', 'constructor', 'prototype'].includes(id)
          || typeof body !== 'string' || body.length > 100000 || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1
          || Object.keys(request).some(key => !['requestId', 'epoch', 'expectedVersion', 'id', 'body'].includes(key))) throw failure('VALIDATION_FAILED');
        if (epoch !== current.epoch) throw failure('EPOCH_CONFLICT');
        const hash = createHash('sha256').update(canonical(request)).digest('hex');
        const prior = current.receipts[requestId];
        if (prior) {
          if (prior.hash !== hash) throw failure('REQUEST_ID_REUSED');
          return structuredClone(prior.result);
        }
        const previous = current.notes[id];
        if (!previous || previous.version !== expectedVersion) throw failure('VERSION_CONFLICT');
        const next = structuredClone(current);
        next.notes[id] = { ...next.notes[id], body, version: previous.version + 1 };
        next.revision++;
        const result = { id, version: previous.version + 1, revision: next.revision };
        next.receipts[requestId] = { hash, result };
        if (Object.keys(next.receipts).length > maxReceipts || receiptSize(next.receipts) > maxReceiptBytes) throw failure('RECEIPT_LIMIT');
        validate(next);
        try { await persist(structuredClone(next)); }
        catch { protectedState = true; throw failure('COMMIT_UNKNOWN'); }
        // Persist callback cannot retain a reference to the authoritative candidate.
        current = next;
        return structuredClone(result);
      });
    },
    async close() { closed = true; await tail; },
  };
}
