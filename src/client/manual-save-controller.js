// Client save flow. Host remains the sole authority; a transport failure
// MUST preserve the same intent for retry.
const failure = code => Object.assign(new Error(code), { code });
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const MAX_TITLE_CODEPOINTS = 1000;
const MAX_BODY_CODEPOINTS = 100000;
const MAX_REQUEST_BYTES = 256 * 1024;
// The exact Host route caps the complete JSON RPC envelope, not just payload.
// Its rpcId admits up to 128 ASCII characters; reserve that maximum here.
const envelopeBytes = (method, payload) => new TextEncoder().encode(JSON.stringify({
  type: 'client-request', rpcId: 'x'.repeat(128),
  method: `dsh-session-notebook/${method}`, payload,
})).byteLength;
const rejectedBeforeCommit = new Set(['VALIDATION_FAILED', 'REQUEST_LIMIT', 'SNAPSHOT_LIMIT', 'RECEIPT_LIMIT']);
const safe = error => {
  const code = error?.code;
  return ['CANCELLED', 'TIMEOUT', 'VERSION_CONFLICT', 'EPOCH_CONFLICT', 'COMMIT_UNKNOWN',
    'REQUEST_ID_REUSED', 'VALIDATION_FAILED', 'REQUEST_LIMIT', 'SNAPSHOT_LIMIT', 'RECEIPT_LIMIT',
    'READ_UNAVAILABLE', 'CLOSED', 'TRANSPORT_FAILED', 'INVALID_RESPONSE',
    'TITLE_LIMIT', 'BODY_LIMIT'].includes(code)
    ? code : 'TRANSPORT_FAILED';
};

/** One panel instance owns this controller and calls dispose on unmount. */
export function manualSaveController({ api, createRequestId, timeoutMs = 10000,
  onChange = () => {} }) {
  if (typeof api?.create !== 'function' || typeof createRequestId !== 'function'
    || typeof onChange !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
    throw failure('INVALID_CONFIG');
  let state = { status: 'idle', draft: '', title: '', tagIds: [], pending: null, receipt: null, diagnostic: null };
  let alive = true, running = null, conflictRead = null;
  let conflictPreview = null;
  const view = () => ({ ...state,
    pending: state.pending ? structuredClone(state.pending) : null,
    receipt: state.receipt ? structuredClone(state.receipt) : null,
    conflictPreview: conflictPreview ? structuredClone(conflictPreview) : null });
  const publish = patch => {
    if (!alive) return;
    state = { ...state, ...patch };
    onChange(view());
  };
  const send = async intent => {
    const controller = new AbortController();
    let timedOut = false;
    let rejectAbort;
    const aborted = new Promise((_resolve, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(failure(timedOut ? 'TIMEOUT' : 'CANCELLED'));
    controller.signal.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    running = { intent, controller };
    publish({ status: 'saving', diagnostic: null });
    try {
      const transport = state.editingId ? api.update : api.create;
      if (typeof transport !== 'function') throw failure('INVALID_RESPONSE');
      const receipt = await Promise.race([transport(structuredClone(intent), controller.signal), aborted]);
      if (!receipt || receipt.epoch !== intent.epoch || !Number.isSafeInteger(receipt.revision)
        || receipt.revision < intent.expectedRevision + 1
        || (state.editingId ? receipt.noteId !== state.editingId : !id(receipt.noteId)))
        throw failure('INVALID_RESPONSE');
      const committed = structuredClone(receipt);
      if (alive && running?.intent === intent) {
        publish({ status: 'saved', draft: '', title: '', tagIds: [], editingId: null, expectedVersion: null,
          pending: null, receipt: committed, diagnostic: null });
      }
      return structuredClone(committed);
    } catch (error) {
      const code = timedOut ? 'TIMEOUT' : controller.signal.aborted ? 'CANCELLED' : safe(error);
      if (alive && running?.intent === intent) publish({ status: 'failed', diagnostic: code,
        ...(rejectedBeforeCommit.has(code) && { pending: null }) });
      throw failure(code);
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener('abort', onAbort);
      if (running?.intent === intent) running = null;
    }
  };
  return {
    snapshot: view,
    load(note) {
      if (!alive) throw failure('CLOSED');
      if (running || conflictRead || state.pending || state.draft || state.title) throw failure('PENDING_INTENT');
      if (!note || !id(note.id) || !Number.isSafeInteger(note.version) || note.version < 1
        || typeof note.bodyMarkdown !== 'string' || (note.title !== undefined && typeof note.title !== 'string'))
        throw failure('VALIDATION_FAILED');
      publish({ editingId: note.id, expectedVersion: note.version, draft: note.bodyMarkdown,
        title: note.title ?? '', tagIds: [...(note.tagIds ?? [])], status: 'idle', receipt: null, diagnostic: null });
    },
    editTags(tagIds) {
      if (!alive) throw failure('CLOSED');
      if (running || conflictRead || state.pending) throw failure('PENDING_INTENT');
      if (!Array.isArray(tagIds) || tagIds.length > 10 || new Set(tagIds).size !== tagIds.length
        || tagIds.some(value => !id(value))) throw failure('VALIDATION_FAILED');
      publish({ tagIds: [...tagIds], status: 'idle', diagnostic: null });
    },
    editTitle(title) {
      if (!alive) throw failure('CLOSED');
      if (running || conflictRead || state.pending) throw failure('PENDING_INTENT');
      if (typeof title !== 'string') throw failure('VALIDATION_FAILED');
      publish({ title, status: 'idle', diagnostic: null });
    },
    edit(body) {
      if (!alive) throw failure('CLOSED');
      if (running || conflictRead || state.pending) throw failure('PENDING_INTENT');
      if (typeof body !== 'string') throw failure('VALIDATION_FAILED');
      publish({ draft: body, status: 'idle', diagnostic: null });
    },
    save({ epoch, revision }) {
      if (!alive) return Promise.reject(failure('CLOSED'));
      if (running || conflictRead || state.pending) return Promise.reject(failure('PENDING_INTENT'));
      if (!id(epoch) || !Number.isSafeInteger(revision) || revision < 0 || !state.draft.trim())
        return Promise.reject(failure('VALIDATION_FAILED'));
      if (state.title.length > MAX_TITLE_CODEPOINTS || [...state.title].length > MAX_TITLE_CODEPOINTS)
        return Promise.reject(failure('TITLE_LIMIT'));
      if (state.draft.length > MAX_BODY_CODEPOINTS || [...state.draft].length > MAX_BODY_CODEPOINTS)
        return Promise.reject(failure('BODY_LIMIT'));
      const requestId = createRequestId();
      if (!id(requestId) || ['__proto__', 'constructor', 'prototype'].includes(requestId))
        return Promise.reject(failure('INVALID_CONFIG'));
      const intent = { requestId, epoch, expectedRevision: revision, bodyMarkdown: state.draft,
        tagIds: [...state.tagIds],
        ...(state.title && { title: state.title }),
        ...(state.editingId && { id: state.editingId, expectedVersion: state.expectedVersion, title: state.title }) };
      if (envelopeBytes(state.editingId ? 'manual/update' : 'manual/create', intent) > MAX_REQUEST_BYTES)
        return Promise.reject(failure('REQUEST_LIMIT'));
      publish({ pending: intent });
      return send(intent);
    },
    retry() {
      if (!alive) return Promise.reject(failure('CLOSED'));
      if (running || conflictRead || !state.pending || state.status !== 'failed')
        return Promise.reject(failure('PENDING_INTENT'));
      if (['VERSION_CONFLICT', 'EPOCH_CONFLICT', 'COMMIT_UNKNOWN'].includes(state.diagnostic))
        return Promise.reject(failure(state.diagnostic));
      return send(state.pending);
    },
    // Read the latest Host state; preserve the local draft while the user compares.
    async inspectConflict() {
      if (!alive) throw failure('CLOSED');
      if (running || conflictRead || !state.pending
        || !['VERSION_CONFLICT', 'EPOCH_CONFLICT'].includes(state.diagnostic))
        throw failure('PENDING_INTENT');
      if (typeof api.list !== 'function' || (state.editingId && typeof api.get !== 'function'))
        throw failure('INVALID_CONFIG');
      const controller = new AbortController();
      let timedOut = false, rejectAbort;
      const aborted = new Promise((_resolve, reject) => { rejectAbort = reject; });
      const onAbort = () => rejectAbort(failure(timedOut ? 'TIMEOUT' : 'CANCELLED'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
      conflictRead = controller; conflictPreview = null;
      try {
        const latest = await Promise.race([api.list({}, controller.signal), aborted]);
        if (!alive || controller.signal.aborted) throw failure('CANCELLED');
        if (!latest || !id(latest.epoch) || !Number.isSafeInteger(latest.revision) || latest.revision < 0)
          throw failure('INVALID_RESPONSE');
        let detail = null;
        if (state.editingId) {
          detail = await Promise.race([api.get(state.editingId, controller.signal), aborted]);
          if (!alive || controller.signal.aborted) throw failure('CANCELLED');
          if (!detail || detail.epoch !== latest.epoch || detail.revision !== latest.revision
            || detail.note?.id !== state.editingId
            || !Number.isSafeInteger(detail.note.version) || detail.note.version < 1
            || typeof detail.note.bodyMarkdown !== 'string') throw failure('READ_UNAVAILABLE');
        }
        conflictPreview = { epoch: latest.epoch, revision: latest.revision,
          ...(detail && { note: structuredClone(detail.note) }) };
        publish({});
        return structuredClone(conflictPreview);
      } catch (error) { throw failure(timedOut ? 'TIMEOUT'
        : controller.signal.aborted ? 'CANCELLED' : safe(error)); }
      finally { clearTimeout(timer); controller.signal.removeEventListener('abort', onAbort);
        if (conflictRead === controller) conflictRead = null; }
    },
    // Only known rejected conflicts can be rebased; uncertain commits must keep
    // their durable intent until reconciled, never acquire a fresh request ID.
    resolveConflictConfirmed({ epoch, revision, note }) {
      if (!alive) throw failure('CLOSED');
      if (running || conflictRead || !state.pending || !['VERSION_CONFLICT', 'EPOCH_CONFLICT'].includes(state.diagnostic))
        throw failure('PENDING_INTENT');
      if (conflictRead || !conflictPreview || epoch !== conflictPreview.epoch
        || revision !== conflictPreview.revision
        || (state.editingId && (!note || note.id !== state.editingId
          || note.version !== conflictPreview.note?.version))) throw failure('VALIDATION_FAILED');
      conflictPreview = null;
      publish({ pending: null, status: 'idle', diagnostic: null,
        ...(state.editingId && { expectedVersion: note.version }) });
      return { epoch, revision };
    },
    // The user must confirm before discarding an uncertain request; cancelling
    // a fetch does not prove that a Host commit did not happen.
    discardConfirmed() {
      if (!alive || running || conflictRead) throw failure('PENDING_INTENT');
      conflictPreview = null;
      publish({ draft: '', title: '', editingId: null, expectedVersion: null,
        pending: null, receipt: null, diagnostic: null, status: 'idle' });
    },
    // A panel may unmount while its owner keeps the draft. Abort the wait but
    // preserve the original intent and request ID for a later retry.
    cancel() { running?.controller.abort(); conflictRead?.abort(); },
    dispose() { alive = false; running?.controller.abort(); conflictRead?.abort(); conflictPreview = null; },
  };
}
