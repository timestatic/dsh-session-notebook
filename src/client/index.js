window.__ModuleLoader__.load({
  id: '@timestatic/dsh-session-notebook',
  factory(require) {
    const React = require('react');
    // Generated from Client ESM modules by scripts/build-client.mjs.
    const previewApi = (() => {
    // Transport-only Client adapter; the generated Client entry uses this source.
    // The Desktop carrier remains the sole network path.
    const namespace = 'dsh-session-notebook';
    const known = new Set(['VALIDATION_FAILED', 'VERSION_CONFLICT', 'EPOCH_CONFLICT',
      'COMMIT_UNKNOWN', 'READ_UNAVAILABLE', 'SNAPSHOT_LIMIT', 'REQUEST_LIMIT',
      'RECEIPT_LIMIT', 'REQUEST_ID_REUSED', 'CLOSED', 'CANCELLED', 'NAME_CONFLICT', 'CONFIRM_REQUIRED',
      'UPLOAD_BUSY', 'UPLOAD_NOT_FOUND', 'UPLOAD_CONFLICT', 'UPLOAD_INCOMPLETE',
      'INVALID_BACKUP', 'UNSUPPORTED_BACKUP', 'BACKUP_TOO_LARGE', 'SESSION_ACTIVITY_UNAVAILABLE']);
    const fail = code => { throw Object.assign(new Error(code), { code }); };
    const record = value => value && typeof value === 'object' && !Array.isArray(value);
    const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
    const positive = value => Number.isSafeInteger(value) && value >= 0;
    const receipt = value => record(value) && id(value.epoch) && positive(value.revision)
      && (value.noteId === undefined || id(value.noteId));
    const tagReceipt = value => receipt(value) && value.noteId === undefined;
    const uploadProgress = value => record(value) && id(value.token)
      && positive(value.nextIndex) && positive(value.receivedBytes);
    const backupSummary = value => record(value) && value.backupVersion === 1 && positive(value.schemaVersion)
      && positive(value.revision) && positive(value.noteCount)
      && positive(value.trashedCount) && positive(value.tagCount);
    const replacementPreview = value => {
      if (!record(value) || value.mode !== 'replace-whole-library'
        || !record(value.current) || !id(value.current.epoch) || !positive(value.current.revision)
        || !record(value.backup) || value.backup.backupVersion !== 1 || value.backup.schemaVersion !== 1
        || ![value.current, value.backup].every(part =>
          ['notes', 'trashed', 'tags'].every(key => positive(part[key])) && part.trashed <= part.notes)
        || !record(value.impact) || !['notesRemoved', 'notesReplaced', 'notesAdded',
          'tagsRemoved', 'tagsReplaced', 'tagsAdded'].every(key => positive(value.impact[key]))) return false;
      for (const [count, prefix] of [['notes', 'notes'], ['tags', 'tags']]) {
        if (value.impact[`${prefix}Removed`] + value.impact[`${prefix}Replaced`] !== value.current[count]
          || value.impact[`${prefix}Added`] + value.impact[`${prefix}Replaced`] !== value.backup[count]) return false;
      }
      const capacity = value.capacity;
      return record(capacity) && positive(capacity.estimatedBytes) && capacity.estimatedBytes > 0
        && positive(capacity.limitBytes) && capacity.limitBytes > 0
        && capacity.fits === (capacity.estimatedBytes <= capacity.limitBytes);
    };
    const tagPreview = (value, payload) => record(value) && value.action === payload.action
      && id(value.epoch) && positive(value.revision) && value.sourceId === payload.sourceId
      && positive(value.sourceVersion) && value.sourceVersion > 0
      && positive(value.activeAffected) && positive(value.trashedAffected)
      && typeof value.quickTagAffected === 'boolean'
      && (payload.action === 'merge' ? value.targetId === payload.targetId
          && positive(value.targetVersion) && value.targetVersion > 0
        : value.targetId === undefined && value.targetVersion === undefined);
    const notePreview = (value, payload) => record(value) && value.action === payload.action
      && id(value.epoch) && positive(value.revision) && positive(value.count)
      && Array.isArray(value.entries) && value.entries.length === value.count
      && value.entries.length === payload.ids.length
      && value.entries.every((entry, index) => record(entry) && entry.id === payload.ids[index]
        && id(entry.id) && positive(entry.version) && entry.version > 0
        && typeof entry.title === 'string' && ['highlight', 'note', 'manual'].includes(entry.kind));

    function previewApi(connection, { timeoutMs = 10000 } = {}) {
      if (typeof connection?.rpc?.call !== 'function') fail('INVALID_CONNECTION');
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) fail('INVALID_CONFIG');
      const call = async (endpoint, payload, signal, validate) => {
        if (signal?.aborted) fail('CANCELLED');
        if (!signal) fail('CANCEL_SIGNAL_REQUIRED');
        const controller = new AbortController();
        let timedOut = false, rejectAbort;
        const cancelled = new Promise((_resolve, reject) => { rejectAbort = reject; });
        const onAbort = () => rejectAbort(Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' }));
        const forwardAbort = () => controller.abort();
        controller.signal.addEventListener('abort', onAbort, { once: true });
        signal.addEventListener('abort', forwardAbort, { once: true });
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
        let response;
        try {
          response = await Promise.race([
            connection.rpc.call('/api', `${namespace}/${endpoint}`, payload, controller.signal), cancelled,
          ]);
        } catch { fail(timedOut ? 'TIMEOUT' : signal.aborted ? 'CANCELLED' : 'TRANSPORT_FAILED'); }
        finally {
          clearTimeout(timer);
          signal.removeEventListener('abort', forwardAbort);
          controller.signal.removeEventListener('abort', onAbort);
        }
        if (signal?.aborted) fail('CANCELLED');
        if (!record(response) || response.ok !== true) {
          const code = response?.error?.code;
          fail(known.has(code) ? code : 'TRANSPORT_FAILED');
        }
        if (!validate(response.value)) fail('INVALID_RESPONSE');
        return response.value;
      };
      return {
        anchors: (payload, signal) => call('notes/anchors', payload, signal, value => record(value)
          && id(value.epoch) && positive(value.revision) && positive(value.total)
          && Array.isArray(value.items) && value.items.length <= 50
          && new Set(value.items.map(item => item?.id)).size === value.items.length
          && value.items.every(item => record(item) && id(item.id) && ['note', 'highlight'].includes(item.kind)
            && record(item.source) && item.source.sessionId === payload.sessionId
            && record(item.anchor) && typeof item.anchor.exact === 'string'
            && item.anchor.exact.length <= 16000
            && ['prefix', 'suffix'].every(key => item.anchor[key] === undefined || typeof item.anchor[key] === 'string'))),
        excerpt: (payload, signal) => call('notes/excerpt', payload, signal, receipt),
        list: (payload = {}, signal) => call('manual/list', payload, signal, value => record(value)
          && id(value.epoch) && positive(value.revision) && positive(value.total)
          && Array.isArray(value.ids) && value.ids.every(id)
          && Array.isArray(value.items) && value.items.every(item => record(item) && id(item.id)
            && typeof item.title === 'string' && typeof item.excerpt === 'string'
            && positive(item.version) && typeof item.updatedAt === 'string')),
        get: (noteId, signal) => call('manual/get', { id: noteId }, signal, value => value === null
          || (record(value) && id(value.epoch) && positive(value.revision)
            && record(value.note) && id(value.note.id) && value.note.id === noteId
            && value.note.kind === 'manual' && typeof value.note.bodyMarkdown === 'string'
            && positive(value.note.version))),
        create: (payload, signal) => call('manual/create', payload, signal, value => receipt(value) && id(value.noteId)),
        update: (payload, signal) => call('manual/update', payload, signal, receipt),
        backup: (signal) => call('manual/backup', {}, signal, value => record(value)
          && typeof value.content === 'string' && positive(value.bytes) && positive(value.revision)
          && new TextEncoder().encode(value.content).byteLength === value.bytes),
        backupBegin: (payload, signal) => call('backups/begin', payload, signal,
          value => uploadProgress(value) && value.receivedBytes <= payload.bytes),
        backupChunk: (payload, signal) => call('backups/chunk', payload, signal,
          value => uploadProgress(value) && value.token === payload.token
            && value.nextIndex >= payload.index + 1),
        backupFinish: (payload, signal) => call('backups/finish', payload, signal,
          value => uploadProgress(value) && value.token === payload.token
            && backupSummary(value.summary)),
        backupPreview: (payload, signal) => call('backups/preview', payload, signal,
          value => replacementPreview(value) && value.token === payload.token),
        backupCancel: (payload, signal) => call('backups/cancel', payload, signal,
          value => record(value) && value.cancelled === true),
        markdown: (payload, signal) => call('markdown/export', payload, signal, value => record(value)
          && value.epoch === payload.epoch && value.revision === payload.expectedRevision
          && value.count === payload.ids?.length && positive(value.bytes)
          && typeof value.content === 'string'
          && new TextEncoder().encode(value.content).byteLength === value.bytes),
        library: (payload = {}, signal) => call('library/query', payload, signal, value => record(value)
          && id(value.epoch) && positive(value.revision) && positive(value.total)
          && Array.isArray(value.ids) && value.ids.length === value.total && value.ids.every(id)
          && new Set(value.ids).size === value.ids.length
          && Array.isArray(value.pageIds) && value.pageIds.every(itemId => id(itemId) && value.ids.includes(itemId))
          && new Set(value.pageIds).size === value.pageIds.length
          && Array.isArray(value.selectedVisibleIds) && value.selectedVisibleIds.every(itemId =>
            id(itemId) && value.ids.includes(itemId))
          && new Set(value.selectedVisibleIds).size === value.selectedVisibleIds.length
          && positive(value.hiddenSelectedCount)
          && Array.isArray(value.tags) && value.tags.every(tag => record(tag) && id(tag.id)
            && typeof tag.name === 'string' && positive(tag.active) && positive(tag.trashed))
          && Array.isArray(value.items) && value.items.length === value.pageIds.length
          && value.items.every((item, index) => record(item) && item.id === value.pageIds[index]
            && id(item.id) && ['highlight', 'note', 'manual'].includes(item.kind)
            && typeof item.title === 'string' && typeof item.excerpt === 'string'
            && (item.quoteFormat === null || ['plain_text', 'markdown'].includes(item.quoteFormat))
            && typeof item.quoteExcerpt === 'string' && [...item.quoteExcerpt].length <= 240
            && (item.quoteFormat !== null || item.quoteExcerpt === '')
            && Array.isArray(item.tagIds) && item.tagIds.every(id)
            && (item.source === null || record(item.source))
            && typeof item.createdAt === 'string' && typeof item.updatedAt === 'string'
            && (item.deletedAt === null || typeof item.deletedAt === 'string')
            && positive(item.version))),
        tagsList: signal => call('tags/list', {}, signal, value => record(value)
          && id(value.epoch) && positive(value.revision) && Array.isArray(value.items)
          && value.items.every(tag => record(tag) && id(tag.id) && typeof tag.name === 'string'
            && positive(tag.version) && tag.version > 0 && typeof tag.isBuiltin === 'boolean'
            && typeof tag.isQuickTag === 'boolean' && (tag.color === null || typeof tag.color === 'string')
            && positive(tag.active) && positive(tag.trashed))
          && new Set(value.items.map(tag => tag.id)).size === value.items.length),
        tagsPreview: (payload, signal) => call('tags/preview', payload, signal,
          value => tagPreview(value, payload)),
        tagsCreate: (payload, signal) => call('tags/create', payload, signal, tagReceipt),
        tagsRename: (payload, signal) => call('tags/rename', payload, signal, tagReceipt),
        tagsMerge: (payload, signal) => call('tags/merge', payload, signal, tagReceipt),
        tagsDelete: (payload, signal) => call('tags/delete', payload, signal, tagReceipt),
        notesPreview: (payload, signal) => call('notes/preview', payload, signal,
          value => notePreview(value, payload)),
        notesApply: (payload, signal) => call('notes/apply', payload, signal, tagReceipt),
        notesGet: (noteId, signal) => call('notes/get', { id: noteId }, signal, value => value === null
          || (record(value) && id(value.epoch) && positive(value.revision)
            && record(value.note) && value.note.id === noteId && id(value.note.id)
            && ['highlight', 'note', 'manual'].includes(value.note.kind)
            && positive(value.note.version) && value.note.version > 0
            && (value.note.title === undefined || typeof value.note.title === 'string')
            && Array.isArray(value.note.tagIds) && value.note.tagIds.every(id)
            && (value.note.quote === undefined || (record(value.note.quote)
              && typeof value.note.quote.content === 'string'))
            && (value.note.kind === 'highlight'
              ? value.note.bodyMarkdown === undefined || value.note.bodyMarkdown === ''
              : typeof value.note.bodyMarkdown === 'string' && !!value.note.bodyMarkdown.trim())
            && (value.note.kind !== 'note' || record(value.note.quote)))),
        notesEdit: (payload, signal) => call('notes/edit', payload, signal,
          value => receipt(value) && value.noteId === payload.id),
        notesConvert: (payload, signal) => call('notes/convert', payload, signal,
          value => receipt(value) && value.noteId === payload.id),
      };
    }

    return previewApi;
    })();

    const manualSaveController = (() => {
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
    function manualSaveController({ api, createRequestId, timeoutMs = 10000,
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

    return manualSaveController;
    })();

    const { TAG_COLORS, normalizeTagColor, isTagColor, defaultTagColor, resolvedTagColor } = (() => {
    // Only the six product colors are written. Older snapshots keep their stored
    // values, but the UI maps the previous palette to the nearest current color.
    const TAG_COLORS = ['#FF5FA2', '#FF7A00', '#FFD000', '#00D9A3', '#3A86FF', '#7B61FF'];
    const oldColors = {
      '#1d4ed8': '#3A86FF', '#7c3aed': '#7B61FF', '#15803d': '#00D9A3',
      '#b45309': '#FF7A00', '#be123c': '#FF5FA2', '#0f766e': '#00D9A3',
      '#475569': '#3A86FF', '#be185d': '#FF5FA2',
    };

    const normalizeTagColor = value => typeof value === 'string'
      ? TAG_COLORS.find(color => color.toLowerCase() === value.toLowerCase()) : undefined;
    const isTagColor = value => normalizeTagColor(value) !== undefined;

    function defaultTagColor(id) {
      const builtins = { builtin_todo: 1, builtin_important: 0, builtin_verify: 5 };
      if (Object.hasOwn(builtins, id)) return TAG_COLORS[builtins[id]];
      let hash = 0;
      for (const character of id) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
      return TAG_COLORS[hash % TAG_COLORS.length];
    }

    const resolvedTagColor = (color, id) => {
      const legacy = typeof color === 'string' ? color.toLowerCase() : '';
      return normalizeTagColor(color)
        ?? (Object.hasOwn(oldColors, legacy) ? oldColors[legacy] : undefined)
        ?? defaultTagColor(id);
    };

    return { TAG_COLORS, normalizeTagColor, isTagColor, defaultTagColor, resolvedTagColor };
    })();

    const { notebookSchema } = (() => {
    // Strict, pure product-shaped Snapshot validator. These are conservative
    // interim field ceilings, not an approved whole-database/storage quota.
    const bad = () => { throw Object.assign(new Error('INVALID_SNAPSHOT'), { code: 'VALIDATION_FAILED' }); };
    const record = value => value && typeof value === 'object' && !Array.isArray(value)
      && [Object.prototype, null].includes(Object.getPrototypeOf(value));
    function jsonShape(value, ancestors = new Set(), depth = 0) {
      if (depth > 16) bad();
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
      if (typeof value === 'number') { if (!Number.isFinite(value)) bad(); return; }
      if (!value || typeof value !== 'object' || (!Array.isArray(value) && !record(value))
        || ancestors.has(value) || Reflect.ownKeys(value).some(key => typeof key !== 'string'
          || (Array.isArray(value) && key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key)
            || Number(key) >= value.length)))) bad();
      ancestors.add(value);
      if (Array.isArray(value) && Object.keys(value).length !== value.length) bad();
      for (const key of Object.keys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) bad();
        jsonShape(descriptor.value, ancestors, depth + 1);
      }
      // JSON.stringify ignores non-enumerable own properties; reject them before
      // structuredClone can silently remove them from an incoming object.
      if (!Array.isArray(value) && Reflect.ownKeys(value).length !== Object.keys(value).length) bad();
      ancestors.delete(value);
    }
    function fields(value, allowed, required = []) {
      if (!record(value) || Object.keys(value).some(key => !allowed.includes(key))
        || required.some(key => !Object.hasOwn(value, key))) bad();
    }
    function text(value, max = 100000) { if (typeof value !== 'string' || [...value].length > max) bad(); }
    function id(value) {
      if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)
        || ['__proto__', 'constructor', 'prototype'].includes(value)) bad();
    }
    function integer(value, min = 0) { if (!Number.isSafeInteger(value) || value < min) bad(); }
    function date(value) {
      if (typeof value !== 'string'
        || !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)
        || !Number.isFinite(Date.parse(value))) bad();
      const [year, month, day] = value.slice(0, 10).split('-').map(Number);
      if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) bad();
    }
    function ids(value, max) {
      if (!Array.isArray(value) || value.length > max || new Set(value).size !== value.length) bad();
      value.forEach(id);
    }
    function validSelection(value) {
      // Same non-whitespace code-point minimum as selection preparation.
      let effective = 0;
      for (const point of value) {
        if (!/\s/u.test(point) && ++effective >= 2) return true;
      }
      return false;
    }

    const notebookSchema = {
      safeParse(value) { try { return { success: true, data: this.parse(value) }; } catch { return { success: false }; } },
      parse(input) {
        jsonShape(input);
        let value;
        try { value = structuredClone(input); } catch { bad(); }
        jsonShape(value);
        fields(value, ['schemaVersion', 'epoch', 'revision', 'notes', 'tags', 'settings', 'operationReceipts'],
          ['schemaVersion', 'epoch', 'revision', 'notes', 'tags', 'settings', 'operationReceipts']);
        if (value.schemaVersion !== 1) bad(); id(value.epoch); integer(value.revision);
        fields(value.settings, ['quickTagIds', 'maxQuoteLength'],
          ['quickTagIds', 'maxQuoteLength']);
        integer(value.settings.maxQuoteLength, 2);
        if (value.settings.maxQuoteLength > 8000) bad();
        ids(value.settings.quickTagIds, 100);
        if (!record(value.tags) || !record(value.notes) || !record(value.operationReceipts)) bad();
        const names = new Set();
        for (const [key, tag] of Object.entries(value.tags)) {
          id(key);
          fields(tag, ['id', 'schemaVersion', 'name', 'normalizedKey', 'color', 'isBuiltin', 'createdAt', 'updatedAt', 'deletedAt', 'version'],
            ['id', 'schemaVersion', 'name', 'normalizedKey', 'createdAt', 'updatedAt', 'version']);
          if (tag.id !== key || tag.schemaVersion !== 1) bad();
          text(tag.name, 32); if (!tag.name.trim() || tag.name !== tag.name.trim()) bad();
          const normalized = tag.name.normalize('NFKC').trim().toLowerCase();
          if (tag.normalizedKey !== normalized || (!tag.deletedAt && names.has(normalized))) bad();
          if (!tag.deletedAt) names.add(normalized);
          if (tag.isBuiltin !== undefined && typeof tag.isBuiltin !== 'boolean') bad();
          if (tag.color !== undefined) text(tag.color, 64);
          date(tag.createdAt); date(tag.updatedAt); if (tag.deletedAt !== undefined) date(tag.deletedAt);
          integer(tag.version, 1);
        }
        const liveTag = key => { if (!Object.hasOwn(value.tags, key) || value.tags[key].deletedAt) bad(); };
        value.settings.quickTagIds.forEach(liveTag);
        for (const [key, note] of Object.entries(value.notes)) {
          id(key);
          fields(note, ['id', 'schemaVersion', 'kind', 'title', 'bodyMarkdown', 'quote', 'anchor', 'source', 'tagIds', 'createdBy', 'createdAt', 'updatedAt', 'deletedAt', 'version'],
            ['id', 'schemaVersion', 'kind', 'tagIds', 'createdBy', 'createdAt', 'updatedAt', 'version']);
          if (note.id !== key || note.schemaVersion !== 1 || !['highlight', 'note', 'manual'].includes(note.kind)
            || !['user', 'agent'].includes(note.createdBy)) bad();
          if (note.title !== undefined) text(note.title, 1000);
          if (note.bodyMarkdown !== undefined) text(note.bodyMarkdown);
          const hasBody = typeof note.bodyMarkdown === 'string' && !!note.bodyMarkdown.trim();
          if (note.kind === 'highlight' && note.bodyMarkdown !== undefined && note.bodyMarkdown !== '') bad();
          if (note.kind !== 'highlight' && !hasBody) bad();
          if (note.quote !== undefined) {
            fields(note.quote, ['format', 'content'], ['format', 'content']);
            if (!['plain_text', 'markdown'].includes(note.quote.format)) bad();
            text(note.quote.content, value.settings.maxQuoteLength); if (!note.quote.content.trim()) bad();
          } else if (note.kind !== 'manual') bad();
          if (note.anchor !== undefined) {
            if (!note.quote) bad();
            fields(note.anchor, ['exact', 'prefix', 'suffix', 'startOffset', 'endOffset', 'occurrence', 'markdownStartOffset', 'markdownEndOffset'], ['exact']);
            text(note.anchor.exact, value.settings.maxQuoteLength);
            if (!note.anchor.exact.trim() || !validSelection(note.anchor.exact)) bad();
            for (const field of ['prefix', 'suffix']) if (note.anchor[field] !== undefined) text(note.anchor[field], 1000);
            for (const [a, b] of [['startOffset', 'endOffset'], ['markdownStartOffset', 'markdownEndOffset']]) {
              if ((note.anchor[a] === undefined) !== (note.anchor[b] === undefined)) bad();
              if (note.anchor[a] !== undefined) {
                integer(note.anchor[a]); integer(note.anchor[b]);
                // Source and Markdown spans are UTF-16 offsets; neither may be
                // empty, and a visible-text span must cover the stored exact text.
                if (note.anchor[b] <= note.anchor[a]
                  || (a === 'startOffset' && note.anchor[b] - note.anchor[a] !== note.anchor.exact.length)) bad();
              }
            }
            if (note.anchor.occurrence !== undefined) integer(note.anchor.occurrence);
          }
          if (note.source !== undefined) {
            fields(note.source, ['sessionId', 'sessionTitle', 'messageId', 'messageRole', 'workspacePath', 'workspaceTitle', 'sessionState']);
            for (const field of ['sessionId', 'sessionTitle', 'messageId', 'workspacePath', 'workspaceTitle'])
              if (note.source[field] !== undefined) text(note.source[field], 4096);
            if (note.source.messageRole !== undefined && !['user', 'assistant', 'tool', 'system'].includes(note.source.messageRole)) bad();
            if (note.source.sessionState !== undefined && !['active', 'archived', 'deleted', 'unavailable', 'unknown'].includes(note.source.sessionState)) bad();
          }
          ids(note.tagIds, 10); note.tagIds.forEach(liveTag);
          date(note.createdAt); date(note.updatedAt); if (note.deletedAt !== undefined) date(note.deletedAt);
          integer(note.version, 1);
        }
        if (Object.keys(value.operationReceipts).length > 100000) bad();
        for (const [key, receipt] of Object.entries(value.operationReceipts)) {
          id(key); fields(receipt, ['payloadHash', 'resultNoteId', 'committedRevision'], ['payloadHash', 'committedRevision']);
          if (typeof receipt.payloadHash !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.payloadHash)) bad();
          integer(receipt.committedRevision); if (receipt.committedRevision > value.revision) bad();
          if (receipt.resultNoteId !== undefined) id(receipt.resultNoteId);
        }
        return value;
      },
    };

    return { notebookSchema };
    })();

    const { DEFAULT_BACKUP_BYTES, inspectBackupJson, previewBackupReplacement } = ((notebookSchema) => {

    // Pure serialization/preview only: no file IO, mutation, token issuance,
    // medium protection or restore. Callers must check byte length BEFORE reading
    // an untrusted file and must not treat a preview as permission to commit.
    const DEFAULT_BACKUP_BYTES = 50 * 1024 * 1024;
    const BACKUP_VERSION = 1;
    const fail = code => { throw Object.assign(new Error(code), { code }); };
    function limitBytes(maxBytes) {
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) fail('INVALID_LIMIT');
    }
    function backupJson(snapshot, { maxBytes = DEFAULT_BACKUP_BYTES } = {}) {
      limitBytes(maxBytes);
      const value = notebookSchema.parse(snapshot);
      const content = JSON.stringify({ format: 'dsh-session-notebook-backup', backupVersion: BACKUP_VERSION, snapshot: value });
      const bytes = new TextEncoder().encode(content).byteLength;
      if (bytes > maxBytes) fail('BACKUP_TOO_LARGE');
      return { content, bytes, revision: value.revision };
    }

    /** Caller passes the independently measured file size before loading bytes. */
    function inspectBackupJson(content, { declaredBytes, maxBytes = DEFAULT_BACKUP_BYTES } = {}) {
      limitBytes(maxBytes);
      if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0 || declaredBytes > maxBytes)
        fail('BACKUP_TOO_LARGE');
      if (typeof content !== 'string') fail('INVALID_BACKUP');
      const bytes = new TextEncoder().encode(content).byteLength;
      if (bytes !== declaredBytes || bytes > maxBytes) fail('BACKUP_TOO_LARGE');
      let decoded;
      try { decoded = JSON.parse(content); } catch { fail('INVALID_BACKUP'); }
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)
        || Object.keys(decoded).length !== 3 || decoded.format !== 'dsh-session-notebook-backup'
        || decoded.backupVersion !== BACKUP_VERSION || !Object.hasOwn(decoded, 'snapshot')) fail('UNSUPPORTED_BACKUP');
      const value = notebookSchema.parse(decoded.snapshot);
      const notes = Object.values(value.notes);
      return { snapshot: value, summary: {
        backupVersion: decoded.backupVersion, schemaVersion: value.schemaVersion, revision: value.revision,
        noteCount: notes.length, trashedCount: notes.filter(note => !!note.deletedAt).length,
        tagCount: Object.values(value.tags).filter(tag => !tag.deletedAt).length,
      } };
    }

    /** Read-only impact counts. Never a confirmation token or restore authorization. */
    function previewBackupReplacement(current, inspected) {
      const existing = notebookSchema.parse(current);
      if (!inspected || !Object.hasOwn(inspected, 'snapshot')
        || inspected.summary?.backupVersion !== BACKUP_VERSION) fail('INVALID_BACKUP');
      const incoming = notebookSchema.parse(inspected.snapshot);
      const oldIds = new Set(Object.keys(existing.notes));
      const newIds = new Set(Object.keys(incoming.notes));
      const oldTags = new Set(Object.keys(existing.tags));
      const newTags = new Set(Object.keys(incoming.tags));
      return {
        mode: 'replace-whole-library',
        current: { epoch: existing.epoch, revision: existing.revision,
          notes: oldIds.size, trashed: Object.values(existing.notes).filter(note => !!note.deletedAt).length,
          tags: oldTags.size },
        backup: { backupVersion: inspected.summary.backupVersion,
          schemaVersion: incoming.schemaVersion, notes: newIds.size,
          trashed: Object.values(incoming.notes).filter(note => !!note.deletedAt).length, tags: newTags.size },
        impact: { notesRemoved: [...oldIds].filter(id => !newIds.has(id)).length,
          notesReplaced: [...oldIds].filter(id => newIds.has(id)).length,
          notesAdded: [...newIds].filter(id => !oldIds.has(id)).length,
          tagsRemoved: [...oldTags].filter(id => !newTags.has(id)).length,
          tagsReplaced: [...oldTags].filter(id => newTags.has(id)).length,
          tagsAdded: [...newTags].filter(id => !oldTags.has(id)).length },
      };
    }

    return { DEFAULT_BACKUP_BYTES, BACKUP_VERSION, backupJson, inspectBackupJson, previewBackupReplacement };
    })(notebookSchema);

    const { downloadTimestamp } = (() => {
    /** File suffix in the user's local time: YYYYMMDDHHmmss. */
    function downloadTimestamp(date = new Date()) {
      if (!(date instanceof Date) || !Number.isFinite(date.getTime())
        || date.getFullYear() < 0 || date.getFullYear() > 9999)
        throw Object.assign(new Error('INVALID_DOWNLOAD_TIME'), { code: 'INVALID_DOWNLOAD_TIME' });
      const pad = (value, width = 2) => String(value).padStart(width, '0');
      return pad(date.getFullYear(), 4) + [date.getMonth() + 1, date.getDate(), date.getHours(),
        date.getMinutes(), date.getSeconds()].map(value => pad(value)).join('');
    }

    return { downloadTimestamp };
    })();

    const { readBackupFile, backupFile, downloadBackupFile } = ((inspectBackupJson, DEFAULT_BACKUP_BYTES, downloadTimestamp) => {

    const fail = () => { throw Object.assign(new Error('INVALID_BACKUP'), { code: 'INVALID_BACKUP' }); };
    const failure = code => { throw Object.assign(new Error(code), { code }); };

    /** Reject an oversized local file before loading any of its bytes into memory. */
    async function readBackupFile(file, { maxBytes = DEFAULT_BACKUP_BYTES, signal } = {}) {
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !(file instanceof Blob)
        || !Number.isSafeInteger(file.size) || file.size < 0) fail();
      if (file.size > maxBytes) failure('BACKUP_TOO_LARGE');
      if (signal?.aborted) failure('CANCELLED');
      const reading = file.text();
      let content;
      if (signal) {
        let rejectCancelled;
        const cancelled = new Promise((_resolve, reject) => { rejectCancelled = reject; });
        const onAbort = () => rejectCancelled(Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' }));
        signal.addEventListener('abort', onAbort, { once: true });
        try {
          if (signal.aborted) onAbort();
          content = await Promise.race([reading, cancelled]);
        } finally { signal.removeEventListener('abort', onAbort); }
      } else content = await reading;
      if (signal?.aborted) failure('CANCELLED');
      return inspectBackupJson(content, { declaredBytes: file.size, maxBytes });
    }

    /** Build a complete UTF-8 JSON file without modifying the live Notebook. */
    function backupFile(backup, { maxBytes = DEFAULT_BACKUP_BYTES, date = new Date() } = {}) {
      if (!backup || typeof backup !== 'object' || Array.isArray(backup)
        || typeof backup.content !== 'string' || !Number.isSafeInteger(backup.bytes)
        || !Number.isSafeInteger(backup.revision)) fail();
      // inspectBackupJson validates byte length, complete format and every field and association.
      const inspected = inspectBackupJson(backup.content, { declaredBytes: backup.bytes, maxBytes });
      if (inspected.snapshot.revision !== backup.revision) fail();
      return { filename: `dsh-session-notebook-rev-${backup.revision}-${downloadTimestamp(date)}.json`,
        blob: new Blob([backup.content], { type: 'application/json;charset=utf-8' }), bytes: backup.bytes };
    }

    /** The caller owns its trusted document and must invoke this from a user action. */
    function downloadBackupFile(file, { document, URL } = {}) {
      if (!file || typeof file.filename !== 'string' || !/^dsh-session-notebook-rev-\d+-\d{14}\.json$/.test(file.filename)
        || !(file.blob instanceof Blob) || file.blob.type !== 'application/json;charset=utf-8'
        || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > DEFAULT_BACKUP_BYTES
        || file.blob.size !== file.bytes
        || typeof document?.createElement !== 'function' || typeof URL?.createObjectURL !== 'function'
        || typeof URL?.revokeObjectURL !== 'function') fail();
      const anchor = document.createElement('a');
      if (typeof anchor?.click !== 'function') fail();
      const href = URL.createObjectURL(file.blob);
      try {
        anchor.href = href;
        anchor.download = file.filename;
        anchor.click();
      } finally {
        URL.revokeObjectURL(href);
      }
    }

    return { readBackupFile, backupFile, downloadBackupFile };
    })(inspectBackupJson, DEFAULT_BACKUP_BYTES, downloadTimestamp);

    const { stageBackupFile } = ((readBackupFile) => {

    const CHUNK_BYTES = 128 * 1024;
    const fail = code => { throw Object.assign(new Error(code), { code }); };
    const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

    function base64(bytes) {
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return globalThis.btoa(binary);
    }

    async function cancellable(promise, signal) {
      if (signal.aborted) fail('CANCELLED');
      let rejectCancelled;
      const cancelled = new Promise((_resolve, reject) => { rejectCancelled = reject; });
      const onAbort = () => rejectCancelled(Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' }));
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        if (signal.aborted) onAbort();
        return await Promise.race([promise, cancelled]);
      } finally { signal.removeEventListener('abort', onAbort); }
    }

    /** Validate locally, then have the admitted Host validate the same file again.
     * Retries use one uploadId and resume from the Host's reported byte offset. */
    async function stageBackupFile(file, api, { uploadId, signal, onToken } = {}) {
      if (!(file instanceof Blob) || !id(uploadId) || !signal || typeof api?.backupBegin !== 'function'
        || typeof api.backupChunk !== 'function' || typeof api.backupFinish !== 'function'
        || typeof api.backupPreview !== 'function' || (onToken !== undefined && typeof onToken !== 'function'))
        fail('INVALID_BACKUP');
      await readBackupFile(file, { signal });
      if (signal.aborted) fail('CANCELLED');
      const count = Math.ceil(file.size / CHUNK_BYTES);
      const started = await api.backupBegin({ uploadId, bytes: file.size }, signal);
      if (!id(started?.token) || !Number.isSafeInteger(started.nextIndex)
        || started.nextIndex < 0 || started.nextIndex > count
        || started.receivedBytes !== Math.min(started.nextIndex * CHUNK_BYTES, file.size))
        fail('INVALID_RESPONSE');
      onToken?.(started.token);
      for (let index = started.nextIndex; index < count; index++) {
        if (signal.aborted) fail('CANCELLED');
        const end = Math.min((index + 1) * CHUNK_BYTES, file.size);
        const part = new Uint8Array(await cancellable(file.slice(index * CHUNK_BYTES, end).arrayBuffer(), signal));
        if (part.byteLength !== end - index * CHUNK_BYTES) fail('INVALID_BACKUP');
        const receipt = await api.backupChunk({ token: started.token, index, base64: base64(part) }, signal);
        if (receipt?.token !== started.token || receipt.nextIndex !== index + 1
          || receipt.receivedBytes !== end) fail('INVALID_RESPONSE');
      }
      const finished = await api.backupFinish({ token: started.token }, signal);
      if (finished?.token !== started.token || finished.receivedBytes !== file.size
        || finished.nextIndex !== count) fail('INVALID_RESPONSE');
      const preview = await api.backupPreview({ token: started.token }, signal);
      if (preview?.token !== started.token) fail('INVALID_RESPONSE');
      return { token: started.token, summary: finished.summary, preview };
    }

    return { stageBackupFile };
    })(readBackupFile);

    const { markdownFile, downloadMarkdownFile } = ((downloadTimestamp) => {
    const fail = () => { throw Object.assign(new Error('INVALID_MARKDOWN_FILE'),
      { code: 'INVALID_MARKDOWN_FILE' }); };
    const MAX_MARKDOWN_FILE_BYTES = 8 * 1024 * 1024;

    /** Convert a validated Host export to one UTF-8 Markdown file. */
    function markdownFile(value, { date = new Date() } = {}) {
      if (!value || typeof value !== 'object' || Array.isArray(value)
        || !Number.isSafeInteger(value.revision) || value.revision < 0
        || !Number.isSafeInteger(value.count) || value.count < 1
        || typeof value.content !== 'string' || !Number.isSafeInteger(value.bytes)
        || value.bytes < 1 || value.bytes > MAX_MARKDOWN_FILE_BYTES
        || new TextEncoder().encode(value.content).byteLength !== value.bytes) fail();
      return { filename: `dsh-session-notebook-rev-${value.revision}-${downloadTimestamp(date)}.md`,
        blob: new Blob([value.content], { type: 'text/markdown;charset=utf-8' }), bytes: value.bytes };
    }

    /** The caller supplies its trusted document and calls this only for a user action. */
    function downloadMarkdownFile(file, { document, URL } = {}) {
      if (!file || typeof file.filename !== 'string'
        || !/^dsh-session-notebook-rev-\d+-\d{14}\.md$/.test(file.filename)
        || !(file.blob instanceof Blob) || file.blob.type !== 'text/markdown;charset=utf-8'
        || !Number.isSafeInteger(file.bytes) || file.bytes < 1
        || file.bytes > MAX_MARKDOWN_FILE_BYTES || file.blob.size !== file.bytes
        || typeof document?.createElement !== 'function'
        || typeof URL?.createObjectURL !== 'function'
        || typeof URL?.revokeObjectURL !== 'function') fail();
      const anchor = document.createElement('a');
      if (typeof anchor?.click !== 'function') fail();
      const href = URL.createObjectURL(file.blob);
      try {
        anchor.href = href; anchor.download = file.filename; anchor.click();
      } finally { URL.revokeObjectURL(href); }
    }

    return { MAX_MARKDOWN_FILE_BYTES, markdownFile, downloadMarkdownFile };
    })(downloadTimestamp);

    const { currentInput, writeInput } = (() => {
    const unavailable = () => ({ ok: false, code: 'INPUT_UNAVAILABLE' });
    const changed = () => ({ ok: false, code: 'INPUT_CHANGED' });
    const invalid = () => ({ ok: false, code: 'INPUT_INVALID' });
    const MAX_INPUT_INSERT_BYTES = 256 * 1024;
    const reserved = /[\uE100-\uE11D\uFFFC]/u;

    /** Read only the current, matching Session's public standard input source. */
    function currentInput(uiSession, sessionId) {
      if (typeof sessionId !== 'string' || !sessionId) return null;
      try {
        const binding = uiSession?.adapter?.current?.getSnapshot?.();
        if (binding?.key !== sessionId) return null;
        const state = binding.hooks?.input?.getSnapshot?.();
        const actions = binding.props?.inputActions;
        if (!state || typeof state.draft !== 'string' || !Number.isSafeInteger(state.draftRev)
          || !Array.isArray(state.occurrences) || !Array.isArray(state.attachmentIds)
          || typeof actions?.insertText !== 'function') return null;
        return { state, actions };
      } catch { return null; }
    }

    function detectEnd(state) {
      let position = 0, removed = 0;
      for (const occurrence of state.occurrences) {
        if (!Number.isSafeInteger(occurrence?.offset) || occurrence.offset < position
          || !Number.isSafeInteger(occurrence.length) || occurrence.length < 1
          || occurrence.offset + occurrence.length > state.draft.length
          || state.draft.slice(occurrence.offset, occurrence.offset + occurrence.length)
            !== occurrence.clipboardText) return null;
        position = occurrence.offset + occurrence.length;
        removed += occurrence.length - 1;
      }
      return state.draft.length - removed;
    }

    /** One guarded, undoable edit. The caller confirms against the latest draft before this call. */
    function writeInput(uiSession, sessionId, content, mode, expected) {
      if (typeof content !== 'string' || !content || reserved.test(content)
        || new TextEncoder().encode(content).byteLength > MAX_INPUT_INSERT_BYTES
        || !['append', 'replace'].includes(mode)) return invalid();
      const current = currentInput(uiSession, sessionId);
      if (!current || !['plain', 'claimed'].includes(current.state.phase)) return unavailable();
      const { state, actions } = current;
      if (state.draftRev !== expected?.draftRev || state.draft !== expected?.draft) return changed();
      const end = detectEnd(state);
      if (end === null) return unavailable();
      if (mode === 'replace' && (state.occurrences.length || state.attachmentIds.length)) return unavailable();
      const text = mode === 'append' && state.draft
        ? `${state.draft.endsWith('\n') ? '\n' : '\n\n'}${content}` : content;
      const span = mode === 'replace'
        ? { start: 0, end, draftRev: state.draftRev }
        : { start: end, end, draftRev: state.draftRev };
      try { return actions.insertText(text, span) === true ? { ok: true } : unavailable(); }
      catch { return unavailable(); }
    }

    return { MAX_INPUT_INSERT_BYTES, currentInput, writeInput };
    })();

    const { messageTextIndex, foldedTextMap } = (() => {
    // Standard DOM operations for one caller-verified message body only. This
    // module cannot discover a message, authenticate its identity, or save a quote.
    const blockTags = new Set(['P', 'DIV', 'PRE', 'LI', 'UL', 'OL', 'BLOCKQUOTE',
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'TR']);
    const excludedTags = new Set(['SCRIPT', 'STYLE', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']);
    const fail = code => { throw Object.assign(new Error(code), { code }); };

    function messageTextIndex(root, { maxTextUnits = 1024 * 1024, maxNodes = 50000 } = {}) {
      if (root?.nodeType !== 1 || typeof root.ownerDocument?.createRange !== 'function'
        || !Number.isSafeInteger(maxTextUnits) || maxTextUnits < 1
        || !Number.isSafeInteger(maxNodes) || maxNodes < 1) fail('INVALID_TEXT_ROOT');
      let text = '', pendingGap = false, count = 0;
      const segments = [], boundaries = new Map(), extents = new Map(), tree = [];
      const append = value => {
        if (text.length + value.length > maxTextUnits) fail('TEXT_INDEX_LIMIT');
        text += value;
      };
      const walk = (node, depth = 0) => {
        if (++count > maxNodes || depth > 256) fail('TEXT_INDEX_LIMIT');
        tree.push({ node, children: Array.from(node.childNodes ?? []), value: node.data });
        if (node.nodeType === 3) {
          const value = node.data;
          if (value) {
            if (pendingGap && text && !text.endsWith('\n') && !value.startsWith('\n')) append('\n');
            pendingGap = false;
          }
          const start = text.length;
          append(value);
          segments.push({ node, start, end: text.length, value });
          if (value) extents.set(node, { start, end: text.length });
          return;
        }
        if (node.nodeType !== 1 || excludedTags.has(node.tagName)) return;
        const block = node !== root && blockTags.has(node.tagName);
        if (block) pendingGap = true;
        if (node.tagName === 'BR') {
          append('\n'); pendingGap = false; boundaries.set(node, [text.length - 1]); return;
        }
        const offsets = [text.length], before = segments.length;
        for (const child of node.childNodes) { walk(child, depth + 1); offsets.push(text.length); }
        boundaries.set(node, offsets);
        const nonempty = segments.slice(before).filter(entry => entry.end > entry.start);
        if (nonempty.length) extents.set(node, { start: nonempty[0].start, end: nonempty.at(-1).end });
        if (block) pendingGap = true;
      };
      walk(root);
      // Capture and relocation use this same DOM-backed stream. A whole-body
      // innerText comparison is unsafe: message controls can add unrelated text.
      const segmentFor = new Map(segments.map(entry => [entry.node, entry]));
      const current = () => {
        if (root.isConnected === false || tree.some(({ node, children, value }) =>
          node.data !== value || (node.childNodes?.length ?? 0) !== children.length
          || children.some((child, index) => node.childNodes[index] !== child))) fail('STALE_TEXT_INDEX');
      };
      const offset = (node, local, end) => {
        if (!Number.isSafeInteger(local) || local < 0) fail('UNMAPPABLE_RANGE');
        const segment = segmentFor.get(node);
        if (segment && local <= segment.value.length) return segment.start + local;
        const offsets = boundaries.get(node);
        if (offsets && local < offsets.length) {
          const extent = extents.get(node.childNodes[end ? local - 1 : local]);
          return extent ? end ? extent.end : extent.start : offsets[local];
        }
        fail('UNMAPPABLE_RANGE');
      };
      const point = (position, end) => {
        // At a shared boundary, start belongs to the following node and end to
        // the preceding one. Synthetic block gaps cannot become Range endpoints.
        const entry = end
          ? segments.find(part => part.start < position && position <= part.end)
          : segments.find(part => part.start <= position && position < part.end);
        if (!entry) fail('UNMAPPABLE_RANGE');
        return { node: entry.node, offset: position - entry.start };
      };
      return {
        text, nodes: segments.map(entry => entry.node),
        selection(range, exact) {
          current();
          if (!range || typeof exact !== 'string') fail('UNMAPPABLE_RANGE');
          const startOffset = offset(range.startContainer, range.startOffset, false);
          const endOffset = offset(range.endContainer, range.endOffset, true);
          const indexed = text.slice(startOffset, endOffset);
          if (startOffset >= endOffset || (indexed !== exact
            && foldedTextMap(indexed).text !== foldedTextMap(exact).text)) fail('UNMAPPABLE_RANGE');
          return { exact, sourceText: text, startOffset, endOffset,
            ...(indexed !== exact ? { normalized: true } : {}) };
        },
        range(startOffset, endOffset) {
          current();
          if (!Number.isSafeInteger(startOffset) || !Number.isSafeInteger(endOffset)
            || startOffset < 0 || endOffset <= startOffset || endOffset > text.length)
            fail('UNMAPPABLE_RANGE');
          const start = point(startOffset, false), end = point(endOffset, true);
          const range = root.ownerDocument.createRange();
          range.setStart(start.node, start.offset); range.setEnd(end.node, end.offset);
          return range;
        },
      };
    }

    // Whitespace folding is a derived lookup only. Raw text and quote stay intact.
    function foldedTextMap(text) {
      if (typeof text !== 'string') fail('INVALID_TEXT');
      let folded = '';
      const starts = [], ends = [];
      for (let offset = 0; offset < text.length;) {
        const start = offset;
        if (/\s/u.test(text[offset])) {
          while (offset < text.length && /\s/u.test(text[offset])) offset++;
          folded += ' '; starts.push(start); ends.push(offset);
        } else {
          folded += text[offset++]; starts.push(start); ends.push(offset);
        }
      }
      return { text: folded,
        rawRange(start, end) {
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
            || start < 0 || end <= start || end > folded.length) fail('UNMAPPABLE_RANGE');
          return { startOffset: starts[start], endOffset: ends[end - 1] };
        } };
    }

    return { messageTextIndex, foldedTextMap };
    })();

    const { locateTextAnchor } = ((foldedTextMap) => {

    // Pure locator for one caller-verified, mounted message text block. Offsets
    // are UTF-16 code units of that block; this function does not inspect the DOM,
    // authenticate a messageId, or install browser highlights.
    function locateTextAnchor(text, anchor) {
      if (typeof text !== 'string' || !anchor || typeof anchor.exact !== 'string' || !anchor.exact.length) {
        return { status: 'invalid' };
      }
      const { exact, startOffset, endOffset, prefix, suffix, occurrence } = anchor;
      const hasStart = startOffset !== undefined;
      const hasEnd = endOffset !== undefined;
      if (hasStart !== hasEnd || (hasStart && (!Number.isSafeInteger(startOffset)
        || !Number.isSafeInteger(endOffset) || startOffset < 0 || endOffset <= startOffset))) {
        return { status: 'invalid' };
      }
      if ((prefix !== undefined && typeof prefix !== 'string')
        || (suffix !== undefined && typeof suffix !== 'string')
        || (occurrence !== undefined && (!Number.isSafeInteger(occurrence) || occurrence < 0))) {
        return { status: 'invalid' };
      }
      const matchesContext = position =>
        (prefix === undefined || (position >= prefix.length
          && text.slice(position - prefix.length, position) === prefix))
        && (suffix === undefined || (position + exact.length + suffix.length <= text.length
          && text.slice(position + exact.length, position + exact.length + suffix.length) === suffix));
      // An old offset is only a hint. Repeated matching contexts cannot identify
      // the original occurrence after source text changes.
      const hasContext = (typeof prefix === 'string' && prefix.length > 0)
        || (typeof suffix === 'string' && suffix.length > 0);
      const hits = [];
      for (let position = text.indexOf(exact); position !== -1; position = text.indexOf(exact, position + 1)) {
        hits.push(position);
      }
      if (!hits.length) {
        // Selection.toString() and innerText can differ in paragraph/list line
        // breaks. Fold only for lookup; keep the user's exact quote unchanged.
        const folded = foldedTextMap(text), target = foldedTextMap(exact).text;
        if (!target) return { status: 'missing' };
        const before = prefix === undefined ? undefined : foldedTextMap(prefix).text;
        const after = suffix === undefined ? undefined : foldedTextMap(suffix).text;
        const candidates = [];
        for (let position = folded.text.indexOf(target); position !== -1;
          position = folded.text.indexOf(target, position + 1)) {
          const raw = folded.rawRange(position, position + target.length);
          candidates.push({ ...raw, position,
            context: (before === undefined || (position >= before.length
              && folded.text.slice(position - before.length, position) === before))
              && (after === undefined || folded.text.slice(position + target.length,
                position + target.length + after.length) === after) });
        }
        if (!candidates.length) return { status: 'missing' };
        const contextual = candidates.filter(candidate => candidate.context);
        if ((prefix !== undefined || suffix !== undefined) && contextual.length === 1) {
          const { startOffset, endOffset } = contextual[0];
          return { status: 'found', startOffset, endOffset, match: 'folded-context' };
        }
        if (contextual.length > 1 || candidates.length > 1) return { status: 'ambiguous' };
        if (prefix !== undefined || suffix !== undefined || (occurrence !== undefined && occurrence !== 0))
          return { status: 'missing' };
        const { startOffset, endOffset } = candidates[0];
        return { status: 'found', startOffset, endOffset, match: 'folded-unique' };
      }
      if (prefix !== undefined || suffix !== undefined) {
        const contextual = hits.filter(matchesContext);
        if (contextual.length === 1) {
          const position = contextual[0];
          return { status: 'found', startOffset: position, endOffset: position + exact.length,
            match: hasStart && hasContext && position === startOffset && endOffset === position + exact.length
              ? 'offset' : 'context' };
        }
        if (contextual.length > 1) return { status: 'ambiguous' };
      }
      // An occurrence ordinal without a verified unchanged text snapshot cannot
      // distinguish shifted duplicate phrases; never highlight one arbitrarily.
      if (prefix === undefined && suffix === undefined && hits.length === 1) {
        if (occurrence !== undefined && occurrence !== 0) return { status: 'missing' };
        return { status: 'found', startOffset: hits[0], endOffset: hits[0] + exact.length, match: 'unique' };
      }
      return { status: hits.length > 1 ? 'ambiguous' : 'missing' };
    }

    return { locateTextAnchor };
    })(foldedTextMap);

    const { conversationAnnotations, renderedConversationBodies } = ((messageTextIndex, locateTextAnchor) => {

    const error = code => Object.assign(new Error(code), { code });
    const excluded = 'input,textarea,select,button,a,[contenteditable="true"],[role="textbox"],[data-lexical-editor],.monaco-editor,.cm-editor,[data-notebook-library],[data-notebook-overlay],[data-notebook-annotations],[data-turn-process-inline]';

    // The caller supplies bodies verified against the installed target renderer.
    // DOM text anchors identify rendered text only; they do not assert message IDs.
    function conversationAnnotations({ document, sessionId, readBodies, api, createRequestId,
      registry, Highlight, MutationObserver, initialDraft = null, source = { sessionId }, onChange = () => {}, timeoutMs = 10000 }) {
      if (!document || typeof sessionId !== 'string' || !sessionId || typeof readBodies !== 'function'
        || typeof api?.anchors !== 'function' || typeof api?.library !== 'function' || typeof api?.notesGet !== 'function'
        || typeof api?.excerpt !== 'function' || typeof createRequestId !== 'function') throw error('INVALID_CONFIG');
      let alive = true, generation = 0, busy = false, owned = null, records = [], observer;
      let located = [], detailGeneration = 0;
      let state = { draft: initialDraft?.draft ?? null, pending: initialDraft?.pending ?? null,
        bodyMarkdown: initialDraft?.bodyMarkdown ?? '', tagIds: initialDraft?.tagIds ?? [], newTagName: initialDraft?.newTagName ?? '', status: 'loading', diagnostic: null, items: [], candidates: [], detail: null };
      const requests = new Set();
      const name = `dsh-notebook-annotations-${createRequestId()}`;
      if (!/^dsh-notebook-[a-z0-9-]{1,64}$/.test(name)) throw error('INVALID_CONFIG');
      const publish = change => { if (alive) { state = { ...state, ...change }; onChange({ ...state }); } };
      const clear = () => {
        if (owned && registry?.get(name) === owned) registry.delete(name);
        owned = null; located = [];
      };
      const bodies = () => Array.from(readBodies()).filter(body => body?.isConnected !== false);
      const locate = () => {
        clear();
        if (!alive) return;
        const indexes = bodies().map(root => { try { return messageTextIndex(root); } catch { return null; } }).filter(Boolean);
        const ranges = [], items = records.map(note => {
          const matches = [];
          let ambiguous = false;
          for (const index of indexes) {
            const result = locateTextAnchor(index.text, note.anchor);
            if (result.status === 'ambiguous') ambiguous = true;
            if (result.status === 'found') matches.push({ index, result });
          }
          if (ambiguous || matches.length > 1) return { id: note.id, status: 'ambiguous' };
          if (!matches.length) return { id: note.id, status: 'unloaded-or-changed' };
          try {
            const range = matches[0].index.range(matches[0].result.startOffset, matches[0].result.endOffset);
            if (typeof range.getClientRects === 'function' && !range.getClientRects().length)
              return { id: note.id, status: 'unloaded-or-changed' };
            ranges.push(range); located.push({ id: note.id, range, index: matches[0].index, exact: note.anchor.exact });
            return { id: note.id, status: typeof Highlight === 'function' && registry ? 'found' : 'highlight-unavailable' };
          } catch { return { id: note.id, status: 'unloaded-or-changed' }; }
        });
        if (ranges.length && typeof Highlight === 'function' && registry?.set && registry.get(name) === undefined) {
          owned = new Highlight(...ranges); registry.set(name, owned);
        }
        publish({ items });
      };
      const call = async action => {
        const pending = new AbortController(); requests.add(pending);
        let timedOut = false, rejectAbort;
        const aborted = new Promise((_resolve, reject) => { rejectAbort = reject; });
        const onAbort = () => rejectAbort(error(timedOut ? 'TIMEOUT' : 'CANCELLED'));
        pending.signal.addEventListener('abort', onAbort, { once: true });
        const timer = setTimeout(() => { timedOut = true; pending.abort(); }, timeoutMs);
        try { return await Promise.race([action(pending.signal), aborted]); }
        finally { clearTimeout(timer); pending.signal.removeEventListener('abort', onAbort); requests.delete(pending); }
      };
      const reload = async () => {
        const token = ++generation;
        publish({ status: 'loading', diagnostic: null });
        try {
          const notes = []; const noteIds = new Set(); let snapshot = null;
          for (let offset = 0; ; offset += 50) {
            const page = await call(signal => api.anchors({ sessionId, offset, limit: 50 }, signal));
            if (!alive || token !== generation) return;
            if (!page || !Array.isArray(page.items) || page.items.length > 50 || !Number.isSafeInteger(page.total)
              || page.total < 0 || typeof page.epoch !== 'string' || !Number.isSafeInteger(page.revision)) throw error('INVALID_RESPONSE');
            if (snapshot && (snapshot.epoch !== page.epoch || snapshot.revision !== page.revision || snapshot.total !== page.total)) throw error('VERSION_CONFLICT');
            snapshot ??= { epoch: page.epoch, revision: page.revision, total: page.total };
            for (const row of page.items) {
              if (!row || typeof row.id !== 'string' || !['highlight', 'note'].includes(row.kind)
                || row.source?.sessionId !== sessionId || typeof row.anchor?.exact !== 'string') throw error('INVALID_RESPONSE');
              if (noteIds.has(row.id)) throw error('INVALID_RESPONSE');
              noteIds.add(row.id); notes.push(row);
            }
            if (offset + page.items.length >= page.total) break;
            if (page.items.length !== 50 || offset >= 10000) throw error('READ_UNAVAILABLE');
          }
          records = notes; publish({ status: 'ready' }); locate();
        } catch (failure) {
          if (alive && token === generation) { clear(); records = []; publish({ status: 'failed', diagnostic: failure?.code ?? 'READ_UNAVAILABLE', items: [] }); }
        }
      };
      const capture = () => {
        if (!alive || busy || state.pending) return;
        // A bare selection may move; edited annotations remain bound to their original quote.
        if (state.draft && (state.bodyMarkdown || state.tagIds.length || state.newTagName)) return;
        const selection = document.getSelection?.();
        if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return;
        const range = selection.getRangeAt(0);
        const element = node => node?.nodeType === 1 ? node : node?.parentElement;
        const start = element(range.startContainer), end = element(range.endContainer);
        if (!start || !end || start.closest?.(excluded) || end.closest?.(excluded)) return;
        const candidates = bodies().filter(body => body.contains(range.startContainer) && body.contains(range.endContainer));
        if (candidates.length !== 1) return;
        const body = candidates[0];
        // Reject selections that cross an excluded island even when endpoints are safe.
        if (Array.from(body.querySelectorAll?.(excluded) ?? []).some(node => range.intersectsNode(node))) return;
        const exact = selection.toString();
        if ([...exact].filter(point => !/\s/u.test(point)).length < 2 || [...exact].length > 8000) return;
        const rect = range.getBoundingClientRect();
        const draft = { quote: { format: 'plain_text', content: exact }, source: { ...source, sessionId },
          position: { left: rect.left, top: rect.bottom } };
        try {
          const indexed = messageTextIndex(body).selection(range, exact);
          publish({ draft: { ...draft, anchor: { exact,
            prefix: indexed.sourceText.slice(Math.max(0, indexed.startOffset - 32), indexed.startOffset),
              suffix: indexed.sourceText.slice(indexed.endOffset, indexed.endOffset + 32),
              ...(indexed.normalized ? {} : { startOffset: indexed.startOffset, endOffset: indexed.endOffset }) } }, diagnostic: null });
        } catch (failure) {
          if (failure?.code === 'UNMAPPABLE_RANGE')
            publish({ draft: { ...draft, anchor: { exact }, unlocated: true }, diagnostic: null });
          else publish({ diagnostic: failure?.code ?? 'UNMAPPABLE_RANGE' });
        }
      };
      const save = async (kind, bodyMarkdown = state.bodyMarkdown ?? '') => {
        // Every save action preserves typed annotations, including quick-tag shortcuts.
        if (kind === 'highlight' && bodyMarkdown.trim()) kind = 'note';
        if (!alive || busy || (!state.draft && !state.pending)) return;
        busy = true; publish({ status: 'saving', diagnostic: null });
        try {
          if (!state.pending) {
            if (!['highlight', 'note'].includes(kind) || (kind === 'note' && !bodyMarkdown.trim())) throw error('VALIDATION_FAILED');
            const version = await call(signal => api.library({ scope: 'session', sessionId, sort: 'updated', offset: 0, limit: 50 }, signal));
            if (!alive) return;
            if (typeof version?.epoch !== 'string' || !Number.isSafeInteger(version.revision)) throw error('INVALID_RESPONSE');
            const { quote, anchor, source } = state.draft;
            publish({ pending: { requestId: createRequestId(), epoch: version.epoch, expectedRevision: version.revision,
              kind, ...(kind === 'note' ? { bodyMarkdown } : {}), quote, anchor, source, tagIds: [...state.tagIds], ...(state.newTagName.trim() ? { newTagName: state.newTagName.trim() } : {}) } });
          }
          const intent = state.pending;
          const receipt = await call(signal => api.excerpt(structuredClone(intent), signal));
          if (!alive) return;
          if (receipt?.epoch !== intent.epoch || !Number.isSafeInteger(receipt.revision)
            || receipt.revision <= intent.expectedRevision || typeof receipt.noteId !== 'string' || !receipt.noteId) throw error('INVALID_RESPONSE');
          publish({ draft: null, pending: null, bodyMarkdown: '', tagIds: [], newTagName: '', status: 'saved' });
          await reload();
        } catch (failure) {
          publish({ status: 'failed', diagnostic: failure?.code ?? 'COMMIT_UNKNOWN',
            ...(['VERSION_CONFLICT', 'EPOCH_CONFLICT', 'VALIDATION_FAILED', 'REQUEST_LIMIT', 'SNAPSHOT_LIMIT', 'RECEIPT_LIMIT', 'NAME_CONFLICT'].includes(failure?.code) ? { pending: null } : {}) });
        } finally { busy = false; }
      };
      const openDetail = async id => {
        const token = ++detailGeneration;
        publish({ detail: null, diagnostic: null });
        try {
          const response = await call(signal => api.notesGet(id, signal));
          if (!alive || token !== detailGeneration) return;
          if (response?.note?.id !== id || response.note.source?.sessionId !== sessionId) throw error('INVALID_RESPONSE');
          publish({ detail: response.note, candidates: [] });
        } catch (failure) { if (alive && token === detailGeneration) publish({ diagnostic: failure?.code ?? 'READ_UNAVAILABLE' }); }
      };
      const click = event => {
        if (!alive || state.draft || state.pending || event.defaultPrevented || event.button !== 0
          || document.getSelection?.()?.isCollapsed !== true || event.target?.closest?.(excluded)) return;
        const top = document.elementsFromPoint?.(event.clientX, event.clientY)?.[0];
        if (!top || !bodies().some(body => body.contains(event.target) && body.contains(top))) return;
        const hits = [];
        for (const entry of located) {
          try {
            entry.index.selection(entry.range, entry.exact);
            if (Array.from(entry.range.getClientRects()).some(rect => rect.width > 0 && rect.height > 0
              && rect.left <= event.clientX && event.clientX <= rect.right && rect.top <= event.clientY && event.clientY <= rect.bottom)) hits.push(entry.id);
          } catch { clear(); return; }
        }
        if (hits.length) publish({ detailPosition: { left: event.clientX, top: event.clientY } });
        if (hits.length === 1) void openDetail(hits[0]);
        else if (hits.length > 1) publish({ candidates: hits, detail: null });
      };
      document.addEventListener?.('click', click);
      document.addEventListener?.('mouseup', capture);
      document.addEventListener?.('keyup', capture);
      let queued = false;
      if (typeof MutationObserver === 'function' && document.body) {
        observer = new MutationObserver(mutations => {
          if (!alive) return;
          const isSessionRegion = node => node?.getAttribute?.('data-conversation-region') === 'chat'
            && node.getAttribute('data-conversation-session') === sessionId;
          const containsSessionRegion = node => isSessionRegion(node)
            || Array.from(node?.querySelectorAll?.('[data-conversation-region="chat"][data-conversation-session]') ?? []).some(isSessionRegion);
          if (!mutations.some(mutation => {
            const target = mutation.target?.nodeType === 1 ? mutation.target : mutation.target?.parentElement;
            if (target?.closest?.('[data-notebook-annotations],[data-notebook-overlay],[data-notebook-library]')) return false;
            if (isSessionRegion(target?.closest?.('[data-conversation-region="chat"]'))) return true;
            // Whole occurrence replacement can report its outer parent as target.
            // Removed nodes are disconnected but still carry the session attributes.
            return [...Array.from(mutation.addedNodes ?? []), ...Array.from(mutation.removedNodes ?? [])].some(containsSessionRegion);
          })) return;
          clear();
          if (queued) return;
          queued = true; queueMicrotask(() => { queued = false; if (alive) locate(); });
        });
        observer.observe(document.body, { childList: true, characterData: true, subtree: true });
      }
      return { name, reload, capture, save, openDetail,
        closeDetail() { detailGeneration++; publish({ detail: null, candidates: [] }); },
        editTags(tagIds, newTagName = '') { if (!busy && !state.pending && Array.isArray(tagIds) && tagIds.every(id => typeof id === 'string') && typeof newTagName === 'string') publish({ tagIds: [...new Set(tagIds)], newTagName }); },
        editBody(bodyMarkdown) { if (!busy && !state.pending) publish({ bodyMarkdown }); }, retry: () => save(), snapshot: () => ({ ...state }),
        discard(confirmed = false) { if (!busy && !state.pending && (!state.bodyMarkdown || confirmed === true)) publish({ draft: null, bodyMarkdown: '', tagIds: [], newTagName: '', diagnostic: null }); },
        dispose() { alive = false; generation++; observer?.disconnect(); clear();
          for (const request of requests) request.abort(); requests.clear();
          document.removeEventListener?.('click', click); document.removeEventListener?.('mouseup', capture); document.removeEventListener?.('keyup', capture); } };
    }

    // Verified installed @deepseek-ai/dsh-client-ui-chat 0.1.5-rc.2 renderer:
    // Desktop app.asar chat 0.2.0-rc.2: .desktop-reference/chat-client.js
    // MessageItem bubble (225,1332), AssistantMarkdown body (5868,5955).
    // Shared chat 0.1.5-rc.2 remains supported with its separately verified classes.
    // Fail closed on new markup; static package evidence is not runtime acceptance.
    // Conversation 0.2.0-rc.2 stamps its session occurrence and chat region.
    function renderedConversationBodies(document, sessionId) {
      if (typeof document?.querySelectorAll !== 'function') return [];
      return Array.from(document.querySelectorAll('[data-conversation-region="chat"][data-conversation-session]'))
        .filter(region => region.getAttribute('data-conversation-session') === sessionId)
        .flatMap(region => Array.from(region.querySelectorAll('.IzP3Va_bubble,.gKv1-q_body,.Sixlwa_bubble,.hWmORq_body')))
        .filter(body => !body.closest('[data-streaming],[data-pending-steering],[data-submission-echo],[data-notebook-library],[data-notebook-overlay]'))
        // UserStyleBubble appends extra JSON blocks after projected inline text.
        // Until an extra-block selector is verified, reject the complete bubble
        // when it includes a block child instead of guessing which text is authored.
        .filter(body => !body.matches?.('.IzP3Va_bubble,.Sixlwa_bubble')
          || Array.from(body.children ?? []).every(child => ['SPAN', 'A', 'BR', 'CODE', 'STRONG', 'EM', 'B', 'I', 'U', 'S'].includes(child.tagName)));
    }

    return { conversationAnnotations, renderedConversationBodies };
    })(messageTextIndex, locateTextAnchor);

    const { sessionActivityCatalog } = (() => {
    // Read only Host-catalogued rows from the supported Client Sessions snapshot.
    // Retained byId fallbacks are not catalog membership or current Host activity.
    function sessionActivityCatalog(snapshot) {
      const fail = () => { throw Object.assign(new Error('SESSION_ACTIVITY_UNAVAILABLE'),
        { code: 'SESSION_ACTIVITY_UNAVAILABLE' }); };
      if (!snapshot || snapshot.phase !== 'ready' || !Array.isArray(snapshot.ids)
        || snapshot.ids.length > 10000 || !snapshot.byId || typeof snapshot.byId !== 'object') fail();
      const seen = new Set();
      return snapshot.ids.map(id => {
        if (typeof id !== 'string' || !id || id.length > 4096 || seen.has(id)
          || !Object.hasOwn(snapshot.byId, id)) fail();
        seen.add(id);
        const row = snapshot.byId[id];
        if (!row || row.id !== id || !Number.isSafeInteger(row.updatedAt) || row.updatedAt < 0) fail();
        return { sessionId: id, updatedAt: row.updatedAt };
      });
    }

    return { sessionActivityCatalog };
    })();
    const h = React.createElement;
    const namespace = 'dsh-session-notebook';
    const version = '0.1.0';
    return {
      inject: ['slots', 'locale', 'connection', 'uiWorkspace', 'uiSession', 'sessions', 'workspaces'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(namespace, 'en', {
          title: 'AI Notes', open: 'Open AI Notes', close: 'Close',
          connecting: 'Checking Host connection…', connected: 'Host connected; storage is not ready.',
          ready: 'Notebook storage is ready.',
          failed: 'Connection check failed. Please retry.', retry: 'Retry',
          workspacePending: 'Workspace context is loading.', workspaceError: 'Workspace context is unavailable.',
          noWorkspace: 'No workspace membership in the current registry.',
          workspaceAmbiguous: 'Multiple workspace memberships found; context is ambiguous.',
          manualDraft: 'Local manual draft', draftTitle: 'Title (not saved)', draftBody: 'Your note (not saved)',
          titleLimit: 'Title limit: 1,000 UTF-16 units and Unicode code points. Your text was kept.',
          bodyLimit: 'Body limit: 100,000 UTF-16 units and Unicode code points. Your text was kept.',
          requestLimit: 'Request limit: 256 KiB UTF-8. Your text was kept.',
          searchLimit: 'Search limit: 1,000 Unicode code points. Your text was kept.',
          tagNameLimit: 'Tag name limit: 32 Unicode code points after trimming. Your text was kept.',
          draftWarning: 'Unsaved memory draft. Closing the panel keeps it until plugin unload or page reload. Explicit discard removes it.',
          discardDraft: 'Discard draft', confirmDiscard: 'Discard this draft?', cancelDiscard: 'Keep editing',
          previewDraft: 'Preview Markdown', previewNotice: 'Safe basic preview; HTML, images and unsupported syntax remain literal.',
          copyDraft: 'Copy text', copyingDraft: 'Copying…', copiedDraft: 'Text copied.', copyDraftFailed: 'Copy failed. Your draft is still here.',
          saveDraft: 'Save note', savingDraft: 'Saving…', retrySave: 'Retry save',
          savedDraft: 'Saved.', loadNotes: 'Reload notes', editNote: 'Edit',
          searchNotes: 'Search notes', runSearch: 'Search', clearSearch: 'Clear search',
          backupSavedNotes: 'Download saved notes as JSON', backupWorking: 'Preparing backup…',
          backupStarted: 'Download requested. Check your downloads.',
          restorePreviewFile: 'Choose a JSON backup to preview',
          restorePreviewWorking: 'Checking backup and current library…',
          restorePreviewRetry: 'Retry the same backup upload',
          restorePreviewRefresh: 'Refresh impact against the current library',
          restorePreviewCancel: 'Discard staged backup',
          restorePreviewCurrent: 'Current note records / in trash / tag records',
          restorePreviewIncoming: 'Backup note records / in trash / tag records',
          restorePreviewImpact: 'Notes removed / replaced / added',
          restorePreviewVersion: 'Backup format / data schema version',
          restorePreviewReplace: 'This backup would replace the entire current library.',
          restorePreviewTagImpact: 'Tags removed / replaced / added',
          restorePreviewCapacity: 'Estimated library bytes / current byte limit',
          restorePreviewOverLimit: 'The estimate exceeds the current library limit. Replacement is blocked until an exact commit-time check passes. No content was shortened.',
          libraryTitle: 'Notebook library', libraryOpen: 'Open library', libraryClose: 'Close library',
          libraryScope: 'Scope', libraryKindLabel: 'Type', librarySort: 'Sort',
          libraryTagMode: 'Tag match', libraryTimeField: 'Time field',
          libraryApply: 'Apply filters', libraryAll: 'All notes', librarySession: 'Current session',
          libraryWorkspace: 'Current project', libraryKindAll: 'All types',
          libraryHighlight: 'Highlight', libraryNote: 'Note', libraryManual: 'Manual',
          libraryTags: 'Tags', libraryTagAny: 'Any tag', libraryTagAll: 'All tags',
          libraryUntagged: 'Untagged', libraryTrash: 'Trash only', librarySearch: 'Keywords',
          libraryFrom: 'From (ISO with offset)', libraryTo: 'To (ISO with offset)',
          libraryCreated: 'Created time', libraryUpdated: 'Updated time',
          librarySortUpdated: 'Recently updated', librarySortCreated: 'Recently created',
          librarySortWorkspace: 'Workspace', librarySortTag: 'Tag',
          librarySortSession: 'Session recent activity',
          librarySessionActivityUnavailable: 'Session activity is unavailable. Use another sort. Placement of notes without activity is awaiting confirmation.',
          libraryPrev: 'Previous', libraryNext: 'Next', libraryLoading: 'Loading library…',
          libraryEmpty: 'No matching notes.', librarySelectAll: 'Select all filtered results',
          libraryClearSelection: 'Clear selection', librarySelected: 'Selected',
          libraryHiddenSelected: 'Hidden by filters',
          libraryDetail: 'Details', libraryCloseDetail: 'Back to list',
          libraryDetailLoading: 'Loading note details…', libraryQuote: 'Original quote',
          libraryQuoteFormat: 'Quote format', libraryCreatedAt: 'Created',
          libraryUpdatedAt: 'Updated', libraryDeletedAt: 'Moved to trash',
          librarySource: 'Saved source',
          editOpen: 'Edit note', editTitle: 'Edit note', editBody: 'Markdown body',
          editTags: 'Tags', editSave: 'Save edit', editRetry: 'Retry same edit',
          editClose: 'Close editor', editReload: 'Read latest note',
          editUseLatest: 'Continue editing against latest version',
          editDraftWarning: 'Closing keeps this edit in memory. Reloading or unloading loses it.',
          editConfirmClose: 'Close the editor and keep the unsaved draft in memory?',
          editKeepEditing: 'Keep editing', editCloseKeep: 'Close and keep draft',
          tagManage: 'Manage tags', tagCreate: 'Create tag', tagRename: 'Save tag',
          tagColor: 'Tag color', tagColorAuto: 'Assign automatically',
          tagColor0: 'Bright pink', tagColor1: 'Vibrant orange', tagColor2: 'Bright yellow',
          tagColor3: 'Mint green', tagColor4: 'Bright blue', tagColor5: 'Violet',
          tagMerge: 'Merge tags', tagDelete: 'Delete tag', tagName: 'Tag name',
          tagSource: 'Source tag', tagTarget: 'Target tag', tagPreview: 'Preview impact',
          tagConfirm: 'Confirm change', tagCancel: 'Cancel change', tagRetry: 'Retry same request',
          tagActive: 'Active notes', tagTrashed: 'Trashed notes', tagLoading: 'Loading tags…',
          tagBusy: 'Saving tag…', tagSaved: 'Tag change saved.',
          noteTrash: 'Move selected to trash', noteRestore: 'Restore selected',
          notePurge: 'Permanently delete selected', noteImpact: 'Confirm affected notes',
          noteConfirm: 'Confirm note change', noteCancel: 'Cancel note change',
          noteRetry: 'Retry same note request', noteBusy: 'Saving note change…',
          noteChanged: 'Note change saved.',
          convertOpen: 'Convert type', convertTitle: 'Convert note type',
          convertTarget: 'Target type', convertBody: 'My Markdown body',
          convertOriginal: 'Original quote (read only)', convertSave: 'Save conversion',
          convertRemove: 'Confirm removal of the existing body',
          convertRetry: 'Retry same conversion', convertReload: 'Read latest note before retrying',
          convertUseLatest: 'Use latest version with my draft', convertClose: 'Close conversion',
          convertNoTarget: 'This note has no valid target type.',
          convertDraftWarning: 'Closing keeps this edit in memory. Reloading or unloading the plugin loses it.',
          sourceOpen: 'Open source session', sourceRestore: 'Restore and open source session',
          sourceCancel: 'Keep source archived', sourceArchived: 'The source session is archived.',
          sourceUnavailable: 'Source session is unavailable. The saved source details remain below.',
          sourceOpenFailed: 'Source session could not be opened.',
          sourceRestoreFailed: 'Source session could not be restored.',
          copyMarkdown: 'Copy Markdown', copyMarkdownWorking: 'Preparing Markdown…',
          copyMarkdownDone: 'Markdown copied.', copyMarkdownFailed: 'Markdown could not be copied.',
          exportMarkdown: 'Download selected Markdown', exportOneMarkdown: 'Download this Markdown',
          exportTags: 'Include tags', exportSource: 'Include source',
          exportSourceIds: 'Include session and message IDs', exportTimes: 'Include timestamps',
          exportQuote: 'Include original quote', exportWorking: 'Preparing Markdown file…',
          exportStarted: 'Download requested. Check your downloads.',
          exportFailed: 'Markdown file could not be prepared.',
          exportSelectionUnavailable: 'Some selected notes are no longer active. Review the selection.',
          exportChanged: 'Notes changed before export. Refresh the list and retry.',
          inputInsert: 'Write to current input', inputAppend: 'Append to latest draft',
          inputReplace: 'Replace latest plain-text draft', inputCancel: 'Keep input unchanged',
          inputCurrent: 'Latest input draft', inputReady: 'Review the note and choose an input action.',
          inputWorking: 'Preparing input text…', inputApplied: 'Text inserted into the draft. It was not sent.',
          inputUnavailable: 'Current input is unavailable. Copy Markdown instead.',
          inputChanged: 'The input draft changed. Review its latest text and choose again.',
          inputFailed: 'Input text could not be prepared. Copy Markdown instead.',
          inputComplex: 'Replace is unavailable while references or attachments are present.',
          backToList: 'Back to list', noNotes: 'No saved manual notes yet.',
          noteVersion: 'Version',
          inspectConflict: 'Read latest version', serverVersion: 'Server version',
          localDraft: 'Local draft', confirmConflict: 'Save my draft using the latest version',
        }));
        ctx.effect(() => ctx.locale.register(namespace, 'zh', {
          title: 'AI 笔记', open: '打开 AI 笔记', close: '关闭',
          connecting: '正在检查 Host 连接…', connected: 'Host 已连接；存储尚未就绪。',
          ready: '笔记存储已就绪。',
          failed: '连接检查失败，请重试。', retry: '重试',
          workspacePending: '工作区上下文加载中。', workspaceError: '工作区上下文暂不可用。',
          noWorkspace: '当前工作区注册表中没有此会话的成员关系。',
          workspaceAmbiguous: '此会话匹配多个工作区，上下文归属不明确。',
          manualDraft: '本地手工草稿', draftTitle: '标题（未保存）', draftBody: '我的笔记（未保存）',
          titleLimit: '标题最多 1000 个 UTF-16 码元且最多 1000 个 Unicode 码点，原文已保留。',
          bodyLimit: '正文最多 100000 个 UTF-16 码元且最多 100000 个 Unicode 码点，原文已保留。',
          requestLimit: '单次请求最多 256 KiB UTF-8，原文已保留。',
          searchLimit: '搜索词最多 1000 个 Unicode 码点，原文已保留。',
          tagNameLimit: '标签名称去除首尾空白后最多 32 个 Unicode 码点，原文已保留。',
          draftWarning: '未保存的内存草稿。关闭面板后仍保留；页面刷新或插件卸载会丢失，明确丢弃会清除。',
          discardDraft: '丢弃草稿', confirmDiscard: '确定丢弃草稿吗？', cancelDiscard: '继续编辑',
          previewDraft: '预览 Markdown', previewNotice: '基础安全预览；HTML、图片和未支持语法按原文显示。',
          copyDraft: '复制正文', copyingDraft: '正在复制…', copiedDraft: '正文已复制。', copyDraftFailed: '复制失败，草稿仍保留。',
          saveDraft: '保存笔记', savingDraft: '正在保存…', retrySave: '重试保存',
          savedDraft: '已保存。', loadNotes: '刷新笔记', editNote: '编辑',
          searchNotes: '搜索笔记', runSearch: '搜索', clearSearch: '清除搜索',
          backupSavedNotes: '下载已保存笔记的 JSON 备份', backupWorking: '正在准备备份…',
          backupStarted: '已发起下载，请检查下载列表。',
          restorePreviewFile: '选择 JSON 备份并预览',
          restorePreviewWorking: '正在校验备份和当前笔记库…',
          restorePreviewRetry: '按同一上传 ID 重试',
          restorePreviewRefresh: '按当前笔记库重新计算影响',
          restorePreviewCancel: '取消备份暂存',
          restorePreviewCurrent: '当前笔记记录 / 其中在回收站 / 标签记录',
          restorePreviewIncoming: '备份笔记记录 / 其中在回收站 / 标签记录',
          restorePreviewImpact: '将移除 / 替换 / 新增的笔记',
          restorePreviewVersion: '备份格式 / 数据 Schema 版本',
          restorePreviewReplace: '此备份将替换当前整个笔记库。',
          restorePreviewTagImpact: '将移除 / 替换 / 新增的标签',
          restorePreviewCapacity: '笔记库预估字节数 / 当前字节上限',
          restorePreviewOverLimit: '预估超过当前笔记库限额。实际提交前精确检查通过后才允许替换，原文没有被裁剪。',
          libraryTitle: '笔记库', libraryOpen: '打开笔记库', libraryClose: '关闭笔记库',
          libraryScope: '范围', libraryKindLabel: '类型', librarySort: '排序',
          libraryTagMode: '标签匹配', libraryTimeField: '时间字段',
          libraryApply: '应用筛选', libraryAll: '全部笔记', librarySession: '当前会话',
          libraryWorkspace: '当前项目', libraryKindAll: '全部类型',
          libraryHighlight: '划线', libraryNote: '笔记', libraryManual: '手工笔记',
          libraryTags: '标签', libraryTagAny: '任一标签', libraryTagAll: '全部标签',
          libraryUntagged: '无标签', libraryTrash: '仅回收站', librarySearch: '关键词',
          libraryFrom: '起始时间（本地时区）', libraryTo: '结束时间（本地时区）',
          libraryCreated: '创建时间', libraryUpdated: '更新时间',
          librarySortUpdated: '最近更新', librarySortCreated: '最近创建',
          librarySortWorkspace: '工作区', librarySortTag: '标签',
          librarySortSession: '会话最近活动',
          librarySessionActivityUnavailable: '无法取得会话活动时间，请使用其他排序。缺少活动时间的笔记如何排列仍待确认。',
          libraryPrev: '上一页', libraryNext: '下一页', libraryLoading: '正在读取笔记库…',
          libraryEmpty: '没有匹配的笔记。', librarySelectAll: '全选筛选结果',
          libraryClearSelection: '取消选择', librarySelected: '已选',
          libraryHiddenSelected: '被筛选隐藏',
          libraryDetail: '详情', libraryCloseDetail: '返回列表',
          libraryDetailLoading: '正在读取笔记详情…', libraryQuote: '原文引用',
          libraryQuoteFormat: '引用格式', libraryCreatedAt: '创建时间',
          libraryUpdatedAt: '更新时间', libraryDeletedAt: '移入回收站',
          librarySource: '保存的来源',
          editOpen: '编辑笔记', editTitle: '编辑笔记', editBody: 'Markdown 正文',
          editTags: '标签', editSave: '保存修改', editRetry: '按原请求重试编辑',
          editClose: '关闭编辑器', editReload: '读取最新笔记',
          editUseLatest: '使用最新版本继续编辑',
          editDraftWarning: '关闭后编辑保留在内存中；页面刷新或插件卸载会丢失。',
          editConfirmClose: '关闭编辑器并将未保存草稿保留在内存中？',
          editKeepEditing: '继续编辑', editCloseKeep: '关闭并保留草稿',
          tagManage: '管理标签', tagCreate: '新建标签', tagRename: '保存标签',
          tagColor: '标签颜色', tagColorAuto: '自动分配',
          tagColor0: '亮粉色', tagColor1: '活力橙', tagColor2: '明黄色',
          tagColor3: '薄荷绿', tagColor4: '亮蓝色', tagColor5: '紫罗兰色',
          tagMerge: '合并标签', tagDelete: '删除标签', tagName: '标签名称',
          tagSource: '原标签', tagTarget: '目标标签', tagPreview: '预览影响',
          tagConfirm: '确认修改', tagCancel: '取消修改', tagRetry: '按原请求重试',
          tagActive: '正常笔记', tagTrashed: '回收站笔记', tagLoading: '正在读取标签…',
          tagBusy: '正在保存标签…', tagSaved: '标签修改已保存。',
          noteTrash: '将已选笔记移入回收站', noteRestore: '恢复已选笔记',
          notePurge: '永久删除已选笔记', noteImpact: '确认受影响笔记',
          noteConfirm: '确认修改笔记', noteCancel: '取消修改',
          noteRetry: '按原请求重试笔记操作', noteBusy: '正在修改笔记…',
          noteChanged: '笔记修改已保存。',
          convertOpen: '转换类型', convertTitle: '转换笔记类型',
          convertTarget: '目标类型', convertBody: '我的 Markdown 正文',
          convertOriginal: '原文引用（只读）', convertSave: '保存转换',
          convertRemove: '确认移除已有正文',
          convertRetry: '按原请求重试转换', convertReload: '读取最新笔记后再试',
          convertUseLatest: '确认用最新版本保存我的草稿', convertClose: '关闭转换',
          convertNoTarget: '这条笔记没有可转换的目标类型。',
          convertDraftWarning: '关闭面板会在内存中保留编辑；页面刷新或插件卸载会丢失。',
          sourceOpen: '打开来源会话', sourceRestore: '恢复并打开来源会话',
          sourceCancel: '保持来源归档', sourceArchived: '来源会话已归档。',
          sourceUnavailable: '来源会话不可用，下方仍保留已保存的来源信息。',
          sourceOpenFailed: '无法打开来源会话。',
          sourceRestoreFailed: '无法恢复来源会话。',
          copyMarkdown: '复制 Markdown', copyMarkdownWorking: '正在准备 Markdown…',
          copyMarkdownDone: '已复制 Markdown。', copyMarkdownFailed: '无法复制 Markdown。',
          exportMarkdown: '下载已选 Markdown', exportOneMarkdown: '下载此笔记 Markdown',
          exportTags: '包含标签', exportSource: '包含来源',
          exportSourceIds: '包含会话和消息 ID', exportTimes: '包含时间',
          exportQuote: '包含原文引用', exportWorking: '正在准备 Markdown 文件…',
          exportStarted: '已发起下载，请检查下载列表。',
          exportFailed: '无法准备 Markdown 文件。',
          exportSelectionUnavailable: '部分已选笔记不再是正常笔记，请检查选择。',
          exportChanged: '导出前笔记已变化，请刷新列表后重试。',
          inputInsert: '写入当前输入框', inputAppend: '追加到最新草稿',
          inputReplace: '替换最新纯文本草稿', inputCancel: '保持输入框不变',
          inputCurrent: '最新输入草稿', inputReady: '检查笔记与草稿后选择输入操作。',
          inputWorking: '正在准备输入内容…', inputApplied: '已写入草稿，未发送消息。',
          inputUnavailable: '当前输入框不可用，请改用复制 Markdown。',
          inputChanged: '输入草稿已变化，请检查最新内容后重新选择。',
          inputFailed: '无法准备输入内容，请改用复制 Markdown。',
          inputComplex: '草稿含引用或附件时不能替换，可选择追加。',
          backToList: '返回列表', noNotes: '还没有保存的手工笔记。',
          noteVersion: '版本',
          inspectConflict: '读取最新版本', serverVersion: '服务器版本',
          localDraft: '本地草稿', confirmConflict: '确认按最新版本保存本地草稿',
        }));
        const t = ctx.locale.bind(namespace);
        // Tab bodies may unmount on host close or context switches. Keep drafts
        // in the plugin owner, not the body; only explicit discard clears them.
        // This is transient UI state, never a parallel notebook database.
        const retainedDrafts = new Map();
        const annotationDrafts = new Map();
        const savingKeys = new Set();
        let manualApi;
        const getManualApi = () => manualApi ??= previewApi(ctx.connection);
        const controllerApi = Object.fromEntries(['list', 'get', 'create', 'update', 'backup']
          .map(method => [method, (...args) => getManualApi()[method](...args)]));
        const controllerRecords = new Map();
        let tagOperation = { pending: null, busy: false, diagnostic: null };
        const tagListeners = new Set();
        const updateTagOperation = change => {
          tagOperation = { ...tagOperation, ...change };
          for (const listener of tagListeners) listener();
        };
        const useTagOperation = () => React.useSyncExternalStore(
          listener => { tagListeners.add(listener); return () => tagListeners.delete(listener); },
          () => tagOperation);
        let noteOperation = { pending: null, busy: false, diagnostic: null };
        const editDrafts = new Map();
        const noteListeners = new Set();
        const updateNoteOperation = change => {
          noteOperation = { ...noteOperation, ...change };
          for (const listener of noteListeners) listener();
        };
        const useNoteOperation = () => React.useSyncExternalStore(
          listener => { noteListeners.add(listener); return () => noteListeners.delete(listener); },
          () => noteOperation);
        const storageListeners = new Set();
        let storageReady = false;
        const setStorageReady = value => {
          if (storageReady === value) return;
          storageReady = value;
          for (const listener of storageListeners) listener();
        };
        const useStorageReady = () => React.useSyncExternalStore(
          listener => { storageListeners.add(listener); return () => storageListeners.delete(listener); },
          () => storageReady);
        const visibleCodes = new Set(['CANCELLED', 'TIMEOUT', 'VERSION_CONFLICT', 'EPOCH_CONFLICT',
          'COMMIT_UNKNOWN', 'REQUEST_ID_REUSED', 'VALIDATION_FAILED', 'REQUEST_LIMIT',
          'SNAPSHOT_LIMIT', 'RECEIPT_LIMIT', 'READ_UNAVAILABLE', 'CLOSED',
          'TRANSPORT_FAILED', 'INVALID_RESPONSE', 'PENDING_INTENT',
          'TITLE_LIMIT', 'BODY_LIMIT', 'SEARCH_LIMIT', 'TAG_NAME_LIMIT',
          'INVALID_BACKUP', 'BACKUP_TOO_LARGE', 'UNSUPPORTED_BACKUP',
          'UPLOAD_BUSY', 'UPLOAD_NOT_FOUND', 'UPLOAD_CONFLICT', 'UPLOAD_INCOMPLETE',
          'NAME_CONFLICT', 'CONFIRM_REQUIRED', 'SESSION_ACTIVITY_UNAVAILABLE',
          'UNMAPPABLE_RANGE']);
        const safeDiagnostic = error => visibleCodes.has(error?.code) ? error.code : 'TRANSPORT_FAILED';
        const controllerFor = key => {
          if (controllerRecords.has(key)) return controllerRecords.get(key);
          const listeners = new Set();
          const record = { listeners, state: null, instance: null };
          const createRequestId = () => {
            const bytes = new Uint8Array(16);
            window.crypto.getRandomValues(bytes);
            return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
          };
          record.instance = manualSaveController({ api: controllerApi, createRequestId,
            onChange: state => { record.state = state; for (const listener of listeners) listener(); } });
          record.state = record.instance.snapshot();
          controllerRecords.set(key, record);
          return record;
        };
        const useManualController = key => {
          const record = controllerFor(key);
          const state = React.useSyncExternalStore(
            listener => { record.listeners.add(listener); return () => record.listeners.delete(listener); },
            () => record.state);
          return [record.instance, state];
        };
        function useRetainedDraft(key) {
          if (!retainedDrafts.has(key)) retainedDrafts.set(key, { open: false, title: '', body: '', confirm: false });
          const initial = retainedDrafts.get(key);
          const [, update] = React.useState(initial);
          const setDraft = change => {
            const current = retainedDrafts.get(key) ?? initial;
            const next = typeof change === 'function' ? change(current) : change;
            retainedDrafts.set(key, next);
            update(next);
          };
          // Read the new key immediately on a reused component; React's local
          // state may still belong to the previous session for this render.
          return [retainedDrafts.get(key), setDraft];
        }
        ctx.effect(() => {
          const beforeUnload = event => {
            if (![...retainedDrafts.values()].some(draft => draft.title || draft.body || draft.tagIds?.length)
              && ![...editDrafts.values()].some(draft => draft.dirty || draft.pending)
              && ![...annotationDrafts.values()].some(draft => draft.draft || draft.pending || draft.bodyMarkdown)) return;
            event.preventDefault();
            event.returnValue = '';
          };
          // Browser-supported reload warning, not a promise of persistence or
          // a veto over plugin unload / application termination.
          window.addEventListener?.('beforeunload', beforeUnload);
          return () => window.removeEventListener?.('beforeunload', beforeUnload);
        });
        let sidebar = null;
        const mountNativePanel = scope => {
          const tabRegistry = scope.get?.('sidebarRightTabs') ?? scope.sidebarRightTabs;
          const controller = scope.get?.('sidebarRight') ?? scope.sidebarRight;
          if (typeof tabRegistry?.register !== 'function' || typeof controller?.openTab !== 'function') return;
          scope.effect(() => tabRegistry.register({
            id: namespace, kind: namespace, title: () => t('title'),
            guide: [{ id: 'open', order: 50, title: () => t('title') }],
          }));
          scope.slots.inject('sidebar.right.pane.tab', () => scope.slots.register({
            name: 'sidebar.right.pane.tab', key: namespace,
          }, Panel));
          sidebar = controller; notify();
          scope.effect(() => () => { if (sidebar === controller) { sidebar = null; notify(); } });
        };
        let openedBy = null;
        const libraryRefreshListeners = new Set();
        const listeners = new Set();
        const notify = () => { for (const listener of listeners) listener(); };
        const close = () => { openedBy = null; notify(); };
        const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
        function useText() {
          React.useSyncExternalStore(fn => ctx.locale.subscribe(fn), () => ctx.locale.getSnapshot());
          return t;
        }
        const controlStyle = {
          background: 'var(--dsw-alias-bg-layer-2, #f7f8fa)', color: 'var(--dsw-alias-label-primary, #252830)',
          border: '1px solid var(--dsw-alias-border-l1, #d9dee7)', borderRadius: 6,
          padding: '7px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.4,
        };
        const notebookStyles = `
[data-notebook-panel],[data-notebook-shell]{font-family:inherit;font-size:14px;line-height:1.55;color:var(--dsw-alias-label-primary,#252830);background:var(--dsw-alias-bg-base,#fff);overflow-wrap:anywhere}
[data-notebook-panel]{height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;box-sizing:border-box;padding:16px;container: notebook-panel / inline-size}
[data-notebook-panel]>code{display:none}
[data-notebook-panel]>div>p{margin:4px 0;font-size:12px;color:var(--dsw-alias-label-secondary,#707681)}
[data-notebook-panel] h3,[data-notebook-shell] h3{font-size:18px;margin:16px 0 12px}
[data-notebook-library] form{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;padding:14px;background:var(--dsw-alias-bg-layer-2,#f6f7f9);border-radius:10px;margin-bottom:14px;align-items:start}
[data-notebook-library] label{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12px}
[data-notebook-library] input:not([type=checkbox]),[data-notebook-library] select,[data-note-edit] input,[data-note-edit] textarea,[data-note-conversion] textarea{box-sizing:border-box;max-width:100%;min-width:0;border:1px solid var(--dsw-alias-border-l1,#d9dee7);border-radius:6px;background:var(--dsw-alias-bg-base,#fff);color:inherit;padding:7px 8px;font:inherit}
[data-notebook-library] label input:not([type=checkbox]){width:100%}
[data-notebook-library] select[multiple]{min-height:84px;width:100%}
[data-notebook-library] ul{list-style:none;padding:0;margin:12px 0;display:grid;gap:12px}
[data-notebook-library] li{border:1px solid var(--dsw-alias-border-l1,#dde2e9);border-radius:10px;padding:14px;background:var(--dsw-alias-bg-base,#fff)}
[data-notebook-library] li>p{white-space:pre-wrap;margin:10px 0;font-size:13px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
[data-notebook-library] li>small{display:block;font-size:11px;color:var(--dsw-alias-label-secondary,#737b89);margin:4px 0}
[data-notebook-library] li>button{margin:6px 6px 0 0}
[data-notebook-library] button:disabled{opacity:.45;cursor:not-allowed}
[data-notebook-library] pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}
[data-notebook-library] [role=status]{padding:8px 10px;border-radius:6px;background:var(--dsw-alias-bg-layer-2,#eef3fa)}
[data-notebook-library]>[data-markdown-export],[data-notebook-library]>[data-note-edit],[data-notebook-library]>[data-note-conversion],[data-notebook-library]>[data-input-confirm],[data-notebook-library]>[data-source-restore],[data-notebook-library]>[data-note-detail]{position:fixed;z-index:1100;inset:8vh max(16px,calc((100vw - 640px)/2));max-height:84vh;overflow:auto;padding:20px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1,#d9dee7);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 12px 48px #0003;box-sizing:border-box}
[data-note-edit-tags]{border:1px solid var(--nb-line);border-radius:10px;padding:12px;margin:14px 0}
[data-note-edit-tags] legend{font-size:12px;color:var(--nb-muted)}
.notebook-edit-tag-options{display:flex;flex-wrap:wrap;gap:8px}
[data-note-edit] .notebook-edit-tag-options label{display:flex;align-items:center;gap:6px;margin:0;padding:6px 9px;background:var(--nb-soft);border-radius:8px;cursor:pointer}
[data-note-edit-tags] small{display:block;color:var(--nb-muted);margin-top:8px}
[data-note-edit] label,[data-note-conversion] label{display:block;margin:12px 0}
[data-note-edit] textarea,[data-note-conversion] textarea{display:block;width:100%;min-height:120px}
[data-notebook-library]>[data-notebook-tags],[data-notebook-library]>[data-restore-preview]{margin-top:16px;padding:12px;border-top:1px solid var(--dsw-alias-border-l1,#e1e5eb)}
[data-notebook-panel],[data-notebook-shell]{--nb-accent:#4869db;--nb-line:var(--dsw-alias-border-l1,#e3e7ee);--nb-muted:var(--dsw-alias-label-secondary,#788294);--nb-soft:var(--dsw-alias-bg-layer-2,#f5f7fb);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65}
[data-notebook-panel]{padding:20px!important}
[data-notebook-heading]{padding-bottom:14px;border-bottom:1px solid var(--nb-line);margin-bottom:12px}
[data-notebook-heading]>strong{font-size:19px;letter-spacing:.2px}
[data-notebook-context]{margin-bottom:18px;color:var(--nb-muted);font-size:12px}
[data-notebook-context] code{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:inherit}
[data-notebook-panel] button,[data-notebook-shell] button,[data-notebook-annotations] button{transition:background .15s,border-color .15s,box-shadow .15s;border-radius:8px!important;min-height:32px;font-size:12px!important}
[data-notebook-panel] button:hover:not(:disabled),[data-notebook-annotations] button:hover:not(:disabled){background:var(--nb-soft,#edf1fa)!important;border-color:#a6b5dd!important}
[data-notebook-panel] button:disabled,[data-notebook-annotations] button:disabled{opacity:.4;cursor:not-allowed!important}
[data-notebook-panel] :is(button,input,textarea,select,summary):focus-visible,[data-notebook-annotations] :is(button,input,textarea,select):focus-visible{outline:2px solid #7690e6;outline-offset:2px}
[data-notebook-panel] input:not([type=checkbox]),[data-notebook-panel] textarea,[data-notebook-panel] select,[data-notebook-annotations] input,[data-notebook-annotations] textarea,[data-notebook-annotations] select{border:1px solid var(--nb-line,#dfe4eb)!important;border-radius:8px;padding:9px 10px;min-height:36px;background:var(--dsw-alias-bg-base,#fff)!important;color:inherit;font:inherit;box-sizing:border-box;max-width:100%}
[data-notebook-panel] textarea{resize:vertical;line-height:1.7}
[data-notebook-panel] input[type=checkbox]{accent-color:var(--nb-accent);width:15px;height:15px;flex-shrink:0}
[data-notebook-library]>h3{font-size:16px;margin:20px 0 12px}
[data-notebook-library] form{grid-template-columns:1fr 1fr;gap:10px;background:var(--nb-soft);border:1px solid var(--nb-line);padding:14px;border-radius:12px}
[data-notebook-library] form>label{grid-column:1/-1;flex-direction:column;align-items:stretch;gap:5px;color:var(--nb-muted)}
[data-notebook-library] form>select{width:100%;font-size:12px;order:1}
[data-notebook-library] form>label{order:0}
[data-notebook-library] form>details{order:2}
[data-notebook-library] form>button{order:3}
[data-notebook-filters]{grid-column:1/-1;font-size:12px}
[data-notebook-filters]>summary{cursor:pointer;padding:6px 0;color:var(--nb-muted)}
.notebook-filter-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 0 4px}
.notebook-filter-grid>label{align-items:stretch;flex-direction:column;color:var(--nb-muted)}
.notebook-filter-grid>label:has(input[type=checkbox]){flex-direction:row;align-items:center}
.notebook-filter-grid input{font-size:11px!important}
[data-notebook-primary]{background:var(--nb-accent)!important;color:#fff!important;border-color:var(--nb-accent)!important}
[data-notebook-panel] button[data-notebook-primary]:hover:not(:disabled){background:#3858c4!important;border-color:#3858c4!important;color:#fff!important}
[data-notebook-library] form>button[type=submit]{grid-column:auto}
[data-notebook-library] li{padding:16px;border-radius:12px;box-shadow:0 2px 6px #172b4d05;transition:border-color .15s}
[data-notebook-library] li:hover{border-color:#b9c7e8}
[data-notebook-library] .notebook-card-title{font-size:14px;font-weight:600;line-height:1.5;align-items:flex-start;flex-wrap:nowrap}
[data-notebook-library] li>p{font-size:13px;line-height:1.8;margin:12px 0;-webkit-line-clamp:4}
[data-notebook-library] li>p.notebook-quote{padding:8px 10px;border-left:3px solid #ccd6ee;background:var(--nb-soft);color:var(--nb-muted);border-radius:0 6px 6px 0;-webkit-line-clamp:3}
.notebook-card-tags{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 10px}
.notebook-card-tags>span{background:var(--nb-soft);color:var(--nb-accent);border-radius:5px;padding:2px 7px;font-size:11px}
[data-notebook-library] li>small{line-height:1.6;color:var(--nb-muted);margin:2px 0}
.notebook-card-source{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:10px!important}
[data-notebook-library] li>button{background:transparent!important;padding:5px 8px!important;margin:5px 4px 0 0;font-size:11px!important;border-color:var(--nb-line)!important}
[data-notebook-tag-filter]{grid-column:1/-1;order:4;display:flex;gap:6px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--nb-line)}
.notebook-filter-caption{width:100%;font-size:11px;color:var(--nb-muted)}
[data-notebook-tag-filter]>button{padding:4px 9px;border:1px solid var(--nb-line);background:var(--dsw-alias-bg-base,#fff);color:inherit;cursor:pointer;font:inherit}
[data-notebook-panel] [data-notebook-tag-filter]>button[aria-pressed=true]{background:#4869db!important;color:#fff!important;border-color:#4869db!important}
[data-notebook-panel] [data-notebook-tag-filter]>button[aria-pressed=true]:hover{background:#3858c4!important}
/* Size only our contribution; never override the shared footer or its siblings. */
button[data-notebook-menu]{width:100%;box-sizing:border-box}
[data-notebook-menu]:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#00000008)!important}
[data-notebook-menu]:focus-visible{outline:2px solid #7690e6;outline-offset:2px}
[data-notebook-home]>[data-notebook-library-launcher]{display:contents}
[data-notebook-home]>[data-notebook-library-launcher]>button{margin-left:8px}
[data-notebook-manual-library]{margin-top:16px;padding:14px;background:var(--nb-soft);border:1px solid var(--nb-line);border-radius:12px;font-size:12px}
[data-notebook-manual-library]>button{margin:0 6px 8px 0}
[data-notebook-manual-library][data-draft-open=false]>button:first-child{display:none}
[data-notebook-manual-library] form{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 12px;align-items:flex-end}
[data-notebook-manual-library] form>label{flex:1;min-width:150px;display:flex;flex-direction:column;gap:5px;color:var(--nb-muted)}
[data-notebook-manual-library] form input{width:100%}
[data-notebook-manual-library]>p{color:var(--nb-muted);text-align:center;padding:12px 0}
[data-notebook-editor]{padding:16px!important;border-radius:12px!important;margin:16px 0!important}
[data-notebook-editor]>label{font-size:12px;color:var(--nb-muted);margin-bottom:14px}
[data-notebook-editor]>button{margin:0 6px 8px 0}
[data-notebook-editor]>details{margin-top:10px}
[data-notebook-panel]>small,[data-notebook-panel]>p:last-child{display:block;font-size:11px;color:var(--nb-muted);margin-top:14px}
[data-notebook-panel]>[data-notebook-version]{display:none}
[data-notebook-library]>[role=dialog]{border-radius:16px;padding:24px;box-shadow:0 16px 60px #14213a25}
[data-notebook-library]>[role=dialog] button{margin:6px 6px 0 0}
[data-notebook-library]>[role=dialog] h4{font-size:18px;margin:0 0 16px}
[data-notebook-annotations] [role=dialog]{border-color:var(--dsw-alias-border-l1,#e2e7f0)!important;border-radius:12px!important;box-shadow:0 8px 28px #172b4d25!important}
[data-notebook-annotations] [role=dialog]>div:first-child>button{background:transparent!important;border-color:transparent!important;padding:5px 9px!important}
[data-notebook-bulk]{position:sticky;top:50px;z-index:15;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px;margin:10px 0;background:var(--nb-soft);border:1px solid var(--nb-line);border-radius:10px}
[data-notebook-nav]{display:flex;flex-wrap:wrap;gap:6px;position:sticky;top:-16px;z-index:20;padding:12px 0;background:var(--dsw-alias-bg-base,#fff);border-bottom:1px solid var(--nb-line)}
[data-notebook-nav] button{border:0;padding:7px 10px;background:transparent;color:var(--nb-muted)}
[data-notebook-nav] button[aria-pressed=true]{background:var(--nb-soft)!important;color:var(--nb-accent);font-weight:600}
[data-note-more]{display:inline-block;position:relative;margin-top:8px}
[data-note-more] summary{cursor:pointer;color:var(--nb-muted);font-size:12px;padding:6px}
[data-note-more][open]{display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:var(--nb-soft);border-radius:8px}
[data-note-impact],[data-tag-impact][role=dialog]{position:fixed;inset:10vh auto auto 50%;transform:translateX(-50%);z-index:1100;width:min(480px,calc(100vw - 32px));max-height:75vh;overflow:auto;background:var(--dsw-alias-bg-base,#fff);box-sizing:border-box}
[data-notebook-unified-home] [data-notebook-editor]{background:var(--nb-soft);border-radius:12px!important}
[data-tag-impact][role=dialog]{padding:24px;border:1px solid var(--nb-line);border-radius:14px;box-shadow:0 16px 60px #14213a25}
[data-tag-impact] button{margin:6px 6px 0 0}
[data-notebook-tags] .notebook-tag-row{display:flex;align-items:center;gap:6px;padding:10px 0;border-bottom:1px solid var(--nb-line)}
[data-notebook-tags] .notebook-tag-row>span{flex:1}
.notebook-tag-color{display:inline-block;flex:none;width:13px;height:13px;border-radius:50%;background:var(--tag-color);border:1px solid var(--nb-line);vertical-align:-1px;margin-right:8px}
@media (max-width:400px){.notebook-filter-grid{grid-template-columns:1fr}[data-notebook-library] li{padding:12px}}
/* Notebook layout: readable width and a compact, responsive content hierarchy. */
[data-notebook-panel]{font-family:inherit!important;font-size:14px;line-height:1.5;padding:16px!important}
[data-notebook-panel]>:is([data-notebook-heading],[data-notebook-context],[data-notebook-unified-home],[data-notebook-connection]){width:min(100%,760px);margin-left:auto;margin-right:auto;box-sizing:border-box}
[data-notebook-heading]{padding-bottom:10px;margin-bottom:8px}[data-notebook-heading]>strong{font-size:18px}
[data-notebook-context]{display:flex;gap:4px;min-width:0;margin-bottom:8px;font-size:12px;white-space:nowrap;overflow:hidden;color:var(--dsw-alias-label-secondary)}
[data-notebook-context]>span:first-child{overflow:hidden;text-overflow:ellipsis}
[data-notebook-toolbar]{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:12px}
[data-notebook-nav]{position:static;flex:1 1 auto;min-width:0;gap:2px;border:0;padding:4px 0;flex-wrap:wrap;background:transparent}
[data-notebook-toolbar]>button{flex:none;min-height:36px!important}
[data-notebook-library]>h3,[data-notebook-backup]>h3{font-size:17px;margin:12px 0 10px}
[data-notebook-library] form{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px;padding:12px}
[data-notebook-library] form>label{font-size:12px}[data-notebook-library] form>select{min-width:0;font-size:13px}
[data-notebook-library] form>button{min-height:36px!important;font-size:13px!important}
[data-notebook-tag-filter]{gap:5px;padding-top:8px}
[data-notebook-tag-filter]>button{min-height:30px!important;font-size:12px!important}
[data-notebook-library][data-empty-trash=true] form{display:none}
[data-notebook-library][data-empty-trash=true] [data-notebook-results]>button{display:none}
[data-notebook-library] [data-notebook-search-form]+p{font-size:13px}
[data-notebook-library] [data-notebook-search-form]~div>p:first-child{display:inline-block;margin:8px 10px 6px 0;font-size:13px}
[data-notebook-library] [data-notebook-search-form]~div>button{font-size:12px!important}
[data-notebook-library] [data-notebook-search-form]~div>button:disabled{display:none}
[data-notebook-library][data-empty-trash=true] [data-notebook-search-form]~div>button{display:none}
[data-notebook-library] ul{gap:10px;margin:8px 0}[data-notebook-library] li{position:relative;padding:14px}
.notebook-card-heading{display:flex;align-items:center;gap:8px;min-width:0}.notebook-card-title{flex:1;min-width:0;font-size:14px!important;line-height:1.45;overflow-wrap:anywhere}
.notebook-card-kind{flex:none;color:var(--dsw-alias-label-secondary);font-size:12px;background:var(--dsw-alias-bg-layer-2);padding:2px 6px;border-radius:5px}
[data-notebook-library] li>p{font-size:14px;line-height:1.6;margin:8px 0;-webkit-line-clamp:3}
[data-notebook-library] li>small{display:inline-block;margin:2px 8px 4px 0;font-size:12px}
[data-notebook-library] li>button{font-size:12px!important;min-height:34px!important;margin-top:7px}
[data-note-more]{position:static;vertical-align:middle}[data-note-more] summary{display:inline-flex;align-items:center;min-height:32px;font-size:12px}
[data-note-more][open]{display:inline-block;position:relative;background:transparent;padding:0;z-index:25}
.notebook-card-menu{display:none}[data-note-more][open] .notebook-card-menu{display:grid;position:absolute;right:0;top:100%;z-index:30;min-width:190px;padding:5px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;box-shadow:0 8px 24px var(--dsw-alias-border-l1)}
[data-note-more][open] .notebook-card-menu>button{display:block;width:100%;text-align:left;margin:0!important;border:0!important;border-radius:4px!important;padding:7px 10px!important;background:transparent!important;color:var(--dsw-alias-label-primary);white-space:nowrap;font-size:12px!important}
[data-note-more][open] .notebook-card-menu>button:last-child{color:var(--dsw-alias-state-error-primary)}
[data-notebook-library] li:has([data-note-more][open]){z-index:26}
[data-notebook-empty]{padding:24px 12px;background:var(--dsw-alias-bg-layer-2);border-radius:8px;color:var(--dsw-alias-label-secondary)}
[data-notebook-pagination]{display:flex;gap:8px;margin:12px 0}
[data-notebook-tag-heading]{display:flex;align-items:center;justify-content:space-between;gap:8px}[data-notebook-tag-heading] h4{font-size:17px;margin:12px 0}
[data-notebook-tags] .notebook-tag-row{min-height:42px;gap:10px}[data-notebook-tags] .notebook-tag-row>span{min-width:0;overflow-wrap:anywhere;font-size:14px}
.notebook-tag-actions{position:relative;flex:none}.notebook-tag-actions summary{cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary);padding:6px}
.notebook-tag-menu{display:none}.notebook-tag-actions[open]{z-index:25}.notebook-tag-actions[open] .notebook-tag-menu{display:grid;position:absolute;right:0;top:100%;min-width:120px;padding:5px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;box-shadow:0 8px 24px var(--dsw-alias-border-l1)}
.notebook-tag-actions[open] .notebook-tag-menu>button{display:block;width:100%;text-align:left;background:transparent;border:0;padding:6px 10px;color:var(--dsw-alias-label-primary)}
.notebook-tag-actions[open] .notebook-tag-menu>button:last-child{color:var(--dsw-alias-state-error-primary)}
[data-notebook-tags] .notebook-tag-row:has(.notebook-tag-actions[open]){position:relative;z-index:26}
[data-notebook-edit-source]{color:var(--dsw-alias-label-secondary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-notebook-original]{margin:12px 0;color:var(--dsw-alias-label-secondary)}[data-notebook-original] pre{white-space:pre-wrap;max-height:160px;overflow:auto}
[data-notebook-panel] button,[data-notebook-shell] button{font-size:13px!important}
[data-notebook-library] [data-notebook-search-form]~div>button:nth-child(2){float:right}
[data-notebook-library] [data-notebook-search-form]~div>button:nth-child(3):not([hidden]){float:right}
[data-notebook-library] [data-notebook-search-form]~div>ul{clear:both}
[data-notebook-connection=ready]{display:none}
[data-notebook-panel] :is(button,input,textarea,select,summary):focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
[data-notebook-panel] button[data-notebook-primary],[data-notebook-panel] [data-notebook-tag-filter]>button[aria-pressed=true]{background:var(--dsw-alias-brand-primary,#4869db)!important;border-color:var(--dsw-alias-brand-primary,#4869db)!important}
[data-notebook-panel] button[data-notebook-primary]:hover:not(:disabled){background:var(--dsw-alias-brand-primary,#4869db)!important;border-color:var(--dsw-alias-brand-primary,#4869db)!important}
[data-notebook-nav] button[aria-pressed=true]{color:var(--dsw-alias-brand-primary)}
/* Dense controls share one size, typography, and surface across the entire panel. */
[data-notebook-panel]{--nb-accent:var(--dsw-alias-brand-primary,#4869db);--nb-soft:var(--dsw-alias-bg-layer-2,#f5f7fb);--nb-line:var(--dsw-alias-border-l1,#e3e7ee)}
[data-notebook-panel] button:not([data-notebook-menu]){font:inherit!important;font-size:12px!important;line-height:1.35;min-height:30px!important;padding:5px 10px!important;border:1px solid var(--nb-line)!important;border-radius:7px!important;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary);cursor:pointer}
[data-notebook-panel] button:disabled{cursor:not-allowed!important}
[data-notebook-panel] button[data-notebook-primary],[data-notebook-panel] button[data-notebook-save],[data-notebook-panel] button[data-notebook-confirm]{background:var(--nb-accent)!important;color:#fff!important;border-color:var(--nb-accent)!important}
[data-notebook-panel] button[data-notebook-primary]:hover:not(:disabled),[data-notebook-panel] button[data-notebook-save]:hover:not(:disabled),[data-notebook-panel] button[data-notebook-confirm]:hover:not(:disabled){background:var(--nb-accent)!important;border-color:var(--nb-accent)!important;color:#fff!important}
[data-notebook-panel] button:not([data-notebook-primary]):not([data-notebook-save]):not([data-notebook-confirm]):not([aria-pressed=true]):hover:not(:disabled){background:var(--nb-soft)!important;border-color:var(--dsw-alias-border-l2,var(--nb-line))!important}
[data-notebook-toolbar]>button{min-height:32px!important}[data-notebook-nav] button{background:transparent!important;border-color:transparent!important}
[data-notebook-nav] button[aria-pressed=true]{background:transparent!important;color:var(--nb-accent)!important}
[data-notebook-editor]{padding:12px!important;margin:10px 0!important}[data-notebook-editor]>label{margin-bottom:10px}
[data-notebook-draft-warning]{font-size:12px;line-height:1.5;margin:8px 0;color:var(--dsw-alias-label-secondary)}
[data-notebook-draft-preview]>summary{display:block;cursor:pointer;font-size:12px!important;background:var(--dsw-alias-bg-base,#fff)}
[data-notebook-preview-notice]{margin:8px 0;padding:4px 9px;border-left:2px solid var(--nb-line);font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
[data-notebook-manual-library][data-draft-open=true]{margin-top:8px;padding:8px;border:0;background:transparent}
[data-notebook-manual-library][data-draft-open=true]>button:first-child{background:var(--nb-accent)!important;color:#fff!important;border-color:var(--nb-accent)!important}
[data-notebook-library] form{gap:6px;padding:9px!important;margin-bottom:8px;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--nb-line)}
[data-notebook-library] form>label{gap:3px;font-size:11px}[data-notebook-library] form>select{font-size:12px;padding:5px 7px;min-height:32px}
[data-notebook-library] form>button{min-height:30px!important;font-size:12px!important}
[data-notebook-filters]{grid-column:1/-1}[data-notebook-filters]>summary{padding:3px 0;font-size:12px}
[data-notebook-filters]>[data-notebook-tag-filter]{display:flex;flex-wrap:wrap;gap:4px;padding:8px 0 4px;border-top:1px solid var(--nb-line)}
[data-notebook-filters]>.notebook-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
[data-notebook-panel] [data-notebook-filters] [data-notebook-tag-filter]>button[aria-pressed=true],[data-notebook-panel] [data-notebook-filters] [data-notebook-tag-filter]>button[aria-pressed=true]:hover{background:var(--nb-accent)!important;border-color:var(--nb-accent)!important;color:#fff!important}
[data-notebook-tag-filter]{order:unset;grid-column:auto;border:0!important}[data-notebook-tag-filter]>button{min-height:26px!important;padding:3px 7px!important}
.notebook-filter-grid{gap:8px;padding:8px 0 4px}
[data-notebook-panel] [data-notebook-search-form]~div>button:disabled{display:none}
[data-notebook-bulk]{position:static;padding:6px 8px;margin:5px 0;gap:5px;font-size:12px;background:var(--nb-soft)}
[data-notebook-panel] [data-notebook-bulk] button{min-height:28px!important;padding:4px 8px!important}
[data-notebook-library] li{padding:12px}[data-notebook-library] li>p{margin:6px 0;line-height:1.5}
.notebook-card-footer{display:flex;flex-wrap:wrap;align-items:center;gap:5px 8px;margin-top:8px;min-width:0}
[data-notebook-library] li .notebook-card-footer>small{display:inline-block;margin:0!important;font-size:11px;white-space:nowrap;color:var(--dsw-alias-label-secondary)}
.notebook-card-footer>.notebook-card-tags{display:flex;align-items:center;flex-wrap:wrap;gap:3px;margin:0 3px 0 0}
.notebook-card-footer>.notebook-card-tags>span{font-size:11px;padding:1px 5px;color:var(--nb-accent)}
[data-notebook-library] li .notebook-card-footer>button{margin:0!important;min-height:28px!important;padding:4px 8px!important;font-size:12px!important}
[data-note-more]{position:relative;margin:0}[data-note-more][open]{display:inline-block;padding:0;background:transparent}
[data-note-more]>summary{display:inline-flex;align-items:center;min-height:28px!important;padding:4px 8px!important;font-size:11px!important;border:1px solid var(--nb-line);border-radius:7px;color:var(--dsw-alias-label-primary);list-style:none;cursor:pointer}
[data-note-more]>summary::-webkit-details-marker{display:none}
[data-notebook-panel] [data-note-more]>summary:hover{background:var(--nb-soft);border-color:var(--dsw-alias-border-l2,var(--nb-line))}
[data-note-more][open] .notebook-card-menu{top:calc(100% + 2px);right:0}
[data-notebook-library] li .notebook-card-menu>button{min-height:30px!important;margin:0!important;border:0!important;text-align:left}
[data-note-impact]{padding:16px!important;width:min(440px,calc(100vw - 32px));font-size:13px}
[data-note-impact]>h4{font-size:16px!important;margin:0 0 8px!important}
[data-note-impact]>p{font-size:12px;margin:0 0 8px;color:var(--dsw-alias-label-secondary)}
[data-note-impact]>[data-notebook-impact-list]{list-style:none;padding:0;margin:8px 0;display:grid;gap:4px;max-height:200px;overflow:auto}
[data-note-impact]>[data-notebook-impact-list]>li{padding:6px 8px;font-size:12px;border:1px solid var(--nb-line);border-radius:6px;box-shadow:none}
[data-notebook-backup]>p{font-size:13px;line-height:1.6;margin:8px 0}[data-notebook-backup]>button{margin:6px 0}
/* One compact control system, with visibly bounded neutral buttons and theme-aware overlays. */
[data-notebook-panel] button:not([data-notebook-menu]){border-color:var(--dsw-alias-border-l2,var(--nb-line))!important;box-shadow:0 1px 2px var(--dsw-alias-border-l1,#d9dee7)}
[data-notebook-panel] button:disabled{box-shadow:none;opacity:.48}
[data-notebook-panel] button[data-notebook-primary],[data-notebook-panel] button[data-notebook-confirm],[data-notebook-panel] button[data-notebook-save]{border-color:var(--nb-accent)!important;box-shadow:none}
[data-notebook-nav] button[aria-pressed=true]{border-color:var(--dsw-alias-border-l2,var(--nb-line))!important;background:var(--nb-soft)!important}
[data-notebook-library] form[data-notebook-search-form]{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px!important}
[data-notebook-library] form[data-notebook-search-form]>label{margin:0;gap:2px;grid-column:1/-1;order:0}
[data-notebook-library] form[data-notebook-search-form]>label input:not([type=checkbox]){min-height:32px;padding:5px 8px}
[data-notebook-library] form[data-notebook-search-form]>select{order:1;min-height:30px!important;padding:4px 7px!important;width:100%;grid-column:auto}
[data-notebook-library] form[data-notebook-search-form]>details{order:2;margin:0}
[data-notebook-library] form[data-notebook-search-form]>button{order:3;min-height:30px!important}
[data-notebook-library] form[data-notebook-search-form]>[data-notebook-filters]>summary{padding:2px 0 4px}
[data-notebook-panel] [data-note-more]>summary,[data-notebook-panel] .notebook-tag-actions>summary{border:1px solid var(--dsw-alias-border-l2,var(--nb-line));border-radius:7px;min-height:30px;display:inline-flex;align-items:center;padding:5px 9px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 1px 2px var(--dsw-alias-border-l1,#d9dee7);box-sizing:border-box}
[data-note-more][open] .notebook-card-menu,.notebook-tag-actions[open] .notebook-tag-menu{background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1,#fff));border-color:var(--dsw-alias-border-l2,var(--nb-line));box-shadow:0 8px 24px var(--dsw-alias-border-l1,#ddd)}
[data-note-more][open] .notebook-card-menu{z-index:1101;min-width:min(190px,calc(100vw - 16px));box-sizing:border-box}
[data-notebook-panel] [data-note-more][open] .notebook-card-menu>button,[data-notebook-panel] .notebook-tag-actions[open] .notebook-tag-menu>button{background:transparent!important;border:0!important;box-shadow:none;text-align:left}
[data-notebook-panel] [data-note-more][open] .notebook-card-menu>button:hover,[data-notebook-panel] .notebook-tag-actions[open] .notebook-tag-menu>button:hover{background:var(--dsw-alias-bg-layer-2,#f5f7fb)!important}
[data-notebook-library]>[role=dialog],[data-notebook-library]>[data-markdown-export],[data-notebook-library]>[data-note-edit],[data-notebook-library]>[data-note-detail],[data-notebook-library]>[data-note-impact],[data-notebook-tags]>[data-tag-impact][role=dialog]{background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base,#fff));border:1px solid var(--dsw-alias-border-l2,var(--nb-line));box-shadow:0 12px 36px var(--dsw-alias-border-l1,#d9dee7);border-radius:12px;padding:16px}
[data-note-edit-heading]{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}
[data-note-edit-heading] h4{margin:0!important;font-size:16px!important}
[data-note-edit-actions]{display:flex;align-items:center;gap:6px;margin-left:auto}
[data-notebook-panel] [data-note-edit-actions] button{margin:0!important;white-space:nowrap}
[data-notebook-panel] [data-note-edit] textarea{min-height:220px!important;height:220px;resize:vertical!important;overflow:auto}
[data-notebook-tags]>label:has(input[type=text]){display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 8px 10px 0;font-size:12px}
[data-notebook-panel] [data-notebook-tags]>label input[type=text]{width:min(210px,52vw)!important;max-width:min(210px,52vw)!important;min-height:32px!important;height:32px!important;padding:5px 8px!important;font-size:12px!important}
[data-notebook-tags]>label:has(input[type=text])+button{vertical-align:middle}
[data-notebook-panel] .notebook-card-footer>.notebook-card-tags>span{font-weight:700;color:var(--dsw-alias-brand-primary,#4869db);background:var(--dsw-alias-bg-layer-2,#f5f7fb)}
[data-notebook-panel] .notebook-card-footer>[data-note-more]{margin-left:auto;align-self:center}
[data-notebook-library] li .notebook-card-footer>small{font-weight:400;color:var(--dsw-alias-label-secondary,#737b89)}
[data-notebook-panel] .notebook-card-footer>button,[data-notebook-panel] .notebook-card-footer>[data-note-more]>summary{font-size:11px!important;font-weight:400;min-height:26px!important;padding:3px 7px!important}
[data-notebook-panel] [data-notebook-search-form]{grid-template-columns:repeat(3,minmax(0,1fr))!important}
[data-notebook-panel] [data-notebook-search-form]>[data-notebook-keyword]{display:flex;flex-direction:row;align-items:center;gap:10px;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;white-space:nowrap}
[data-notebook-panel] [data-notebook-search-form]>[data-notebook-keyword] input{flex:1;width:auto;min-width:0}
[data-notebook-panel] [data-notebook-search-form]>select{font-size:12px;min-width:0}
[data-notebook-panel] [data-note-detail] .notebook-detail-meta{margin:8px 0;padding:7px 10px;border-left:3px solid var(--dsw-alias-border-l2,var(--nb-line));background:var(--dsw-alias-bg-layer-2,var(--nb-soft));color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}
[data-notebook-panel] [data-note-detail] .notebook-detail-meta small{display:block;font-size:11px;overflow-wrap:anywhere}
[data-notebook-panel] [data-note-detail] .notebook-detail-tags{font-weight:700;color:var(--dsw-alias-brand-primary,#4869db)}
[data-notebook-panel] [data-markdown-export]>label{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:13px}
[data-notebook-panel] [data-markdown-export]>button{margin:10px 8px 0 0}
@media(max-width:520px){[data-notebook-panel] [data-notebook-search-form]{grid-template-columns:repeat(2,minmax(0,1fr))!important}[data-notebook-panel] [data-notebook-search-form]>select:nth-of-type(3){grid-column:1/-1}}
@media(max-width:480px){[data-note-edit-heading]{align-items:flex-start}[data-note-edit-actions]{width:100%;justify-content:flex-end}}
@media(max-width:480px){[data-notebook-panel]{padding:12px!important}[data-notebook-library] form{padding:8px}[data-notebook-toolbar]{gap:2px}[data-notebook-nav] button{padding:6px!important}.notebook-card-footer{gap:4px 6px}}
/* Search controls: one compact basic row and a small advanced section. */
[data-notebook-panel] [data-notebook-search-form]{display:grid;grid-template-columns:1fr!important;gap:7px!important;padding:10px!important}
.notebook-basic-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
[data-notebook-search-form]>.notebook-basic-filters{order:0}
[data-notebook-panel] .notebook-basic-filters select{min-width:0;width:100%;height:34px;padding:4px 7px;font-size:12px}
.notebook-basic-filters>[data-notebook-tag-filter]{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:5px;border:0;padding:3px 0 0}
.notebook-basic-filters>[data-notebook-tag-filter]>button{display:inline-flex;align-items:center;gap:3px}
.notebook-basic-filters>[data-notebook-tag-filter] .notebook-tag-color{width:10px;height:10px;margin-right:1px}
[data-notebook-search-form]>[data-notebook-filters]{grid-column:1;margin:0;order:1}
[data-notebook-filters]>.notebook-filter-grid{display:grid;grid-template-columns:minmax(90px,.6fr) repeat(2,minmax(0,1fr));gap:7px;padding:8px 0 2px;align-items:end}
[data-notebook-filters]>.notebook-filter-grid>label{display:flex;flex-direction:column;align-items:stretch;gap:3px;min-width:0;color:var(--dsw-alias-label-secondary)}
[data-notebook-filters] .notebook-filter-grid>label input{width:100%;min-width:0;margin:0}
[data-notebook-panel] [data-notebook-filters] .notebook-filter-grid>label input[type=datetime-local]{font-size:11px;padding:5px 4px;min-height:34px}
[data-notebook-filters] .notebook-filter-grid>label select{width:100%;min-width:0;height:34px;padding:4px 7px}
[data-notebook-filters] .notebook-filter-grid>label:first-child{grid-column:1/-1}
@container notebook-panel (max-width:680px){[data-notebook-filters]>.notebook-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}[data-notebook-filters] .notebook-filter-grid>label:nth-child(2){grid-column:1/-1}}
@container notebook-panel (max-width:400px){[data-notebook-filters]>.notebook-filter-grid{grid-template-columns:1fr}[data-notebook-filters] .notebook-filter-grid>label:first-child{grid-column:1}}
.notebook-filter-actions{display:flex;justify-content:flex-start;gap:6px;order:2}
[data-notebook-panel] .notebook-filter-actions>button{min-width:64px;min-height:28px!important;padding:4px 9px!important;font-size:11px!important;margin:0!important}
[data-notebook-panel] .notebook-card-footer>[data-note-more]{margin-left:0}
.notebook-card-actions{display:flex;align-items:center;justify-content:flex-start;flex-wrap:wrap;gap:6px;width:100%;margin-top:3px}
[data-notebook-panel] .notebook-card-actions>button{margin:0!important;min-height:26px!important;padding:3px 7px!important;font-size:11px!important}
[data-notebook-panel] .notebook-card-actions>[data-note-more]{margin:0!important}
[data-notebook-panel] .notebook-card-footer>.notebook-card-source{color:var(--nb-accent)!important;max-width:min(320px,100%);overflow:hidden;text-overflow:ellipsis}
[data-notebook-panel] .notebook-card-footer>.notebook-card-tags>span{color:var(--tag-color,#3A86FF)!important;background:var(--nb-soft);border-radius:5px}
[data-note-detail]{color:var(--dsw-alias-label-primary);line-height:1.55}
[data-note-detail]>h4{margin:0 0 12px!important;padding-bottom:10px;border-bottom:1px solid var(--nb-line)}
[data-notebook-panel] [data-note-detail] .notebook-detail-meta{border:1px solid var(--nb-line);border-left:3px solid var(--nb-accent);border-radius:7px;background:var(--dsw-alias-bg-base,#fff);padding:8px 11px;margin:10px 0}
.notebook-detail-tags{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0}
.notebook-detail-tags>span{display:inline-block;padding:2px 8px;border-radius:6px;color:var(--tag-color,#3A86FF);background:var(--nb-soft);font-size:12px}
[data-notebook-tag-colors]{display:flex;flex-wrap:wrap;gap:7px;border:1px solid var(--nb-line);border-radius:8px;padding:8px;margin:10px 0}
[data-notebook-tag-colors] legend{font-size:12px;color:var(--dsw-alias-label-secondary)}
[data-notebook-tag-colors] label{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border:1px solid var(--nb-line);border-radius:6px;cursor:pointer}
[data-notebook-tag-colors] label:has(input:checked){border-color:var(--nb-accent);background:var(--nb-soft)}
[data-notebook-tag-colors] label:has(input:focus-visible){outline:2px solid var(--dsw-alias-brand-primary,#3A86FF);outline-offset:1px}
[data-notebook-panel] [data-notebook-tag-colors] input:focus-visible{outline:none;box-shadow:none}
[data-notebook-tag-colors] .notebook-color-swatch{width:20px;height:20px;border-radius:50%;background:var(--choice-color);border:1px solid var(--nb-line)}
[data-notebook-tag-edit-dialog]{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1102;width:min(520px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;padding:20px;border:1px solid var(--nb-line);border-radius:12px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base,#fff));box-shadow:0 16px 60px #14213a25}
[data-notebook-tag-edit-dialog] h4{margin:0 0 16px;font-size:16px}
[data-notebook-tag-edit-dialog]>label{display:block;margin:10px 0}
[data-notebook-tag-edit-dialog]>label input{display:block;width:100%;margin-top:6px}
[data-notebook-tag-edit-actions]{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.notebook-detail-quote,.notebook-detail-body{padding:10px 12px;margin:10px 0;border:1px solid var(--nb-line);border-radius:8px;background:var(--dsw-alias-bg-base,#fff);overflow-wrap:anywhere}
.notebook-detail-quote>p{margin:0 0 6px;color:var(--dsw-alias-label-secondary);font-size:12px}
.notebook-detail-quote>pre{margin:0;white-space:pre-wrap}
.notebook-compose-tags{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;padding:8px;border:1px solid var(--nb-line);border-radius:8px}
.notebook-compose-tags legend{font-size:12px;color:var(--dsw-alias-label-secondary)}
.notebook-compose-tags label{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:6px;background:var(--nb-soft);font-size:12px}
.notebook-compose-tags .notebook-tag-color{margin-right:2px}
/* Tag manager: one clear type scale across the list, controls and color picker. */
[data-notebook-panel] [data-notebook-tag-heading] h4{font-size:15px;line-height:1.4;margin:8px 0 6px}
[data-notebook-panel] [data-notebook-tags] .notebook-tag-row{min-height:34px;padding:8px 0}
[data-notebook-panel] [data-notebook-tags] .notebook-tag-row>span{font-size:13px;line-height:1.4}
[data-notebook-panel] [data-notebook-tags] .notebook-tag-row small{font-size:11px;color:var(--dsw-alias-label-secondary)}
[data-notebook-panel] [data-notebook-tags] .notebook-tag-actions>summary,
[data-notebook-panel] [data-notebook-tags] .notebook-tag-menu>button,
[data-notebook-panel] [data-notebook-tags]>label:has(input[type=text]),
[data-notebook-panel] [data-notebook-tags]>button,
[data-notebook-panel] [data-notebook-tag-colors] legend,
[data-notebook-panel] [data-notebook-tag-colors] label{font-size:11px!important;line-height:1.4}
[data-notebook-panel] [data-notebook-tags]>label input[type=text],
[data-notebook-panel] [data-notebook-tag-edit-dialog]>label input{font-size:11px!important}
[data-notebook-panel] [data-notebook-tag-edit-dialog] h4{font-size:15px}
[data-notebook-panel] [data-notebook-tag-edit-dialog]>label{font-size:11px}
[data-notebook-panel] [data-notebook-tag-edit-dialog] button{font-size:11px!important}
[data-notebook-panel] [data-notebook-tags] .notebook-tag-actions>summary{min-height:28px}
[data-notebook-panel] [data-notebook-tag-colors] label{min-height:32px;box-sizing:border-box}
[data-notebook-panel] [data-notebook-tag-colors] .notebook-color-swatch{width:18px;height:18px}
/* One blue action palette for the notebook tabs, active tag filters and primary actions. */
[data-notebook-panel] [data-notebook-unified-home] [data-notebook-nav] button[aria-pressed=true],
[data-notebook-panel] [data-notebook-unified-home] [data-notebook-tag-filter]>button[aria-pressed=true]{background:rgb(58 134 255 / 14%)!important;border-color:rgb(58 134 255 / 42%)!important;color:color-mix(in srgb,#3A86FF 72%,var(--dsw-alias-label-primary,#111))!important;box-shadow:none!important}
[data-notebook-panel] [data-notebook-unified-home] [data-notebook-nav] button[aria-pressed=true]:hover,
[data-notebook-panel] [data-notebook-unified-home] [data-notebook-tag-filter]>button[aria-pressed=true]:hover{background:rgb(58 134 255 / 20%)!important}
[data-notebook-panel] [data-notebook-unified-home] [data-notebook-nav] button:not([aria-pressed=true]):hover,
[data-notebook-panel] [data-notebook-unified-home] [data-notebook-tag-filter]>button:not([aria-pressed=true]):hover{background:rgb(58 134 255 / 8%)!important;border-color:rgb(58 134 255 / 32%)!important}
[data-notebook-panel] [data-notebook-unified-home] [data-notebook-tag-filter]>button{font-size:11px!important;line-height:1.3;min-height:27px!important;padding:4px 7px!important}
[data-notebook-panel] [data-notebook-unified-home] button[data-notebook-primary]{background:#2563EB!important;border-color:#2563EB!important;color:#fff!important;box-shadow:none!important}
[data-notebook-panel] [data-notebook-unified-home] button[data-notebook-primary]:hover:not(:disabled){background:#1D4ED8!important;border-color:#1D4ED8!important;color:#fff!important}
@media(max-width:520px){.notebook-basic-filters{grid-template-columns:1fr}}


`;
        const dialogKeys = event => {
          if (event.key === 'Escape') { const cancel = event.currentTarget.querySelector('[data-dialog-cancel]:not(:disabled)'); if (cancel) { event.preventDefault(); event.stopPropagation(); cancel.click(); } return; }
          if (event.key !== 'Tab') return;
          const controls = Array.from(event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')).filter(element => element.getClientRects().length);
          if (!controls.length) { event.preventDefault(); return; }
          const first = controls[0], last = controls.at(-1), current = event.currentTarget.ownerDocument.activeElement;
          if (event.shiftKey && (current === first || current === event.currentTarget)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (current === last || current === event.currentTarget)) { event.preventDefault(); first.focus(); }
        };
        ctx.effect(() => {
          const document = window.document;
          if (!document?.head?.appendChild || typeof document.createElement !== 'function') return () => {};
          const style = document.createElement('style'); style.textContent = notebookStyles;
          document.head.appendChild(style);
          return () => style.remove();
        });
        function ConversationAnnotations({ sessionId, useWorkspaces }) {
          const ready = useStorageReady();
          const [tagMenu, setTagMenu] = React.useState(false);
          const [confirmDiscard, setConfirmDiscard] = React.useState(false);
          const [editing, setEditing] = React.useState(false);
          const [tags, setTags] = React.useState([]);
          const [tagDiagnostic, setTagDiagnostic] = React.useState(null);
          React.useEffect(() => {
            if (!ready) return;
            const pending = new AbortController();
            getManualApi().tagsList(pending.signal).then(value => {
              if (!pending.signal.aborted) { setTags(value.items); setTagDiagnostic(null); }
            }).catch(error => { if (!pending.signal.aborted) setTagDiagnostic(safeDiagnostic(error)); });
            return () => pending.abort();
          }, [ready, tagMenu]);
          const [state, setState] = React.useState(null);
          const workspacePath = useWorkspaces(snapshot => {
            if (snapshot.phase !== 'ready') return null;
            const matches = snapshot.items.filter(item => item.sessionIds.includes(sessionId));
            return matches.length === 1 ? matches[0].path : null;
          });
          const adapter = React.useRef(null);
          React.useEffect(() => {
            if (!ready || !sessionId || typeof window.document?.addEventListener !== 'function') return;
            const createRequestId = () => {
              const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
              return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
            };
            let annotationStatus;
            const instance = conversationAnnotations({ document: window.document, sessionId,
              readBodies: () => renderedConversationBodies(window.document, sessionId),
              api: getManualApi(), createRequestId, initialDraft: annotationDrafts.get(sessionId),
              source: { sessionId, ...(workspacePath ? { workspacePath } : {}) }, registry: window.CSS?.highlights,
              Highlight: window.Highlight, MutationObserver: window.MutationObserver, onChange: value => {
                annotationDrafts.set(sessionId, { draft: value.draft, pending: value.pending, bodyMarkdown: value.bodyMarkdown, tagIds: value.tagIds, newTagName: value.newTagName });
                setState(value);
                if (value.status === 'saved' && annotationStatus !== 'saved') for (const refresh of libraryRefreshListeners) refresh();
                annotationStatus = value.status;
              } });
            adapter.current = instance; void instance.reload();
            return () => { instance.dispose(); adapter.current = null; };
          }, [ready, sessionId, workspacePath]);
          React.useEffect(() => {
            if (!state?.draft) { setTagMenu(false); setEditing(false); setConfirmDiscard(false); }
          }, [state?.draft]);
          React.useEffect(() => { setTagMenu(false); setEditing(false); }, [sessionId]);
          if (!ready || !state) return null;
          const draft = state.draft;
          const body = state.bodyMarkdown ?? "";
          const working = state.status === 'saving';
          const problem = state.items?.filter(item => item.status !== 'found');
          const annotationSaveStyle = { ...controlStyle,
            background: 'color-mix(in srgb, var(--dsw-alias-brand-primary,#4869db) 10%, transparent)',
            borderColor: 'color-mix(in srgb, var(--dsw-alias-brand-primary,#4869db) 38%, transparent)',
            color: 'var(--dsw-alias-brand-primary,#4869db)', fontWeight: 600 };
          const detailStyle = { position: 'fixed', zIndex: 1000, left: Math.max(8, Math.min(state.detailPosition?.left ?? 16, (window.innerWidth ?? 800) - 350)),
            top: Math.max(8, Math.min((state.detailPosition?.top ?? 16) + 8, (window.innerHeight ?? 600) - 260)), width: 320, maxHeight: 240, overflow: 'auto', padding: 12, border: '1px solid #999',
            borderRadius: 8, background: 'var(--dsw-alias-bg-base, white)', color: 'var(--dsw-alias-label-primary, #222)' };
          return h('div', { 'data-notebook-annotations': '', style: { fontSize: 12 } },
            h('style', null, adapter.current ? `::highlight(${adapter.current.name}) { background-color: #ffe58f; color: #222; }` : ''),
            state.candidates?.length ? h('div', { role: 'dialog', 'aria-label': '选择重叠批注', style: detailStyle },
              h('p', null, '此处有多条批注，请选择：'), ...state.candidates.map(id => h('button', { key: id, type: 'button', style: controlStyle,
                onClick: () => void adapter.current?.openDetail(id) }, id)),
              h('button', { type: 'button', style: controlStyle, onClick: () => adapter.current?.closeDetail() }, '关闭')) : null,
            state.detail ? h('div', { role: 'dialog', 'aria-label': '原文批注', style: detailStyle },
              h('blockquote', { style: { whiteSpace: 'pre-wrap' } }, state.detail.quote?.content ?? ''),
              h('p', { style: { whiteSpace: 'pre-wrap' } }, state.detail.bodyMarkdown ?? ''),
              h('button', { type: 'button', style: controlStyle, onClick: () => adapter.current?.closeDetail() }, '关闭')) : null,
            problem?.length ? h('details', { style: { color: 'var(--dsw-alias-label-secondary, #666)', padding: '4px 0' } },
              h('summary', null, `${problem.length} 条划线尚未定位`),
              h('p', { role: 'status' }, '原文可能尚未加载、文本结构无法映射，或存在多个匹配。加载相关消息后可刷新文字标记。')) : null,
            !draft && state.diagnostic ? h('code', { role: 'status' }, safeDiagnostic({ code: state.diagnostic })) : null,
            !draft && state.status === 'failed' ? h('button', { type: 'button', style: controlStyle,
              onClick: () => void adapter.current?.reload() }, '刷新文字标记') : null,
            draft ? h('div', { 'data-notebook-overlay': '', role: 'dialog', 'aria-label': '选区操作',
              style: { position: 'fixed', zIndex: 1000, left: Math.max(12, Math.min(draft.position.left, (window.innerWidth ?? 800) - (editing || tagMenu ? 274 : 240))),
                top: Math.max(12, Math.min(draft.position.top + 8, (window.innerHeight ?? 600) - (editing || tagMenu ? 280 : 56))),
                width: editing || tagMenu ? 250 : 'max-content', maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto',
                padding: 6, border: '1px solid var(--dsw-alias-border-l1, #d9dee7)', boxShadow: '0 4px 18px #0002', borderRadius: 9,
                background: 'var(--dsw-alias-bg-base, white)', color: 'var(--dsw-alias-label-primary, #222)' } },
              h('div', { 'data-annotation-actions': true, style: { display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' } },
                h('button', { type: 'button', style: annotationSaveStyle, disabled: working || !!state.pending || (tagMenu && !!tagDiagnostic),
                  onClick: () => void adapter.current?.save('highlight') }, body.trim() ? (tagMenu ? '保存笔记' : '保存') : '保存划线'),
                h('button', { type: 'button', style: controlStyle, 'aria-label': '添加标签', 'aria-expanded': tagMenu, disabled: working || !!state.pending,
                  onClick: () => { setTagMenu(value => !value); setEditing(false); } }, '标签 ▾'),
                h('button', { type: 'button', style: controlStyle, disabled: working || !!state.pending,
                  onClick: () => { setEditing(value => !value); setTagMenu(false); } }, '记笔记'),
                h('button', { type: 'button', style: controlStyle, 'aria-label': '取消选区操作', disabled: working || !!state.pending,
                  onClick: () => { if (body) setConfirmDiscard(true); else adapter.current?.discard(); } }, '×')),
              confirmDiscard ? h('div', { 'data-annotation-discard': true }, h('p', null, '丢弃尚未保存的笔记？'),
                h('button', { type: 'button', style: annotationSaveStyle, onClick: () => { adapter.current?.discard(true); setConfirmDiscard(false); } }, '丢弃'),
                h('button', { type: 'button', style: controlStyle, onClick: () => setConfirmDiscard(false) }, '继续编辑')) : null,
              tagMenu ? h('div', { 'data-annotation-tags': true, style: { padding: 4, display: 'grid', gap: 5 } },
                h('fieldset', { 'data-annotation-tag-picker': true, disabled: working || !!state.pending,
                  style: { margin: 0, padding: 6, border: '1px solid var(--dsw-alias-border-l1, #d9dee7)', borderRadius: 6,
                    maxHeight: 160, overflowY: 'auto' } },
                  h('legend', null, '选择标签'),
                  ...tags.map(tag => h('label', { key: tag.id, style: { display: 'flex', alignItems: 'center', gap: 5, padding: '3px 2px', cursor: 'pointer' } },
                    h('input', { type: 'checkbox', checked: (state.tagIds ?? []).includes(tag.id),
                      disabled: working || !!state.pending || (!(state.tagIds ?? []).includes(tag.id) && (state.tagIds ?? []).length >= 10),
                      onChange: event => adapter.current?.editTags(event.target.checked
                        ? [...new Set([...(state.tagIds ?? []), tag.id])]
                        : (state.tagIds ?? []).filter(id => id !== tag.id), state.newTagName) }),
                    h('span', { className: 'notebook-tag-color', 'aria-hidden': true,
                      style: { '--tag-color': resolvedTagColor(tag.color, tag.id), marginRight: 0 } }), tag.name))),
                h('input', { 'aria-label': '新标签名称', placeholder: '新建标签（可选）', value: state.newTagName ?? '', disabled: working || !!state.pending,
                  onChange: event => adapter.current?.editTags(state.tagIds ?? [], event.target.value) }),
                tagDiagnostic ? h('code', { role: 'status' }, tagDiagnostic) : null) : null,
              !tagMenu && ((state.tagIds ?? []).length || state.newTagName) ? h('div', { 'data-annotation-selected-tags': true, style: { padding: '6px 8px', fontSize: 11, color: 'var(--dsw-alias-label-secondary, #666)' } }, '标签：', [...(state.tagIds ?? []).map(id => tags.find(tag => tag.id === id)?.name ?? id), ...(state.newTagName ? [state.newTagName] : [])].join('、')) : null,
              editing ? h('div', { style: { padding: 8 } },
                h('textarea', { value: body, placeholder: '笔记内容', 'aria-label': '笔记内容', disabled: working || !!state.pending,
                  onChange: event => adapter.current?.editBody(event.target.value), style: { boxSizing: 'border-box', width: '100%', minHeight: 96 } })) : null,
              state.pending && !working ? h('button', { type: 'button', style: controlStyle, onClick: () => void adapter.current?.retry() }, '重试同一保存') : null,
              state.diagnostic ? h('code', { role: 'status' }, safeDiagnostic({ code: state.diagnostic })) : null) : null);

        }
        function GlobalEntry({ wide }) {
          return h(Entry, { global: true, wide, nativeOnly: true });
        }
        function Entry({ sessionId, global = false, wide = true, nativeOnly = false }) {
          const text = useText();
          React.useSyncExternalStore(subscribe, () => sidebar);
          const pane = sidebar;
          const button = React.useRef(null);
          React.useEffect(() => {
            const element = button.current;
            return () => {
              if (openedBy && openedBy.sessionId === sessionId && openedBy.button === element) close();
            };
          }, [sessionId]);
          return h('button', {
            type: 'button', ref: button, 'data-notebook-menu': global || undefined, title: text('open'),
            style: global ? { ...controlStyle, display: 'flex', alignItems: 'center', gap: 7, width: '100%', minWidth: 0,
              background: 'transparent', border: 'none', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' } : controlStyle,
            onClick: () => {
              if (sidebar) { sidebar.openTab(namespace); return; }
              if (nativeOnly) return;
              openedBy = { sessionId, global, button: button.current }; notify();
            },
            disabled: nativeOnly && !pane, 'aria-label': text('open'), 'aria-haspopup': 'dialog',
          }, h('span', { 'aria-hidden': true }, '▤'), wide ? h('span', { style: { whiteSpace: 'nowrap' } }, text('title')) : null);
        }
        function Overlay() {
          const owner = React.useSyncExternalStore(subscribe, () => openedBy);
          const text = useText();
          const dialog = React.useRef(null);
          const [draft, setDraft] = useRetainedDraft('global-overlay');
          const closeOverlay = () => {
            if (draft.open && (draft.title || draft.body || draft.tagIds?.length)) { setDraft(value => ({ ...value, confirm: true, closeAfterDiscard: true })); return; }
            close();
          };
          const closeAction = React.useRef(closeOverlay);
          closeAction.current = closeOverlay;
          React.useEffect(() => {
            if (!owner) return undefined;
            const element = dialog.current;
            const previous = owner.button;
            element?.querySelector('button')?.focus();
            const onKey = event => {
              if (event.key === 'Escape') { event.preventDefault(); closeAction.current(); }
            };
            element?.addEventListener('keydown', onKey);
            return () => {
              element?.removeEventListener('keydown', onKey);
              if (previous?.isConnected) previous.focus();
            };
          }, [owner]);
          if (!owner) return null;
          return h('div', {
            role: 'dialog', 'data-notebook-shell': true, 'aria-label': text('title'), ref: dialog,
            style: {
              pointerEvents: 'auto', position: 'fixed', right: 16, bottom: 80,
              width: 'min(320px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 112px)',
              overflow: 'auto', boxSizing: 'border-box', padding: 16, borderRadius: 8,
              background: 'var(--dsw-alias-bg-overlay)', color: 'var(--dsw-alias-label-primary)',
              border: '1px solid var(--dsw-alias-border-l2)',
            },
          }, h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
            h('strong', null, text('title')),
            h('button', { type: 'button', style: controlStyle, onClick: closeOverlay }, text('close'))),
          h(ManualDraft, { draftKey: 'global-overlay', draft, setDraft,
            onDiscard: closeAfterDiscard => { if (closeAfterDiscard) close(); } }),
          h(VersionLabel), h(ConnectionStatus));
        }
        function VersionLabel() {
          return h('small', { 'data-notebook-version': version,
            style: { color: 'var(--dsw-alias-label-secondary)' } }, `v${version}`);
        }
        function ConnectionStatus() {
          const text = useText();
          const [state, setState] = React.useState('connecting');
          const [attempt, setAttempt] = React.useState(0);
          const [diagnostic, setDiagnostic] = React.useState(null);
          React.useEffect(() => {
            const controller = new AbortController();
            let active = true;
            const timeout = setTimeout(() => {
              if (active) { setStorageReady(false); setDiagnostic('TIMEOUT'); setState('failed'); controller.abort(); }
            }, 10000);
            setDiagnostic(null);
            setState('connecting');
            const check = async () => {
              try {
                const read = async endpoint => {
                  if (controller.signal.aborted) throw new Error('REQUEST_CANCELLED');
                  const result = await ctx.connection.rpc.call('/api', `dsh-session-notebook/${endpoint}`, {}, controller.signal);
                  if (!result || result.ok !== true) {
                    const error = new Error('HOST_RESPONSE_FAILED');
                    const code = result?.error?.code;
                    const known = ['CANCELLED', 'VALIDATION_FAILED', 'gateway/cancelled', 'gateway/internal'];
                    error.diagnostic = known.includes(code) ? `RPC:${code}` : 'RPC_FAILED';
                    throw error;
                  }
                  return result.value;
                };
                const health = await read('health');
                if (!health || health.status !== 'ok'
                  || !((health.phase === 0 && health.storageReady === false)
                    || (health.phase === 1 && health.storageReady === true))) {
                  throw new Error('INVALID_HEALTH_RESPONSE');
                }
                if (health.storageReady) {
                  await getManualApi().list({}, controller.signal);
                } else {
                  const list = await read('list');
                  if (!list || list.phase !== 0 || list.storageReady !== false
                    || !Array.isArray(list.items) || list.items.length !== 0) throw new Error('INVALID_LIST_RESPONSE');
                }
                if (active && !controller.signal.aborted) {
                  setStorageReady(health.storageReady);
                  const startupCodes = ['STORE_CORRUPT', 'STORE_OWNED', 'STORE_UNSUPPORTED', 'INVALID_CONFIG', 'SNAPSHOT_LIMIT', 'STORE_UNAVAILABLE', 'READ_UNAVAILABLE'];
                  setDiagnostic(!health.storageReady && startupCodes.includes(health.diagnostic) ? health.diagnostic : null);
                  setState(health.storageReady ? 'ready' : 'connected');
                }
              } catch (error) {
                if (active && !controller.signal.aborted) {
                  setStorageReady(false);
                  const invalid = ['INVALID_HEALTH_RESPONSE', 'INVALID_LIST_RESPONSE'];
                  const rpcCodes = ['RPC_FAILED', 'RPC:CANCELLED', 'RPC:VALIDATION_FAILED', 'RPC:gateway/cancelled', 'RPC:gateway/internal'];
                  setDiagnostic(rpcCodes.includes(error?.diagnostic) ? error.diagnostic
                    : invalid.includes(error?.message) ? error.message : 'TRANSPORT_FAILED');
                  setState('failed');
                }
              } finally {
                clearTimeout(timeout);
              }
            };
            void check();
            return () => { active = false; controller.abort(); clearTimeout(timeout); };
          }, [attempt]);
          return h('div', { role: 'status', 'aria-live': 'polite', 'data-notebook-connection': state },
            h('p', null, text(state)),
            diagnostic ? h('code', null, diagnostic) : null,
            state === 'failed' ? h('button', {
              type: 'button', style: controlStyle, onClick: () => setAttempt(value => value + 1),
            }, text('retry')) : null);
        }
        function SafePreview({ body }) {
          // A deliberately bounded Markdown subset. Never generate HTML or load
          // images; React escapes all text. Unknown syntax stays readable.
          const inline = value => {
            const result = []; let start = 0;
            const tokens = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|!?\[([^\]\n]+)\]\(([^\s)]+)\)/g;
            for (const match of value.matchAll(tokens)) {
              result.push(value.slice(start, match.index));
              const key = match.index;
              if (match[1] !== undefined) result.push(h('code', { key }, match[1]));
              else if (match[2] !== undefined) result.push(h('strong', { key }, match[2]));
              else {
                let allowed = false;
                try {
                  const url = new URL(match[4]);
                  allowed = /^https?:\/\//i.test(match[4]) && ['http:', 'https:'].includes(url.protocol)
                    && !url.username && !url.password && !/[\u0000-\u0020\u007f]/.test(match[4]);
                } catch { /* literal fallback */ }
                result.push(allowed && !match[0].startsWith('!')
                  ? h('a', { key, href: match[4], target: '_blank', rel: 'noopener noreferrer',
                    referrerPolicy: 'no-referrer' }, match[3]) : match[0]);
              }
              start = match.index + match[0].length;
            }
            result.push(value.slice(start)); return result;
          };
          const lines = body.split(/\r\n|\n|\r/), blocks = [];
          for (let index = 0; index < lines.length; index++) {
            const line = lines[index], key = index;
            const fence = /^ {0,3}(`{3,}|~{3,})([^`]*)$/.exec(line);
            if (fence) {
              const content = [], marker = fence[1][0], size = fence[1].length;
              while (++index < lines.length) {
                const closing = /^ {0,3}([`~]+)\s*$/.exec(lines[index]);
                if (closing && [...closing[1]].every(char => char === marker) && closing[1].length >= size) break;
                content.push(lines[index]);
              }
              blocks.push(h('pre', { key, style: { overflowX: 'auto', whiteSpace: 'pre' } },
                h('code', null, content.join('\n'))));
              continue;
            }
            const heading = /^(#{1,6})\s+(.+)$/.exec(line);
            const task = /^\s*[-*+] \[([ xX])\] (.*)$/.exec(line);
            const list = /^\s*(?:[-*+]|\d+\.) (.*)$/.exec(line);
            if (heading) blocks.push(h(`h${heading[1].length}`, { key }, ...inline(heading[2])));
            else if (task) blocks.push(h('div', { key },
              h('input', { type: 'checkbox', checked: task[1] !== ' ', disabled: true, 'aria-label': task[2] }),
              ...inline(task[2])));
            else if (list) blocks.push(h('div', { key }, '• ', ...inline(list[1])));
            else blocks.push(h('div', { key, style: { whiteSpace: 'pre-wrap', minHeight: '1em' } }, ...inline(line)));
          }
          return h('div', { 'data-notebook-preview': true, style: { overflowWrap: 'anywhere' } }, ...blocks);
        }
        function DraftTags({ selected, locked, onChange }) {
          const [available, setAvailable] = React.useState([]);
          React.useEffect(() => {
            const controller = new AbortController();
            getManualApi().library({ scope: 'all', offset: 0, limit: 1 }, controller.signal)
              .then(value => { if (!controller.signal.aborted) setAvailable(value.tags ?? []); })
              .catch(() => {});
            return () => controller.abort();
          }, []);
          return h('fieldset', { className: 'notebook-compose-tags', disabled: locked },
            h('legend', null, '标签（最多 10 个）'),
            available.length ? available.map(tag => h('label', { key: tag.id },
              h('input', { type: 'checkbox', checked: selected.includes(tag.id),
                disabled: locked || (!selected.includes(tag.id) && selected.length >= 10),
                onChange: event => onChange(event.target.checked
                  ? [...new Set([...selected, tag.id])]
                  : selected.filter(id => id !== tag.id)) }),
              h('span', { className: 'notebook-tag-color', 'aria-hidden': true,
                style: { '--tag-color': resolvedTagColor(tag.color, tag.id) } }), tag.name))
              : h('small', null, '暂无标签，可在标签页面新建'));
        }
        function ManualDraft({ draftKey, draft, setDraft, onDiscard, sessionId, useWorkspaces, unified = false }) {
          const text = useText();
          const ready = useStorageReady();
          const [saveController, saveState] = useManualController(draftKey);
          const locked = !!saveState.pending || !!draft.saving || savingKeys.has(draftKey);
          const { open, title, body, confirm } = draft;
          const update = change => setDraft(value => ({ ...value, ...change }));
          const copying = React.useRef({ active: true, epoch: 0, pending: false });
          React.useEffect(() => {
            const guard = copying.current;
            guard.active = true;
            return () => { guard.active = false; guard.epoch++; guard.pending = false; };
          }, []);
          const discard = () => {
            if (saveState.status === 'saving' || savingKeys.has(draftKey)) return;
            if (saveState.pending) saveController.discardConfirmed();
            copying.current.epoch++;
            copying.current.pending = false;
            setDraft({ open: false, title: '', body: '', tagIds: [], confirm: false });
            onDiscard?.(draft.closeAfterDiscard === true);
          };
          const copy = async () => {
            const guard = copying.current;
            if (!body || guard.pending || !guard.active) return;
            const epoch = guard.epoch;
            guard.pending = true;
            update({ copyStatus: 'copyingDraft' });
            let status;
            try {
              if (typeof navigator === 'undefined' || typeof navigator.clipboard?.writeText !== 'function') {
                throw new Error('CLIPBOARD_UNAVAILABLE');
              }
              await navigator.clipboard.writeText(body);
              status = 'copiedDraft';
            } catch { status = 'copyDraftFailed'; }
            finally {
              if (guard.active && guard.epoch === epoch) guard.pending = false;
            }
            if (guard.active && guard.epoch === epoch) {
              setDraft(value => value.open ? { ...value, copyStatus: value.body === body ? status : null } : value);
            }
          };
          if (!open && unified) return null;
          if (!open) {
            const opener = h('button', { type: 'button', style: controlStyle,
              onClick: () => update({ open: true }) }, text('manualDraft'));
            return ready ? h('div', { 'data-notebook-home': true }, opener,
              h(LibraryLauncher, { sessionId, useWorkspaces }),
              h(ManualNotebook, { draftKey, draft, setDraft })) : opener;
          }
          return h('section', { 'data-notebook-editor': true, 'aria-label': text('manualDraft'),
            style: { marginTop: 12, padding: 12, border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 6 } },
          h('label', { style: { display: 'block' } }, text('draftTitle'),
            h('input', { type: 'text', value: title ?? '', disabled: locked,
              onChange: event => { if (!locked && !savingKeys.has(draftKey)) update({ title: event.target.value }); },
              style: { display: 'block', boxSizing: 'border-box', width: '100%', marginTop: 8,
                color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-2)',
                border: '1px solid var(--dsw-alias-border-l1)', fontFamily: 'inherit' } })),
          h('label', { style: { display: 'block' } }, text('draftBody'),
            h('textarea', { value: body, rows: 5, disabled: locked,
              onChange: event => { if (!locked && !savingKeys.has(draftKey)) update({ body: event.target.value,
                copyStatus: copying.current.pending ? 'copyingDraft' : null }); },
              style: { display: 'block', boxSizing: 'border-box', width: '100%', marginTop: 8,
                color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-2)',
                border: '1px solid var(--dsw-alias-border-l1)', fontFamily: 'inherit' } })),
          h('p', { role: 'status', 'data-notebook-draft-warning': true,
            style: { color: 'var(--dsw-alias-label-secondary)' } }, text('draftWarning')),
          confirm ? h('div', null,
            h('p', null, text('confirmDiscard')),
            h('button', { type: 'button', style: controlStyle,
              disabled: saveState.status === 'saving' || savingKeys.has(draftKey),
              onClick: discard }, text('discardDraft')),
            h('button', { type: 'button', style: controlStyle, onClick: () => update({ confirm: false, closeAfterDiscard: false }) }, text('cancelDiscard')))
            : h('button', { type: 'button', style: controlStyle,
              onClick: () => { if (title || body || draft.tagIds?.length) update({ confirm: true, closeAfterDiscard: false }); else discard(); } }, text('discardDraft')),
          h('button', { type: 'button', style: controlStyle, disabled: !body || draft.copyStatus === 'copyingDraft',
            onClick: copy }, text(draft.copyStatus === 'copyingDraft' ? 'copyingDraft' : 'copyDraft')),
          draft.copyStatus ? h('p', { role: 'status', 'aria-live': 'polite' }, text(draft.copyStatus)) : null,
          h('details', { 'data-notebook-draft-preview': true }, h('summary', { style: controlStyle }, text('previewDraft')),
            h('blockquote', { 'data-notebook-preview-notice': true }, text('previewNotice')),
            h(SafePreview, { body })),
          ready ? h(DraftTags, { selected: draft.tagIds ?? [], locked,
            onChange: tagIds => update({ tagIds }) }) : null,
          ...(ready ? [!unified ? h(LibraryLauncher, { sessionId, useWorkspaces }) : null,
            h(ManualNotebook, { draftKey, draft, setDraft, editorOnly: unified })] : []));
        }
        function ManualNotebook({ draftKey, draft, setDraft, editorOnly = false }) {
          const text = useText();
          const [controller, saveState] = useManualController(draftKey);
          const [library, setLibrary] = React.useState(null);
          const [detail, setDetail] = React.useState(null);
          const [diagnostic, setDiagnostic] = React.useState(null);
          const [searchDraft, setSearchDraft] = React.useState('');
          const [activeSearch, setActiveSearch] = React.useState('');
          const [backupStatus, setBackupStatus] = React.useState(null);
          const active = React.useRef(false);
          const busy = React.useRef(false);
          const backupBusy = React.useRef(false);
          const reads = React.useRef(new Set());
          const listSequence = React.useRef(0);
          const read = async operation => {
            const pending = new AbortController(); reads.current.add(pending);
            try { return await operation(pending.signal); }
            finally { reads.current.delete(pending); }
          };
          const reload = async (search = activeSearch) => {
            const sequence = ++listSequence.current;
            try {
              const value = await read(signal => getManualApi().list(search ? { search } : {}, signal));
              if (active.current && sequence === listSequence.current) {
                setLibrary(value); setDiagnostic(null);
              }
              return value;
            } catch (error) {
              if (active.current && sequence === listSequence.current) setDiagnostic(safeDiagnostic(error));
              throw error;
            }
          };
          React.useEffect(() => {
            active.current = true;
            setLibrary(null); setDetail(null); setDiagnostic(null); setBackupStatus(null);
            setSearchDraft(''); setActiveSearch('');
            void reload('').catch(() => {});
            return () => {
              active.current = false;
              listSequence.current++;
              for (const pending of reads.current) pending.abort();
              reads.current.clear();
              controller.cancel();
            };
          }, [draftKey]);
          const saved = async receipt => {
            const value = { open: !editorOnly, title: '', body: '', tagIds: [], confirm: false };
            retainedDrafts.set(draftKey, value);
            if (active.current) setDraft(value);
            if (active.current) {
              for (const refresh of libraryRefreshListeners) refresh();
              if (!editorOnly) { await reload().catch(() => {}); if (receipt?.noteId) await openDetail(receipt.noteId); }
            }
          };
          const save = async meta => {
            if (!storageReady || !active.current || busy.current || savingKeys.has(draftKey)) return;
            busy.current = true;
            savingKeys.add(draftKey);
            setDraft(value => ({ ...value, saving: true }));
            try {
              let receipt;
              if (meta) receipt = await controller.save(meta);
              else if (saveState.pending) receipt = await controller.retry();
              else {
                controller.editTitle(draft.title ?? ''); controller.edit(draft.body);
                controller.editTags(draft.tagIds ?? []);
                const latest = await read(signal => getManualApi().list({}, signal));
                if (!active.current) return;
                receipt = await controller.save({ epoch: latest.epoch, revision: latest.revision });
              }
              await saved(receipt);
            } catch (error) {
              if (active.current) setDiagnostic(safeDiagnostic(error));
            } finally {
              busy.current = false;
              savingKeys.delete(draftKey);
              const current = retainedDrafts.get(draftKey);
              if (current?.saving) {
                if (active.current) setDraft(value => ({ ...value, saving: false }));
                else retainedDrafts.set(draftKey, { ...current, saving: false });
              }
            }
          };
          const openDetail = async id => {
            try {
              const value = await read(signal => getManualApi().get(id, signal));
              if (active.current) { setDetail(value?.note ?? null); setDiagnostic(value ? null : 'READ_UNAVAILABLE'); }
            } catch (error) { if (active.current) setDiagnostic(safeDiagnostic(error)); }
          };
          const editDetail = () => {
            if (!detail || draft.title || draft.body || draft.tagIds?.length || saveState.pending) {
              setDiagnostic('PENDING_INTENT'); return;
            }
            try {
              controller.load(detail);
              setDraft(value => ({ ...value, open: true, title: detail.title ?? '', body: detail.bodyMarkdown,
                tagIds: [...(detail.tagIds ?? [])] }));
              setDiagnostic(null);
            } catch (error) { setDiagnostic(safeDiagnostic(error)); }
          };
          const inspect = async () => {
            try { await controller.inspectConflict(); setDiagnostic(null); }
            catch (error) { if (active.current) setDiagnostic(safeDiagnostic(error)); }
          };
          const confirmConflict = () => {
            try {
              const latest = controller.resolveConflictConfirmed(saveState.conflictPreview);
              void save(latest);
            } catch (error) { setDiagnostic(safeDiagnostic(error)); }
          };
          const exportBackup = async () => {
            if (!active.current || !storageReady || busy.current || backupBusy.current) return;
            backupBusy.current = true;
            setBackupStatus('backupWorking');
            try {
              const response = await read(signal => getManualApi().backup(signal));
              if (!active.current) return;
              const file = backupFile(response);
              downloadBackupFile(file, { document: window.document, URL: window.URL });
              if (active.current) { setBackupStatus('backupStarted'); setDiagnostic(null); }
            } catch (error) {
              if (active.current) { setBackupStatus(null); setDiagnostic(safeDiagnostic(error)); }
            } finally { backupBusy.current = false; }
          };
          const conflict = ['VERSION_CONFLICT', 'EPOCH_CONFLICT'].includes(saveState.diagnostic);
          return h('div', { 'data-notebook-manual-library': true, 'data-draft-open': !!draft.open },
            h('button', { type: 'button', style: controlStyle, 'data-notebook-save': true,
              disabled: busy.current || draft.saving || saveState.status === 'saving'
                || (saveState.pending && (conflict || saveState.diagnostic === 'COMMIT_UNKNOWN'))
                || (!saveState.pending && !draft.body?.trim()),
              onClick: () => { void save(); } },
            text(saveState.status === 'saving' ? 'savingDraft' : saveState.pending ? 'retrySave' : 'saveDraft')),
            !editorOnly ? h('button', { type: 'button', style: controlStyle,
              onClick: () => { void reload().catch(() => {}); } }, text('loadNotes')) : null,
            !editorOnly ? h('form', { onSubmit: event => {
              event.preventDefault();
              if ([...searchDraft].length > 1000) { setDiagnostic('SEARCH_LIMIT'); return; }
              setActiveSearch(searchDraft);
              void reload(searchDraft).catch(() => {});
            } },
            h('label', null, text('searchNotes'),
              h('input', { type: 'search', value: searchDraft,
                onChange: event => setSearchDraft(event.target.value) })),
            h('button', { type: 'submit', style: controlStyle }, text('runSearch')),
            activeSearch ? h('button', { type: 'button', style: controlStyle,
              onClick: () => { setSearchDraft(''); setActiveSearch(''); void reload('').catch(() => {}); } },
            text('clearSearch')) : null) : null,
            !editorOnly ? h('button', { type: 'button', style: controlStyle,
              disabled: busy.current || backupBusy.current || draft.saving || saveState.status === 'saving',
              onClick: () => { void exportBackup(); } }, text('backupSavedNotes')) : null,
            backupStatus ? h('span', { role: 'status' }, text(backupStatus)) : null,
            saveState.status === 'saved' ? h('span', { role: 'status' }, text('savedDraft')) : null,
            diagnostic ? h('code', { role: 'status' }, diagnostic,
              ...(diagnostic === 'TITLE_LIMIT' ? [' — ', text('titleLimit')]
                : diagnostic === 'BODY_LIMIT' ? [' — ', text('bodyLimit')]
                  : diagnostic === 'REQUEST_LIMIT' ? [' — ', text('requestLimit')]
                    : diagnostic === 'SEARCH_LIMIT' ? [' — ', text('searchLimit')] : [])) : null,
            conflict ? h('button', { type: 'button', style: controlStyle, onClick: () => { void inspect(); } },
              text('inspectConflict')) : null,
            saveState.conflictPreview ? h('section', null,
              h('p', null, text('serverVersion')),
              h('pre', null, saveState.conflictPreview.note?.bodyMarkdown ?? ''),
              h('p', null, text('localDraft')), h('pre', null, draft.body),
              h('button', { type: 'button', style: controlStyle, onClick: confirmConflict }, text('confirmConflict'))) : null,
            !editorOnly && library ? library.items.length ? h('ul', null, ...library.items.map(item => h('li', { key: item.id },
              h('button', { type: 'button', onClick: () => { void openDetail(item.id); } }, item.title || item.excerpt))))
              : h('p', null, text('noNotes')) : null,
            !editorOnly && detail ? h('section', null, h('h3', null, detail.title || '手工笔记'),
              h('small', null, `${text('noteVersion')}: ${detail.version}`),
              h(SafePreview, { body: detail.bodyMarkdown }),
              h('button', { type: 'button', style: controlStyle, onClick: () => setDetail(null) }, text('backToList')),
              h('button', { type: 'button', style: controlStyle, onClick: editDetail }, text('editNote'))) : null);
        }
        function LibraryLauncher({ sessionId, useWorkspaces }) {
          const text = useText();
          const [open, setOpen] = React.useState(false);
          return h('section', { 'data-notebook-library-launcher': true, style: { marginTop: 12 } },
            h('button', { type: 'button', style: controlStyle, onClick: () => setOpen(value => !value) },
              text(open ? 'libraryClose' : 'libraryOpen')),
            open ? sessionId && useWorkspaces
              ? h(SessionLibrary, { sessionId, useWorkspaces }) : h(LibraryContent, {}) : null);
        }
        function SessionLibrary({ sessionId, useWorkspaces, trashMode = false, unified = false }) {
          const workspacePath = useWorkspaces(snapshot => {
            if (snapshot.phase !== 'ready') return null;
            const matches = snapshot.items.filter(item => item.sessionIds.includes(sessionId));
            return matches.length === 1 ? matches[0].path : null;
          });
          return h(LibraryContent, { sessionId, workspacePath, trashMode, unified });
        }
        function LibraryContent({ sessionId, workspacePath, trashMode = false, unified = false }) {
          const text = useText();
          const defaults = { scope: 'all', search: '', kind: '', tagIds: [], tagMode: 'any',
            untagged: false, trashOnly: trashMode, timeField: 'updated', from: '', to: '',
            sort: 'updated', offset: 0 };
          const [draft, setDraft] = React.useState(defaults);
          const [applied, setApplied] = React.useState(defaults);
          const appliedRef = React.useRef(defaults);
          const [selected, setSelected] = React.useState([]);
          const [result, setResult] = React.useState(null);
          const [tagCatalog, setTagCatalog] = React.useState([]);
          const [detail, setDetail] = React.useState(null);
          const [detailLoading, setDetailLoading] = React.useState(false);
          const [detailDiagnostic, setDetailDiagnostic] = React.useState(null);
          const [diagnostic, setDiagnostic] = React.useState(null);
          const [loading, setLoading] = React.useState(false);
          const [notePreview, setNotePreview] = React.useState(null);
          const [noteDiagnostic, setNoteDiagnostic] = React.useState(null);
          const [noteStatus, setNoteStatus] = React.useState(null);
          const [editId, setEditId] = React.useState(null);
          const [sourceConfirm, setSourceConfirm] = React.useState(null);
          const [sourceStatus, setSourceStatus] = React.useState(null);
          const [sourceBusy, setSourceBusy] = React.useState(false);
          const [copyStatus, setCopyStatus] = React.useState(null);
          const [feedback, setFeedback] = React.useState(null);
          const [copyBusy, setCopyBusy] = React.useState(false);
          const [exportOptions, setExportOptions] = React.useState({ includeTags: true,
            includeSource: true, includeSourceIds: true, includeTimes: true, includeQuote: true });
          const [exportStatus, setExportStatus] = React.useState(null);
          const [exportBusy, setExportBusy] = React.useState(false);
          const [exportTarget, setExportTarget] = React.useState(null);
          const [inputCandidate, setInputCandidate] = React.useState(null);
          const [inputStatus, setInputStatus] = React.useState(null);
          const [inputBusy, setInputBusy] = React.useState(false);
          React.useEffect(() => {
            if (!['copyMarkdownDone', 'exportStarted', 'inputApplied', 'noteChanged'].includes(feedback)) return;
            const timer = setTimeout(() => setFeedback(null), 4500);
            return () => clearTimeout(timer);
          }, [feedback]);
          const reportSource = value => { setSourceStatus(value); setFeedback(value); };
          const reportCopy = value => { setCopyStatus(value); setFeedback(value); };
          const reportInput = value => { setInputStatus(value); setFeedback(value); };
          const reportExport = value => { setExportStatus(value); setFeedback(value); };
          const bindingSource = ctx.uiSession?.adapter?.current;
          const inputBinding = React.useSyncExternalStore(bindingSource?.subscribe ?? (() => () => {}),
            bindingSource?.getSnapshot ?? (() => null));
          const inputSource = inputBinding?.key === sessionId ? inputBinding.hooks?.input : null;
          const inputSnapshot = React.useSyncExternalStore(inputSource?.subscribe ?? (() => () => {}),
            inputSource?.getSnapshot ?? (() => null));
          const inputAvailable = !!sessionId && inputBinding?.key === sessionId
            && ['plain', 'claimed'].includes(inputSnapshot?.phase)
            && typeof inputBinding.props?.inputActions?.insertText === 'function';
          const noteState = useNoteOperation();
          const active = React.useRef(false);
          const sequence = React.useRef(0);
          const reads = React.useRef(new Set());
          const noteReads = React.useRef(new Set());
          const noteMutation = React.useRef(null);
          const noteSequence = React.useRef(0);
          const sourceSequence = React.useRef(0);
          const copyRequest = React.useRef(null);
          const exportRequest = React.useRef(null);
          const inputRequest = React.useRef(null);
          const detailRequest = React.useRef(null);
          const detailSequence = React.useRef(0);
          const closeDetail = () => {
            detailSequence.current++;
            detailRequest.current?.abort(); detailRequest.current = null;
            setDetail(null); setDetailLoading(false); setDetailDiagnostic(null);
          };
          const openDetail = async item => {
            closeDetail();
            const generation = detailSequence.current;
            const pending = new AbortController(); detailRequest.current = pending;
            setDetailLoading(true);
            try {
              const value = await getManualApi().notesGet(item.id, pending.signal);
              if (!active.current || generation !== detailSequence.current || pending.signal.aborted) return;
              if (!value || value.note.id !== item.id) { setDetailDiagnostic('READ_UNAVAILABLE'); return; }
              setDetail(value.note);
            } catch (error) {
              if (active.current && generation === detailSequence.current && !pending.signal.aborted)
                setDetailDiagnostic(safeDiagnostic(error));
            } finally {
              if (detailRequest.current === pending) detailRequest.current = null;
              if (active.current && generation === detailSequence.current) setDetailLoading(false);
            }
          };
          const clearNotePreview = () => { noteSequence.current++; setNotePreview(null); };
          const payloadFor = filter => {
            const payload = { scope: filter.scope, sort: filter.sort, offset: filter.offset, limit: 50,
              tagMode: filter.tagMode, trashOnly: filter.trashOnly, timeField: filter.timeField };
            if (filter.sort === 'session') payload.sessionActivity = sessionActivityCatalog(
              ctx.sessions?.list?.getSnapshot?.());
            if (filter.scope === 'session') payload.sessionId = sessionId;
            if (filter.scope === 'workspace') payload.workspacePath = workspacePath;
            if (filter.search) payload.search = filter.search;
            if (filter.kind) payload.kind = filter.kind;
            if (filter.tagIds.length) payload.tagIds = filter.tagIds;
            if (filter.untagged) payload.untagged = true;
            if (filter.from) payload.from = new Date(filter.from).toISOString();
            if (filter.to) payload.to = new Date(filter.to).toISOString();
            return payload;
          };
          const run = async filter => {
            closeDetail();
            clearNotePreview();
            const current = ++sequence.current;
            for (const pending of reads.current) pending.abort();
            reads.current.clear();
            const pending = new AbortController(); reads.current.add(pending);
            setResult(null); setLoading(true); setDiagnostic(null);
            try {
              const value = await getManualApi().library(payloadFor(filter), pending.signal);
              if (active.current && current === sequence.current) {
                setResult(value); setTagCatalog(value.tags);
              }
            } catch (error) {
              if (active.current && current === sequence.current) setDiagnostic(safeDiagnostic(error));
            } finally {
              reads.current.delete(pending);
              if (active.current && current === sequence.current) setLoading(false);
            }
          };
          React.useEffect(() => {
            active.current = true;
            appliedRef.current = defaults;
            const refresh = () => { void run(appliedRef.current); };
            libraryRefreshListeners.add(refresh);
            setSourceConfirm(null); reportSource(null); setSourceBusy(false);
            reportCopy(null); setCopyBusy(false);
            reportExport(null); setExportBusy(false);
            setInputCandidate(null); reportInput(null); setInputBusy(false);
            setDraft(defaults); setApplied(defaults); setSelected([]);
            void run(defaults);
            return () => {
              active.current = false; sequence.current++;
              libraryRefreshListeners.delete(refresh);
              sourceSequence.current++;
              copyRequest.current?.abort(); copyRequest.current = null;
              exportRequest.current?.abort(); exportRequest.current = null;
              inputRequest.current?.abort(); inputRequest.current = null;
              detailSequence.current++;
              detailRequest.current?.abort(); detailRequest.current = null;
              for (const pending of reads.current) pending.abort();
              reads.current.clear();
              noteSequence.current++;
              for (const pending of noteReads.current) pending.abort();
              noteReads.current.clear(); noteMutation.current?.abort();
            };
          }, [sessionId, workspacePath, trashMode]);
          const edit = change => setDraft(value => ({ ...value, ...change }));
          const apply = event => {
            event.preventDefault();
            if ([...draft.search].length > 1000) { setDiagnostic('SEARCH_LIMIT'); return; }
            if ([draft.from, draft.to].some(value => value && !Number.isFinite(new Date(value).getTime())) || (draft.from && draft.to && new Date(draft.from) > new Date(draft.to))) { setDiagnostic('VALIDATION_FAILED'); return; }
            clearNotePreview();
            const next = { ...draft, offset: 0 };
            appliedRef.current = next; setApplied(next); void run(next);
          };
          const filterNow = change => {
            const next = { ...appliedRef.current, ...change, offset: 0 };
            if ([...next.search].length > 1000) { setDiagnostic('SEARCH_LIMIT'); return; }
            setDraft(value => ({ ...value, ...change, offset: 0 })); appliedRef.current = next; setApplied(next); void run(next);
          };
          const page = offset => {
            clearNotePreview();
            const next = { ...applied, offset };
            appliedRef.current = next; setApplied(next); void run(next);
          };
          const visible = new Set(result?.ids ?? []);
          const hiddenSelected = selected.filter(id => !visible.has(id)).length;
          const toggle = id => { clearNotePreview(); setSelected(ids => ids.includes(id)
            ? ids.filter(value => value !== id) : [...ids, id]); };
          const sourceState = sessionId => {
            try {
              const sessions = ctx.sessions?.list?.getSnapshot?.();
              const workspaces = ctx.workspaces?.list?.getSnapshot?.();
              if (!sessionId || !sessions || workspaces?.phase !== 'ready' || !ctx.uiWorkspace?.openSession)
                return 'unavailable';
              if (workspaces.archivedSessionIds?.includes(sessionId)) return 'archived';
              // byId can include retained subagent fallbacks outside the Host list.
              return sessions.phase === 'ready' && Array.isArray(sessions.ids)
                && sessions.ids.includes(sessionId) ? 'ready' : 'unavailable';
            } catch { return 'unavailable'; }
          };
          const openSource = item => {
            const id = item.source?.sessionId;
            setSourceConfirm(null); reportSource(null);
            const state = sourceState(id);
            if (state === 'archived') {
              setSourceConfirm({ id, title: item.source.sessionTitle ?? id }); return;
            }
            if (state !== 'ready') { reportSource('sourceUnavailable'); return; }
            try { ctx.uiWorkspace.openSession(id); }
            catch { reportSource('sourceOpenFailed'); }
          };
          const restoreSource = async () => {
            const target = sourceConfirm;
            if (!target || sourceBusy) return;
            const generation = sourceSequence.current;
            setSourceBusy(true); reportSource(null);
            try {
              await ctx.uiWorkspace.unarchiveSession(target.id);
            } catch {
              if (active.current && generation === sourceSequence.current) {
                reportSource('sourceRestoreFailed'); setSourceBusy(false);
              }
              return;
            }
            if (active.current && generation === sourceSequence.current) {
              setSourceConfirm(null);
              try { ctx.uiWorkspace.openSession(target.id); }
              catch { reportSource('sourceOpenFailed'); }
              setSourceBusy(false);
            }
          };
          const copyMarkdown = async item => {
            if (!active.current || !result || copyRequest.current || item.deletedAt) return;
            if (typeof navigator === 'undefined' || typeof navigator.clipboard?.writeText !== 'function') {
              reportCopy('copyMarkdownFailed'); return;
            }
            const pending = new AbortController(); copyRequest.current = pending;
            setCopyBusy(true); reportCopy('copyMarkdownWorking');
            try {
              const latest = await getManualApi().library({ scope: 'all', offset: 0, limit: 1 }, pending.signal);
              const value = await getManualApi().markdown({ epoch: latest.epoch,
                expectedRevision: latest.revision, ids: [item.id] }, pending.signal);
              if (!active.current || pending.signal.aborted) return;
              await navigator.clipboard.writeText(value.content);
              if (active.current && !pending.signal.aborted) reportCopy('copyMarkdownDone');
            } catch {
              if (active.current && !pending.signal.aborted) reportCopy('copyMarkdownFailed');
            } finally {
              if (copyRequest.current === pending) copyRequest.current = null;
              if (active.current && !pending.signal.aborted) setCopyBusy(false);
            }
          };
          const exportMarkdownFile = async ids => {
            if (!active.current || !ids.length || exportRequest.current) return;
            const pending = new AbortController(); exportRequest.current = pending;
            setExportBusy(true); reportExport('exportWorking');
            try {
              const api = getManualApi();
              const query = { scope: 'all', sort: applied.sort, offset: 0, limit: 50 };
              if (applied.sort === 'session') query.sessionActivity = sessionActivityCatalog(
                ctx.sessions?.list?.getSnapshot?.());
              const all = await api.library(query, pending.signal);
              if (!active.current || pending.signal.aborted) return;
              const selectedIds = new Set(ids);
              const ordered = all.ids.filter(id => selectedIds.has(id));
              if (ordered.length !== selectedIds.size) {
                reportExport('exportSelectionUnavailable'); return;
              }
              const response = await api.markdown({ epoch: all.epoch,
                expectedRevision: all.revision, ids: ordered, options: exportOptions }, pending.signal);
              if (!active.current || pending.signal.aborted) return;
              const file = markdownFile(response);
              downloadMarkdownFile(file, { document: window.document, URL: window.URL });
              setExportTarget(null);
              reportExport('exportStarted');
            } catch (error) {
              if (active.current && !pending.signal.aborted) reportExport(
                ['VERSION_CONFLICT', 'EPOCH_CONFLICT'].includes(error?.code) ? 'exportChanged' : 'exportFailed');
            } finally {
              if (exportRequest.current === pending) exportRequest.current = null;
              if (active.current && !pending.signal.aborted) setExportBusy(false);
            }
          };
          const prepareInput = async item => {
            if (!active.current || !result || inputRequest.current || item.deletedAt) return;
            const input = currentInput(ctx.uiSession, sessionId);
            if (!input || !['plain', 'claimed'].includes(input.state.phase)) {
              reportInput('inputUnavailable'); return;
            }
            const pending = new AbortController(); inputRequest.current = pending;
            setInputCandidate(null); setInputBusy(true); reportInput('inputWorking');
            try {
              const value = await getManualApi().notesGet(item.id, pending.signal);
              if (!active.current || pending.signal.aborted) return;
              if (!value?.note || value.note.deletedAt) { reportInput('inputFailed'); return; }
              const { note } = value;
              const content = [note.quote?.content, note.kind === 'highlight' ? '' : note.bodyMarkdown]
                .filter(part => typeof part === 'string' && part.trim()).join('\n\n');
              if (!content) { reportInput('inputFailed'); return; }
              const latest = currentInput(ctx.uiSession, sessionId);
              if (!latest || !['plain', 'claimed'].includes(latest.state.phase)) {
                reportInput('inputUnavailable'); return;
              }
              setInputCandidate({ id: item.id, title: item.title || item.id, content,
                draft: latest.state.draft, draftRev: latest.state.draftRev });
              reportInput('inputReady');
            } catch {
              if (active.current && !pending.signal.aborted) reportInput('inputFailed');
            } finally {
              if (inputRequest.current === pending) inputRequest.current = null;
              if (active.current && !pending.signal.aborted) setInputBusy(false);
            }
          };
          const confirmInput = mode => {
            if (!inputCandidate || !active.current) return;
            const outcome = writeInput(ctx.uiSession, sessionId, inputCandidate.content,
              mode, inputCandidate);
            if (outcome.ok) { setInputCandidate(null); reportInput('inputApplied'); return; }
            if (outcome.code === 'INPUT_CHANGED') {
              const latest = currentInput(ctx.uiSession, sessionId);
              if (latest) setInputCandidate(value => ({ ...value,
                draft: latest.state.draft, draftRev: latest.state.draftRev }));
              reportInput('inputChanged');
            } else reportInput(outcome.code === 'INPUT_INVALID' ? 'inputFailed' : 'inputUnavailable');
          };
          const prepareNotes = async (action, ids = selected) => {
            if (noteOperation.pending || !ids.length) {
              setNoteDiagnostic(selected.length ? 'PENDING_INTENT' : 'VALIDATION_FAILED'); return;
            }
            const current = ++noteSequence.current;
            const controller = new AbortController(); noteReads.current.add(controller);
            setNotePreview(null); setNoteDiagnostic(null); setNoteStatus(null);
            try {
              const value = await getManualApi().notesPreview({ action, ids }, controller.signal);
              if (active.current && current === noteSequence.current) setNotePreview(value);
            } catch (error) {
              if (active.current && current === noteSequence.current)
                setNoteDiagnostic(safeDiagnostic(error));
            } finally { noteReads.current.delete(controller); }
          };
          const sendNotes = async pending => {
            if (noteOperation.busy || noteOperation.pending !== pending) return;
            updateNoteOperation({ busy: true, diagnostic: null });
            const controller = new AbortController(); noteMutation.current = controller;
            try {
              await getManualApi().notesApply(pending, controller.signal);
              updateNoteOperation({ pending: null, diagnostic: null });
              if (active.current) {
                clearNotePreview(); setSelected([]); setNoteStatus('noteChanged'); setFeedback('noteChanged');
                void run(applied);
              }
            } catch (error) {
              const code = safeDiagnostic(error);
              const uncertain = ['TIMEOUT', 'TRANSPORT_FAILED', 'CANCELLED', 'COMMIT_UNKNOWN',
                'INVALID_RESPONSE'].includes(code);
              updateNoteOperation({ pending: uncertain ? pending : null, diagnostic: code });
              if (active.current && !uncertain) { clearNotePreview(); void run(applied); }
            } finally {
              noteMutation.current = null;
              updateNoteOperation({ busy: false });
            }
          };
          const confirmNotes = () => {
            if (!notePreview || noteOperation.pending || noteOperation.busy) return;
            const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
            const requestId = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
            const pending = { requestId, epoch: notePreview.epoch,
              expectedRevision: notePreview.revision, action: notePreview.action,
              preview: notePreview, confirmed: true };
            updateNoteOperation({ pending, diagnostic: null });
            void sendNotes(pending);
          };
          const selectOptions = (value, choices, update, label) => h('select', {
            value, 'aria-label': text(label), onChange: event => update(event.target.value) },
            ...choices.map(([key, label]) => h('option', { key, value: key }, text(label))));
          const sessionLabel = source => {
            const savedTitle = source?.sessionTitle?.trim();
            const row = ctx.sessions?.list?.getSnapshot?.()?.byId?.[source?.sessionId];
            const liveTitle = typeof row?.title === 'string' ? row.title.trim() : '';
            return savedTitle || liveTitle || source?.sessionId || '未知会话';
          };
          return h('section', { 'data-notebook-library': true,
            'data-empty-trash': trashMode && result?.total === 0 && applied.scope === 'all' && !applied.search && !applied.tagIds.length && !applied.untagged && !applied.kind && !applied.from && !applied.to ? 'true' : 'false' },
            !unified ? h('h3', null, trashMode ? '回收站' : text('libraryTitle')) : null,
            h('form', { onSubmit: apply, 'data-notebook-search-form': true,
              'data-tag-filter-active': applied.tagIds.length > 0 || applied.untagged || draft.tagIds.length > 0 || draft.untagged },
              h('div', { className: 'notebook-basic-filters' },
              selectOptions(draft.scope, [['all', 'libraryAll'],
                ...(workspacePath ? [['workspace', 'libraryWorkspace']] : []),
                ...(sessionId ? [['session', 'librarySession']] : [])],
              value => edit({ scope: value }), 'libraryScope'),
              selectOptions(draft.kind, [['', 'libraryKindAll'], ['highlight', 'libraryHighlight'],
                ['note', 'libraryNote'], ['manual', 'libraryManual']], value => edit({ kind: value }),
              'libraryKindLabel'),
              h('div', { 'data-notebook-tag-filter': true, 'aria-label': text('libraryTags') },
                h('span', { className: 'notebook-filter-caption' }, '按标签筛选（立即生效）'),
                h('button', { type: 'button', 'aria-pressed': !applied.tagIds.length && !applied.untagged,
                  onClick: () => filterNow({ tagIds: [], untagged: false }) }, '全部'),
                ...tagCatalog.map(tag => h('button', { key: tag.id, type: 'button', 'data-tag-id': tag.id,
                  'aria-pressed': applied.tagIds.includes(tag.id),
                  onClick: () => filterNow({ tagIds: appliedRef.current.tagIds.includes(tag.id)
                    ? appliedRef.current.tagIds.filter(id => id !== tag.id)
                    : [...appliedRef.current.tagIds, tag.id], untagged: false }) },
                h('span', { className: 'notebook-tag-color', 'aria-hidden': true,
                  style: { '--tag-color': resolvedTagColor(tag.color, tag.id) } }),
                `${tag.name} · ${trashMode ? tag.trashed ?? 0 : tag.active ?? 0}`)),
                h('button', { type: 'button', 'aria-pressed': applied.untagged,
                  onClick: () => filterNow({ tagIds: [], untagged: true }) }, text('libraryUntagged')))),
              h('details', { 'data-notebook-filters': true }, h('summary', null,
               applied.search || applied.from || applied.to ? '更多筛选 · 已启用' : '更多筛选'),
              h('div', { className: 'notebook-filter-grid' },
              h('label', { className: 'notebook-advanced-keyword' },
                h('input', { type: 'search', 'aria-label': text('librarySearch'), value: draft.search,
                  placeholder: '搜索笔记内容…', onChange: event => edit({ search: event.target.value }) })),
              h('label', null, text('libraryTimeField'),
                selectOptions(draft.timeField, [['updated', 'libraryUpdated'], ['created', 'libraryCreated']],
                  value => edit({ timeField: value }), 'libraryTimeField')),
              h('label', null, text('libraryFrom'), h('input', { type: 'datetime-local', step: 1, value: draft.from,
                onChange: event => edit({ from: event.target.value }) })),
              h('label', null, text('libraryTo'), h('input', { type: 'datetime-local', step: 1, value: draft.to,
                onChange: event => edit({ to: event.target.value }) })))),
              h('div', { className: 'notebook-filter-actions' },
              h('button', { type: 'submit', 'data-notebook-primary': true, style: controlStyle }, '搜索'),
              h('button', { type: 'button', style: controlStyle, onClick: () => { setDraft(defaults); appliedRef.current = defaults; setApplied(defaults); setSelected([]); void run(defaults); } }, '重置')),
              ),
            loading ? h('p', { role: 'status' }, text('libraryLoading')) : null,
            diagnostic ? h('code', { role: 'status' }, diagnostic,
              ...(diagnostic === 'SEARCH_LIMIT' ? [' — ', text('searchLimit')]
                : diagnostic === 'SESSION_ACTIVITY_UNAVAILABLE'
                  ? [' — ', text('librarySessionActivityUnavailable')] : [])) : null,
            result ? h('div', null,
              h('p', null, unified ? `${result.total} 条${trashMode ? '已删除笔记' : '笔记'}` : `${result.total} · ${text('librarySelected')}: ${selected.length} · ${text('libraryHiddenSelected')}: ${hiddenSelected}`),
              h('button', { type: 'button', style: controlStyle,
                onClick: () => { clearNotePreview(); setSelected(ids => [...new Set([...ids, ...result.ids])]); } }, text('librarySelectAll')),
              h('button', { type: 'button', style: controlStyle,
                hidden: unified && !selected.length, onClick: () => { clearNotePreview(); setSelected([]); } }, text('libraryClearSelection')),
              ...(unified && selected.length ? [h('div', { 'data-notebook-bulk': true },
                h('span', null, `已选 ${selected.length} 条${hiddenSelected ? '（含筛选外 ' + hiddenSelected + ' 条）' : ''}`),
                h('button', { type: 'button', disabled: !!noteState.pending, onClick: () => void prepareNotes(applied.trashOnly ? 'restore' : 'trash') }, applied.trashOnly ? '恢复已选' : '移入回收站'),
                applied.trashOnly ? h('button', { type: 'button', disabled: !!noteState.pending, onClick: () => void prepareNotes('purge') }, '永久删除') : h('button', { type: 'button', disabled: exportBusy, onClick: () => setExportTarget([...selected]) }, '导出 Markdown'))] : []),
              result.items.length ? h('ul', null, ...result.items.map(item => h('li', { key: item.id, 'data-note-kind': item.kind },
                h('label', { className: 'notebook-card-title' }, h('input', { type: 'checkbox', checked: selected.includes(item.id),
                  onChange: () => toggle(item.id) }), item.title?.trim() && !(item.kind === 'highlight' && item.excerpt?.trim().startsWith(item.title.trim()))
                   ? item.title.trim() : text(`library${item.kind[0].toUpperCase()}${item.kind.slice(1)}`)),
                item.excerpt ? h('p', null, item.excerpt) : null,
                item.quoteFormat && item.quoteExcerpt !== item.excerpt ? h('p', { className: 'notebook-quote' }, item.quoteExcerpt) : null,
                h('div', { className: 'notebook-card-footer' },
                item.tagIds.length ? h('div', { className: 'notebook-card-tags' }, ...item.tagIds.map(id => {
                  const tag = tagCatalog.find(entry => entry.id === id);
                  return h('span', { key: id, style: { '--tag-color': resolvedTagColor(tag?.color, id) } }, tag?.name ?? id);
                })) : null,
                h('small', { title: item.updatedAt }, notebookDate(item.updatedAt)),
                item.source ? h('small', { className: 'notebook-card-source', title: `${sessionLabel(item.source)} · ${item.source.sessionId ?? ''}` },
                  `会话 · ${sessionLabel(item.source)}`) : null,
                h('div', { className: 'notebook-card-actions' },
                h('button', { type: 'button', style: controlStyle,
                  disabled: detailLoading || inputBusy,
                  onClick: () => { void openDetail(item); } }, text('libraryDetail')),
                item.source?.sessionId ? h('button', { type: 'button', style: controlStyle,
                  disabled: sourceBusy || detailLoading || inputBusy, onClick: () => openSource(item) }, text('sourceOpen')) : null,
                h('details', { 'data-note-more': item.id, onToggle: event => {
                  const details = event.currentTarget;
                  const menu = details.querySelector('.notebook-card-menu');
                  if (!menu) return;
                  if (!details.open) { menu.removeAttribute('style'); return; }
                  const view = details.ownerDocument.defaultView;
                  const anchor = details.querySelector('summary').getBoundingClientRect();
                  const width = menu.getBoundingClientRect().width;
                  const height = menu.getBoundingClientRect().height;
                  const left = Math.max(8, Math.min(anchor.right - width, view.innerWidth - width - 8));
                  const above = anchor.bottom + height + 8 > view.innerHeight && anchor.top > height + 8;
                  menu.style.position = 'fixed';
                  menu.style.left = `${left}px`;
                  menu.style.right = 'auto';
                  menu.style.top = `${Math.max(8, above ? anchor.top - height - 4 : Math.min(anchor.bottom + 4, view.innerHeight - height - 8))}px`;
                  menu.style.maxHeight = `${Math.max(100, view.innerHeight - 16)}px`;
                  menu.style.overflowY = 'auto';
                }, onClick: event => {
                  if (event.target.closest?.('.notebook-card-menu button')) event.currentTarget.open = false;
                } }, h('summary', null, '更多'),
                h('div', { className: 'notebook-card-menu' },
                !item.deletedAt ? h('button', { type: 'button', style: controlStyle,
                  disabled: copyBusy, onClick: () => { void copyMarkdown(item); } }, text('copyMarkdown')) : null,
                !item.deletedAt ? h('button', { type: 'button', style: controlStyle,
                  disabled: exportBusy, onClick: () => setExportTarget([item.id]) },
                text('exportOneMarkdown')) : null,
                !item.deletedAt ? h('button', { type: 'button', style: controlStyle,
                  disabled: !inputAvailable || inputBusy || detailLoading,
                  title: !inputAvailable ? text('inputUnavailable') : text('inputInsert'),
                  onClick: () => { void prepareInput(item); } }, text('inputInsert')) : null,

                !item.deletedAt ? h('button', { type: 'button', style: controlStyle,
                  disabled: detailLoading || inputBusy,
                  onClick: () => setEditId(item.id) }, item.kind === 'highlight' ? '补充笔记 / 标签' : text('editOpen')) : null,
                h('button', { type: 'button', disabled: !!noteState.pending, onClick: () => void prepareNotes(item.deletedAt ? 'restore' : 'trash', [item.id]) }, item.deletedAt ? '恢复' : '移入回收站'),
                item.deletedAt ? h('button', { type: 'button', disabled: !!noteState.pending, onClick: () => void prepareNotes('purge', [item.id]) }, '永久删除') : null)))))))
                : h('p', { 'data-notebook-empty': true }, trashMode && applied.scope === 'all' && !applied.search && !applied.tagIds.length && !applied.untagged && !applied.kind && !applied.from && !applied.to
                  ? '回收站暂无笔记。移入回收站的笔记会显示在这里。' : text('libraryEmpty')),
              h('button', { type: 'button', style: controlStyle, disabled: applied.offset === 0,
                onClick: () => page(Math.max(0, applied.offset - 50)) }, text('libraryPrev')),
              h('button', { type: 'button', style: controlStyle,
                disabled: applied.offset + result.pageIds.length >= result.total,
                onClick: () => page(applied.offset + 50) }, text('libraryNext')),
              h('button', { type: 'button', style: controlStyle,
                hidden: unified || !selected.length, disabled: !selected.length || !!noteState.pending,
                onClick: () => { void prepareNotes(applied.trashOnly ? 'restore' : 'trash'); } },
              text(applied.trashOnly ? 'noteRestore' : 'noteTrash')),
              !unified && applied.trashOnly && selected.length ? h('button', { type: 'button', style: controlStyle,
                disabled: !selected.length || !!noteState.pending,
                onClick: () => { void prepareNotes('purge'); } }, text('notePurge')) : null,
              !unified && selected.length && !applied.trashOnly ? h('button', { type: 'button', style: controlStyle,
                disabled: exportBusy, onClick: () => setExportTarget([...selected]) }, '导出 Markdown') : null) : null,
            exportTarget?.length ? h('section', { 'data-markdown-export': true, role: 'dialog', 'aria-modal': true,
               onKeyDown: dialogKeys, tabIndex: -1, ref: element => { if (element && !element.contains(document.activeElement)) element.focus(); } },
               h('h4', null, `导出 Markdown · ${exportTarget.length} 条`),
              ...[['includeTags', 'exportTags'], ['includeSource', 'exportSource'],
                ['includeSourceIds', 'exportSourceIds'], ['includeTimes', 'exportTimes'],
                ['includeQuote', 'exportQuote']].map(([key, label]) => h('label', { key },
                h('input', { type: 'checkbox', checked: exportOptions[key],
                  onChange: event => setExportOptions(value => ({ ...value,
                    [key]: event.target.checked })) }), text(label))),
              h('button', { type: 'button', style: controlStyle,
                disabled: exportBusy,
                onClick: () => { void exportMarkdownFile(exportTarget); } }, '确认下载 Markdown'),
              h('button', { type: 'button', style: controlStyle, 'data-dialog-cancel': true,
                disabled: exportBusy, onClick: () => setExportTarget(null) }, '取消')) : null,
            null,
            inputCandidate ? h('section', { 'data-input-confirm': true, role: 'dialog', 'aria-modal': true, onKeyDown: dialogKeys, tabIndex: -1, ref: element => { if (element && !element.contains(document.activeElement)) element.focus(); } },
              h('h4', null, inputCandidate.title),
              h('p', null, text('inputCurrent')), h('pre', null, inputCandidate.draft),
              h('pre', null, inputCandidate.content),
              h('button', { type: 'button', style: controlStyle,
                onClick: () => confirmInput('append') }, text('inputAppend')),
              h('button', { type: 'button', style: controlStyle,
                disabled: !!inputSnapshot?.occurrences?.length || !!inputSnapshot?.attachmentIds?.length,
                onClick: () => confirmInput('replace') }, text('inputReplace')),
              inputSnapshot?.occurrences?.length || inputSnapshot?.attachmentIds?.length
                ? h('p', null, text('inputComplex')) : null,
              h('button', { type: 'button', style: controlStyle,
                'data-dialog-cancel': true, onClick: () => { setInputCandidate(null); reportInput(null); } }, text('inputCancel'))) : null,
            inputCandidate && inputStatus ? h('p', { role: 'status' }, text(inputStatus)) : null,
            notePreview ? h('section', { 'data-note-impact': true, role: 'dialog', 'aria-modal': true, onKeyDown: dialogKeys, tabIndex: -1, ref: element => { if (element && !element.contains(document.activeElement)) element.focus(); } },
              h('h4', null, `${{ trash: '移入回收站', restore: '恢复笔记', purge: '永久删除' }[notePreview.action]} · ${notePreview.count} 条`),
              h('p', null, notePreview.action === 'purge' ? '永久删除后无法恢复。' : notePreview.action === 'trash' ? '可以在回收站恢复这些笔记。' : '恢复后会重新显示在笔记库。'),
              h('ul', { 'data-notebook-impact-list': true }, ...notePreview.entries.map(entry => h('li', { key: entry.id },
                entry.title || ({ highlight: '划线', note: '笔记', manual: '手工笔记' }[entry.kind]) || entry.id))),
              h('button', { type: 'button', style: controlStyle, 'data-notebook-confirm': true, disabled: !!noteState.pending,
                onClick: confirmNotes }, text('noteConfirm')),
              noteState.pending && !noteState.busy && noteState.diagnostic !== 'COMMIT_UNKNOWN' ? h('button', { type: 'button', onClick: () => void sendNotes(noteState.pending) }, text('noteRetry')) : null,
              noteState.diagnostic ? h('code', { role: 'status' }, noteState.diagnostic) : null,
              h('button', { type: 'button', style: controlStyle, disabled: noteState.busy,
                'data-dialog-cancel': true, onClick: clearNotePreview }, noteState.pending ? '关闭并保留待确认操作' : text('noteCancel'))) : null,
            !notePreview && noteState.pending && !noteState.busy && noteState.diagnostic !== 'COMMIT_UNKNOWN'
              ? h('button', { type: 'button', style: controlStyle,
                onClick: () => { void sendNotes(noteState.pending); } }, text('noteRetry')) : null,
            noteState.busy ? h('p', { role: 'status' }, text('noteBusy')) : null,
            !unified && noteStatus ? h('p', { role: 'status' }, text(noteStatus)) : null,
            noteDiagnostic || noteState.diagnostic ? h('code', { role: 'status' },
              noteDiagnostic ?? noteState.diagnostic) : null,
            detailLoading ? h('p', { role: 'status' }, text('libraryDetailLoading')) : null,
            detailDiagnostic ? h('code', { role: 'status' }, detailDiagnostic) : null,
            detail ? h('section', { 'data-note-detail': true, role: 'dialog', 'aria-modal': true, onKeyDown: dialogKeys, tabIndex: -1, ref: element => { if (element && !element.contains(document.activeElement)) element.focus(); } },
              h('h4', null, detail.title || text(`library${detail.kind[0].toUpperCase()}${detail.kind.slice(1)}`)),
              h('blockquote', { className: 'notebook-detail-meta' },
                h('small', null, `${text('libraryCreatedAt')}: ${notebookDate(detail.createdAt)}`),
                h('small', null, `${text('libraryUpdatedAt')}: ${notebookDate(detail.updatedAt)}`),
                detail.deletedAt ? h('small', null, `${text('libraryDeletedAt')}: ${notebookDate(detail.deletedAt)}`) : null),
              detail.tagIds?.length ? h('div', { className: 'notebook-detail-tags' }, ...detail.tagIds.map(id => {
                const tag = tagCatalog.find(entry => entry.id === id);
                return h('span', { key: id, style: { '--tag-color': resolvedTagColor(tag?.color, id) } }, tag?.name ?? id);
              })) : null,
              detail.quote ? h('div', { className: 'notebook-detail-quote' },
                h('p', null, `${text('libraryQuote')} (${detail.quote.format})`),
                h('pre', null, detail.quote.content)) : null,
              detail.bodyMarkdown ? h('div', { className: 'notebook-detail-body' }, h(SafePreview, { body: detail.bodyMarkdown })) : null,
              detail.source ? h('blockquote', { className: 'notebook-detail-meta' },
                h('small', null, `${text('librarySource')}: ${[sessionLabel(detail.source), detail.source.sessionId, detail.source.workspacePath, detail.source.messageId].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(' · ')}`)) : null,
              h('button', { type: 'button', style: controlStyle, 'data-dialog-cancel': true, onClick: closeDetail },
                text('libraryCloseDetail'))) : null,
            sourceConfirm ? h('section', { 'data-source-restore': true, role: 'dialog', 'aria-modal': true, onKeyDown: dialogKeys, tabIndex: -1, ref: element => { if (element && !element.contains(document.activeElement)) element.focus(); } },
              h('p', null, `${text('sourceArchived')} ${sourceConfirm.title}`),
              h('button', { type: 'button', style: controlStyle, disabled: sourceBusy,
                onClick: () => { void restoreSource(); } }, text('sourceRestore')),
              h('button', { type: 'button', style: controlStyle, disabled: sourceBusy,
                'data-dialog-cancel': true, onClick: () => setSourceConfirm(null) }, text('sourceCancel'))) : null,
            null, null,
            editId ? h(NoteEdit, { id: editId, tags: tagCatalog,
              onClose: () => setEditId(null), onChanged: () => { void run(applied); } }) : null,
            h('div', { 'data-library-feedback': true, style: { position: 'fixed', bottom: 16, right: 24, maxWidth: 'min(360px, calc(100vw - 48px))', zIndex: 1200, pointerEvents: 'none' } },
              feedback ? h('p', { role: 'status' }, text(feedback)) : null),
            (editId || detail || inputCandidate || sourceConfirm || notePreview || exportTarget) ? h('div', {
              'data-notebook-backdrop': true, 'aria-hidden': true,
              style: { position: 'fixed', inset: 0, zIndex: 1090, background: '#0005' },
              onMouseDown: event => event.preventDefault(),
            }) : null,

            !unified ? h(TagManager, { onChanged: () => { void run(applied); } }) : null);
        }
        function NoteEdit({ id, tags, onClose, onChanged }) {
          const text = useText();
          const [, refresh] = React.useState(0);
          const [confirmClose, setConfirmClose] = React.useState(false);
          const active = React.useRef(false);
          const reads = React.useRef(new Set());
          const mutation = React.useRef(null);
          const current = editDrafts.get(id) ?? { base: null, title: '', body: '', tagIds: [],
            dirty: false, pending: null, busy: false, diagnostic: null, latest: null };
          if (!editDrafts.has(id)) editDrafts.set(id, current);
          const update = change => {
            editDrafts.set(id, { ...editDrafts.get(id), ...change });
            if (active.current) refresh(value => value + 1);
          };
          const readLatest = async rebase => {
            const controller = new AbortController(); reads.current.add(controller);
            try {
              const value = await getManualApi().notesGet(id, controller.signal);
              if (!active.current || controller.signal.aborted) return;
              if (!value) { update({ diagnostic: 'READ_UNAVAILABLE' }); return; }
              if (rebase) { update({ latest: value, diagnostic: 'VERSION_CONFLICT' }); return; }
              if (!editDrafts.get(id)?.base) update({ base: value, title: value.note.title ?? '',
                body: value.note.bodyMarkdown ?? '', tagIds: [...value.note.tagIds], diagnostic: null });
            } catch (error) {
              if (active.current && !controller.signal.aborted) update({ diagnostic: safeDiagnostic(error) });
            } finally { reads.current.delete(controller); }
          };
          React.useEffect(() => {
            active.current = true; void readLatest(false);
            return () => {
              active.current = false;
              for (const controller of reads.current) controller.abort();
              reads.current.clear(); mutation.current?.abort();
            };
          }, [id]);
          const send = async pending => {
            const state = editDrafts.get(id);
            if (!state || state.busy || state.pending !== pending) return;
            update({ busy: true, diagnostic: null });
            const controller = new AbortController(); mutation.current = controller;
            try {
              await getManualApi().notesEdit(structuredClone(pending), controller.signal);
              editDrafts.delete(id);
              if (active.current) { onChanged(); onClose(); }
            } catch (error) {
              const code = safeDiagnostic(error);
              const uncertain = ['TIMEOUT', 'TRANSPORT_FAILED', 'CANCELLED', 'COMMIT_UNKNOWN',
                'INVALID_RESPONSE'].includes(code);
              if (editDrafts.has(id)) update({ pending: uncertain ? pending : null, diagnostic: code });
            } finally {
              mutation.current = null;
              if (editDrafts.has(id)) update({ busy: false });
            }
          };
          const save = () => {
            const state = editDrafts.get(id);
            if (!state?.base || state.pending || state.busy) return;
            if (state.base.note.kind !== 'highlight' && !state.body.trim()) {
              update({ diagnostic: 'VALIDATION_FAILED' }); return;
            }
            if (state.title.length > 1000 || [...state.title].length > 1000) {
              update({ diagnostic: 'TITLE_LIMIT' }); return;
            }
            if (state.body.length > 100000 || [...state.body].length > 100000) {
              update({ diagnostic: 'BODY_LIMIT' }); return;
            }
            if (state.tagIds.length > 10) { update({ diagnostic: 'VALIDATION_FAILED' }); return; }
            const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
            const requestId = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
            const pending = { requestId, epoch: state.base.epoch,
              expectedRevision: state.base.revision, id, expectedVersion: state.base.note.version,
              title: state.title, tagIds: [...state.tagIds],
              ...(state.base.note.kind === 'highlight' && !state.body.trim() ? {} : { bodyMarkdown: state.body }) };
            const envelope = { type: 'client-request', rpcId: 'x'.repeat(128),
              method: 'dsh-session-notebook/notes/edit', payload: pending };
            if (new TextEncoder().encode(JSON.stringify(envelope)).byteLength > 256 * 1024) {
              update({ diagnostic: 'REQUEST_LIMIT' }); return;
            }
            update({ pending, diagnostic: null }); void send(pending);
          };
          const close = () => {
            if (current.dirty || current.pending) { setConfirmClose(true); return; }
            editDrafts.delete(id); onClose();
          };
          return h('section', { 'data-note-edit': id, role: 'dialog', 'aria-modal': true, onKeyDown: dialogKeys, tabIndex: -1, ref: element => { if (element && !element.contains(document.activeElement)) element.focus(); } },
            h('div', { 'data-note-edit-heading': true }, h('h4', null, text('editTitle')),
              h('div', { 'data-note-edit-actions': true },
                current.base ? h('button', { type: 'button', style: controlStyle, 'data-notebook-confirm': true,
                  disabled: !!current.pending || !current.dirty, onClick: save }, text('editSave')) : null,
                h('button', { type: 'button', style: controlStyle, 'data-dialog-cancel': true, onClick: close }, text('editClose')))),
            current.dirty || current.pending ? h('p', { role: 'status' }, text('editDraftWarning')) : null,
            confirmClose ? h('div', null, h('p', null, text('editConfirmClose')),
              h('button', { type: 'button', style: controlStyle,
                onClick: () => setConfirmClose(false) }, text('editKeepEditing')),
              h('button', { type: 'button', style: controlStyle,
                onClick: () => { setConfirmClose(false); onClose(); } }, text('editCloseKeep')),
              !current.pending ? h('button', { type: 'button', onClick: () => { editDrafts.delete(id); onClose(); } }, '丢弃修改') : null) : null,
            !current.base ? h('p', { role: 'status' }, text('libraryLoading')) : null,
            current.base?.note.source ? h('p', { 'data-notebook-edit-source': true, title: current.base.note.source.sessionId ?? '' },
              `${text('librarySource')}: ${current.base.note.source.sessionTitle || '来源会话'}`) : null,
            current.base ? h('label', null, text('draftTitle'), h('input', {
              type: 'text', value: current.title, disabled: !!current.pending,
              onChange: event => update({ title: event.target.value, dirty: true, diagnostic: null }) })) : null,
            current.base ? h('label', null, text('editBody'),
              h('textarea', { value: current.body, rows: 9, disabled: !!current.pending,
                onChange: event => update({ body: event.target.value, dirty: true, diagnostic: null }) })) : null,
            current.base ? h('fieldset', { 'data-note-edit-tags': true, disabled: !!current.pending },
              h('legend', null, text('editTags'), '（可多选）'),
              h('div', { className: 'notebook-edit-tag-options' }, ...tags.map(tag => h('label', { key: tag.id },
                h('input', { type: 'checkbox', checked: current.tagIds.includes(tag.id),
                  disabled: !!current.pending || (!current.tagIds.includes(tag.id) && current.tagIds.length >= 10),
                  onChange: event => update({ tagIds: event.target.checked
                    ? [...new Set([...current.tagIds, tag.id])] : current.tagIds.filter(id => id !== tag.id),
                    dirty: true, diagnostic: null }) }), tag.name))),
              h('small', null, tags.length ? '已选 ' + current.tagIds.length + ' / 10' : '暂无标签，可在标签页面新建')) : null,
            current.base?.note.quote ? h('details', { 'data-notebook-original': true, open: true },
              h('summary', null, text('convertOriginal')), h('pre', null, current.base.note.quote.content)) : null,
            current.pending && !current.busy && current.diagnostic !== 'COMMIT_UNKNOWN'
              ? h('button', { type: 'button', style: controlStyle,
                onClick: () => { void send(current.pending); } }, text('editRetry')) : null,
            ['VERSION_CONFLICT', 'EPOCH_CONFLICT'].includes(current.diagnostic) && !current.pending
              ? h('button', { type: 'button', style: controlStyle,
                onClick: () => { void readLatest(true); } }, text('editReload')) : null,
            current.latest ? h('section', null,
              h('p', null, `${text('serverVersion')}: ${current.latest.note.version}`),
              h('pre', null, current.latest.note.bodyMarkdown ?? current.latest.note.quote?.content ?? ''),
              h('p', null, text('localDraft')), h('pre', null, current.body),
              h('button', { type: 'button', style: controlStyle,
                disabled: current.latest.note.kind !== current.base.note.kind,
                onClick: () => update({ base: current.latest, latest: null, diagnostic: null }) },
              text('editUseLatest'))) : null,
            current.busy ? h('p', { role: 'status' }, text('savingDraft')) : null,
            current.diagnostic ? h('code', { role: 'status' }, current.diagnostic) : null);
        }
        function TagManager({ onChanged, compact = false }) {
          const text = useText();
          const operation = useTagOperation();
          const [catalog, setCatalog] = React.useState(null);
          const [action, setAction] = React.useState('create');
          const [name, setName] = React.useState('');
          const [color, setColor] = React.useState('');
          const [sourceId, setSourceId] = React.useState('');
          const [targetId, setTargetId] = React.useState('');
          const [preview, setPreview] = React.useState(null);
          const [diagnostic, setDiagnostic] = React.useState(null);
          const [status, setStatus] = React.useState(null);
          const active = React.useRef(false);
          const reads = React.useRef(new Set());
          const mutation = React.useRef(null);
          const createDraft = React.useRef({ name: '', color: '' });
          const sequence = React.useRef(0);
          const previewSequence = React.useRef(0);
          const load = async () => {
            const current = ++sequence.current;
            const controller = new AbortController(); reads.current.add(controller);
            try {
              const value = await getManualApi().tagsList(controller.signal);
              if (active.current && current === sequence.current) setCatalog(value);
            } catch (error) {
              if (active.current && current === sequence.current) setDiagnostic(safeDiagnostic(error));
            } finally { reads.current.delete(controller); }
          };
          React.useEffect(() => {
            active.current = true; void load();
            return () => {
              active.current = false; sequence.current++;
              previewSequence.current++;
              for (const controller of reads.current) controller.abort();
              reads.current.clear(); mutation.current?.abort();
            };
          }, []);
          const choose = (next, setter) => {
            previewSequence.current++;
            setter(next); setPreview(null); setStatus(null); setDiagnostic(null);
          };
          const prepare = async (nextAction = action, nextSource = sourceId, nextTarget = targetId) => {
            if (operation.pending || !nextSource || (nextAction === 'merge' && !nextTarget)) return;
            const currentPreview = ++previewSequence.current;
            const controller = new AbortController(); reads.current.add(controller);
            setPreview(null); setDiagnostic(null);
            try {
              const value = await getManualApi().tagsPreview({ action: nextAction, sourceId: nextSource,
                ...(nextAction === 'merge' ? { targetId: nextTarget } : {}) }, controller.signal);
              if (active.current && currentPreview === previewSequence.current) setPreview(value);
            } catch (error) {
              if (active.current && currentPreview === previewSequence.current)
                setDiagnostic(safeDiagnostic(error));
            }
            finally { reads.current.delete(controller); }
          };
          const send = async pending => {
            if (tagOperation.busy || tagOperation.pending !== pending) return;
            updateTagOperation({ busy: true, diagnostic: null });
            const controller = new AbortController(); mutation.current = controller;
            try {
              await getManualApi()[pending.method](pending.payload, controller.signal);
              updateTagOperation({ pending: null, diagnostic: null });
              if (active.current) {
                const draft = compact && pending.method === 'tagsRename' ? createDraft.current : { name: '', color: '' };
                setPreview(null); setName(draft.name); setColor(draft.color);
                setSourceId(''); setTargetId(''); if (compact) setAction('create'); setStatus('tagSaved');
                void load(); onChanged();
              }
            } catch (error) {
              const code = safeDiagnostic(error);
              const uncertain = ['TIMEOUT', 'TRANSPORT_FAILED', 'CANCELLED', 'COMMIT_UNKNOWN',
                'INVALID_RESPONSE'].includes(code);
              updateTagOperation({ pending: uncertain ? pending : null, diagnostic: code });
              if (active.current && !uncertain) { setPreview(null); void load(); }
            } finally {
              mutation.current = null;
              updateTagOperation({ busy: false });
            }
          };
          const submit = () => {
            if (!catalog || operation.pending || operation.busy) return;
            const source = catalog.items.find(item => item.id === sourceId);
            const trimmed = name.trim();
            if ((action === 'create' || action === 'rename') && !trimmed) {
              setDiagnostic('VALIDATION_FAILED'); return;
            }
            if ((action === 'create' || action === 'rename') && [...trimmed].length > 32) {
              setDiagnostic('TAG_NAME_LIMIT'); return;
            }
            if (color && !isTagColor(color)) { setDiagnostic('VALIDATION_FAILED'); return; }
            if (action !== 'create' && !source) { setDiagnostic('VALIDATION_FAILED'); return; }
            if ((action === 'merge' || action === 'delete') && (!preview || preview.action !== action
              || preview.sourceId !== sourceId || (action === 'merge' && preview.targetId !== targetId))) {
              setDiagnostic('CONFIRM_REQUIRED'); return;
            }
            const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
            const requestId = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
            const base = { requestId, epoch: preview?.epoch ?? catalog.epoch,
              expectedRevision: preview?.revision ?? catalog.revision };
            const payload = action === 'create' ? { ...base, name: trimmed, ...(color && { color }) }
              : action === 'rename' ? { ...base, tagId: sourceId, expectedVersion: source.version,
                name: trimmed, ...(color && { color }) }
              : { ...base, sourceId, ...(action === 'merge' ? { targetId } : {}), preview };
            const pending = { method: `tags${action[0].toUpperCase()}${action.slice(1)}`, payload };
            updateTagOperation({ pending, diagnostic: null });
            void send(pending);
          };
          const editingDialog = compact && action === 'rename';
          const cancelEdit = () => {
            if (operation.busy) return;
            choose('create', setAction); setSourceId(''); setTargetId('');
            setName(createDraft.current.name); setColor(createDraft.current.color);
          };
          const nameInput = () => h('label', null, text('tagName'), h('input', {
            type: 'text', value: name, disabled: !!operation.pending,
            onChange: event => choose(event.target.value, setName) }));
          const colorPicker = () => h('fieldset', { 'data-notebook-tag-colors': true,
            disabled: !!operation.pending },
            h('legend', null, text('tagColor')),
            ...(action === 'create' ? [h('label', { key: 'auto' },
              h('input', { type: 'radio', name: 'notebook-tag-color', value: '', checked: !color,
                onChange: () => choose('', setColor) }), text('tagColorAuto'))] : []),
            ...TAG_COLORS.map((value, index) => h('label', { key: value, title: text(`tagColor${index}`) },
              h('input', { type: 'radio', name: 'notebook-tag-color', value,
                'aria-label': text(`tagColor${index}`), checked: color === value,
                onChange: () => choose(value, setColor) }),
              h('span', { className: 'notebook-color-swatch', style: { '--choice-color': value },
                'aria-hidden': true }))));
          const saveButton = () => h('button', { type: 'button', style: controlStyle,
            disabled: !catalog || !!operation.pending, onClick: submit },
            text(`tag${action[0].toUpperCase()}${action.slice(1)}`));
          const retryButton = () => operation.pending && !operation.busy && operation.diagnostic !== 'COMMIT_UNKNOWN'
            ? h('button', { type: 'button', style: controlStyle,
              onClick: () => { void send(operation.pending); } }, text('tagRetry')) : null;
          const operationError = () => diagnostic || operation.diagnostic ? h('code', { role: 'status' },
            diagnostic ?? operation.diagnostic,
            ...(diagnostic === 'TAG_NAME_LIMIT' ? [' — ', text('tagNameLimit')] : [])) : null;
          return h('section', { 'data-notebook-tags': true },
            !compact || (action !== 'create' && !editingDialog) ? h('div', { 'data-notebook-tag-heading': true },
              !compact ? h('h4', null, text('tagManage')) : null,
              compact && action !== 'create' && !editingDialog ? h('button', { type: 'button', disabled: !!operation.pending,
                onClick: () => { choose('create', setAction); setSourceId(''); setName(''); setColor(''); } }, '新建标签') : null) : null,
            !catalog ? h('p', { role: 'status' }, text('tagLoading')) : null,
            catalog ? compact ? h('div', null, ...catalog.items.map(tag => h('div', { key: tag.id, className: 'notebook-tag-row' },
              h('span', null, h('span', { className: 'notebook-tag-color', 'aria-hidden': true,
                style: { '--tag-color': resolvedTagColor(tag.color, tag.id) } }),
              tag.name, h('small', null, ` · ${tag.active} 条笔记`)),
              h('details', { className: 'notebook-tag-actions' }, h('summary', null, '更多操作'),
                h('div', { className: 'notebook-tag-menu' }, ...[['rename', '编辑标签'], ['merge', '合并'], ['delete', '删除']].map(([key, label]) => h('button', { key, type: 'button', disabled: !!operation.pending, onClick: event => {
                  if (event?.currentTarget?.closest) event.currentTarget.closest('details').open = false;
                  if (key === 'rename' && action === 'create') createDraft.current = { name, color };
                  choose(key, setAction); setSourceId(tag.id); setTargetId(''); setName(key === 'rename' ? tag.name : '');
                  setColor(key === 'rename' ? resolvedTagColor(tag.color, tag.id) : '');
                  if (key === 'delete') void prepare(key, tag.id, '');
                } }, label))))))) : h('p', null, ...catalog.items.map(tag => h('span', { key: tag.id },
              h('span', { className: 'notebook-tag-color', 'aria-hidden': true,
                style: { '--tag-color': resolvedTagColor(tag.color, tag.id) } }),
              `${tag.name}: ${text('tagActive')} ${tag.active}, ${text('tagTrashed')} ${tag.trashed}; `))) : null,
            !compact ? h('select', { value: action, 'aria-label': text('tagManage'), disabled: !!operation.pending,
              onChange: event => { choose(event.target.value, setAction); setColor(''); } },
              ...[['create', 'tagCreate'], ['rename', 'tagRename'], ['merge', 'tagMerge'],
                ['delete', 'tagDelete']].map(([key, label]) => h('option', { key, value: key }, text(label)))) : null,
            action !== 'create' && !editingDialog ? h('label', null, text('tagSource'), h('select', {
              value: sourceId, disabled: !!operation.pending,
              onChange: event => { const id = event.target.value; choose(id, setSourceId);
                const tag = catalog?.items.find(item => item.id === id);
                if (action === 'rename') { setName(tag?.name ?? ''); setColor(tag ? resolvedTagColor(tag.color, id) : ''); }
              } },
              h('option', { value: '' }, ''), ...(catalog?.items ?? []).map(tag =>
                h('option', { key: tag.id, value: tag.id }, tag.name)))) : null,
            action === 'merge' ? h('label', null, text('tagTarget'), h('select', {
              value: targetId, disabled: !!operation.pending,
              onChange: event => choose(event.target.value, setTargetId) },
              h('option', { value: '' }, ''), ...(catalog?.items ?? []).filter(tag => tag.id !== sourceId)
                .map(tag => h('option', { key: tag.id, value: tag.id }, tag.name)))) : null,
            ['create', 'rename'].includes(action) && !editingDialog ? nameInput() : null,
            ['create', 'rename'].includes(action) && !editingDialog ? colorPicker() : null,
            ['merge', 'delete'].includes(action) && !preview ? h('button', { type: 'button',
              style: controlStyle, disabled: !catalog || !!operation.pending,
              onClick: () => { void prepare(); } }, text('tagPreview')) : null,
            preview ? h('div', { 'data-tag-impact': true, role: compact ? 'dialog' : undefined, 'aria-modal': compact || undefined, onKeyDown: dialogKeys, tabIndex: -1, ref: element => { if (compact && element && !element.contains(document.activeElement)) element.focus(); } },
              h('h4', null, action === 'delete' ? '删除标签' : '合并标签'),
              h('p', null, action === 'delete' ? '仅移除标签和关联，笔记内容会保留。' : '把原标签的笔记关联转移到目标标签。'),
              h('p', null, `${text('tagActive')}: ${preview.activeAffected}; ${text('tagTrashed')}: ${preview.trashedAffected}`),
              h('button', { type: 'button', style: controlStyle, disabled: !!operation.pending,
                onClick: submit }, text('tagConfirm')),
              operation.pending && !operation.busy && operation.diagnostic !== 'COMMIT_UNKNOWN' ? h('button', { type: 'button', onClick: () => void send(operation.pending) }, text('tagRetry')) : null,
              operation.diagnostic ? h('code', { role: 'status' }, operation.diagnostic) : null,
              h('button', { type: 'button', style: controlStyle, disabled: operation.busy,
                'data-dialog-cancel': true, onClick: () => { previewSequence.current++; setPreview(null); } }, operation.pending ? '关闭并保留待确认操作' : text('tagCancel'))) : null,
            ['create', 'rename'].includes(action) && !editingDialog ? saveButton() : null,
            editingDialog ? h('section', { 'data-notebook-tag-edit-dialog': true, role: 'dialog',
              'aria-modal': true, 'aria-label': '编辑标签', onKeyDown: dialogKeys, tabIndex: -1,
              ref: element => { if (element && !element.contains(document.activeElement)) element.focus(); } },
              h('h4', null, '编辑标签'), nameInput(), colorPicker(),
              h('div', { 'data-notebook-tag-edit-actions': true }, saveButton(),
                h('button', { type: 'button', style: controlStyle, disabled: operation.busy,
                  'data-dialog-cancel': true, onClick: cancelEdit }, text('tagCancel')), retryButton()),
              operation.busy ? h('p', { role: 'status' }, text('tagBusy')) : null,
              operationError()) : null,
            compact && (preview || editingDialog) ? h('div', { 'data-notebook-backdrop': true, 'aria-hidden': true, style: { position: 'fixed', inset: 0, background: '#0005', zIndex: 1090 } }) : null,
            !editingDialog && !preview ? retryButton() : null,
            !editingDialog && operation.busy ? h('p', { role: 'status' }, text('tagBusy')) : null,
            status ? h('p', { role: 'status' }, text(status)) : null,
            !editingDialog ? operationError() : null);
        }
        const notebookDate = value => new Intl.DateTimeFormat('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
          hour12: false,
        }).format(new Date(value));
        function WorkspaceContext({ sessionId, useWorkspaces }) {
          const text = useText();
          const context = useWorkspaces(snapshot => {
            if (snapshot.state === 'error') return { state: 'workspaceError' };
            if (snapshot.phase !== 'ready') return { state: 'workspacePending' };
            const matches = snapshot.items.filter(item => item.sessionIds.includes(sessionId));
            if (matches.length > 1) return { state: 'workspaceAmbiguous' };
            const workspace = matches[0];
            return workspace ? { state: 'ready', title: workspace.title, path: workspace.path } : { state: 'noWorkspace' };
          });
          if (context.state !== 'ready') return h('div', { role: 'status', 'data-notebook-context': true,
            'data-notebook-workspace-status': true }, h('span', null, text(context.state)));
          return h('div', { 'data-notebook-context': true, title: context.path, 'aria-label': `工作区：${context.title}` },
            h('span', null, context.title), h('span', { 'aria-hidden': true }, ' · 工作区'));
        }
        function NotebookHome({ sessionId, useWorkspaces, draftKey, draft, setDraft, onDiscard }) {
          const [view, setView] = React.useState('notes');
          const ready = useStorageReady();
          const homeRef = React.useRef(null);
          React.useEffect(() => {
            const root = homeRef.current;
            if (!root) return;
            const onOutsideMenu = event => {
              for (const menu of root.querySelectorAll('[data-note-more][open], .notebook-tag-actions[open]')) {
                if (!menu.contains(event.target)) menu.open = false;
              }
            };
            const owner = root.ownerDocument;
            owner.addEventListener('pointerdown', onOutsideMenu, true);
            return () => owner.removeEventListener('pointerdown', onOutsideMenu, true);
          }, []);
          return h('div', { 'data-notebook-unified-home': true, ref: homeRef },
            h('div', { 'data-notebook-toolbar': true },
              h('nav', { 'aria-label': '笔记导航', 'data-notebook-nav': true },
                ...[['notes', '笔记库'], ['trash', '回收站'], ['tags', '标签'], ['backup', '数据备份']].map(([key, label]) =>
                  h('button', { key, type: 'button', 'aria-pressed': view === key, onClick: () => setView(key) }, label))),
              !draft.open ? h('button', { type: 'button', 'data-notebook-primary': true,
                onClick: () => setDraft(value => ({ ...value, open: true })) },
                draft.title || draft.body || draft.tagIds?.length ? '继续草稿' : '新建笔记') : null),
            draft.open ? h('div', { 'data-notebook-compose': true }, h(ManualDraft, { draftKey, draft, setDraft, onDiscard, sessionId, useWorkspaces, unified: true })) : null,
            ready && ['notes', 'trash'].includes(view) ? h(SessionLibrary, { sessionId, useWorkspaces, trashMode: view === 'trash', unified: true }) : null,
            ready && view === 'tags' ? h(TagManager, { compact: true, onChanged: () => { for (const refresh of libraryRefreshListeners) refresh(); } }) : null,
            ready && view === 'backup' ? h(NotebookBackup) : null);
        }
        function NotebookBackup() {
          const [status, setStatus] = React.useState('');
          const [busy, setBusy] = React.useState(false);
          const active = React.useRef(false);
          const request = React.useRef(null);
          React.useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort(); }; }, []);
          const download = async () => {
            if (busy) return;
            const controller = new AbortController(); request.current = controller;
            setBusy(true); setStatus('正在准备备份…');
            try { const value = await getManualApi().backup(controller.signal);
              if (!active.current || controller.signal.aborted) return;
              downloadBackupFile(backupFile(value), { document: window.document, URL: window.URL });
              setStatus('已开始下载备份');
            } catch (error) { if (active.current) setStatus(safeDiagnostic(error)); }
            finally { if (active.current) setBusy(false); }
          };
          return h('section', { 'data-notebook-backup': true },
            h('p', null, '备份保留完整笔记库，包括笔记、标签、来源锚点和回收站内容。应用内恢复暂未开放。'),
            h('button', { type: 'button', 'data-notebook-backup-download': true, disabled: busy, onClick: () => void download() }, '下载数据备份'),
            h('p', null, '需要阅读或分享？在笔记列表下载单篇 Markdown，或勾选多篇后导出 Markdown。'),
            h('p', { role: 'status' }, status));
        }
        function Panel({ sessionId, useTabInfo, useWorkspaces }) {
          const text = useText();
          const info = useTabInfo();
          const [draft, setDraft] = useRetainedDraft(`session:${sessionId}`);
          const closePanel = () => {
            if (draft.open && (draft.title || draft.body || draft.tagIds?.length)) { setDraft(value => ({ ...value, confirm: true, closeAfterDiscard: true })); return; }
            info.tab.actions.close();
          };
          return h('section', {
            'data-notebook-panel': true,
            style: { height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box', padding: 16, color: 'var(--dsw-alias-label-primary)', fontSize: '0.875rem' },
          }, h('div', { 'data-notebook-heading': true, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('strong', null, text('title')),
            h('button', { type: 'button', style: controlStyle, onClick: closePanel }, text('close'))),
          h('code', { style: { overflowWrap: 'anywhere' } }, sessionId),
          h(WorkspaceContext, { sessionId, useWorkspaces }),
          h(NotebookHome, { draftKey: `session:${sessionId}`, draft, setDraft, sessionId, useWorkspaces,
            onDiscard: closeAfterDiscard => { if (closeAfterDiscard) info.tab.actions.close(); } }),
          h(VersionLabel),
          h(ConnectionStatus));
        }
        if (typeof ctx.inject === 'function') {
          ctx.inject(['sidebarRightTabs', 'sidebarRight'], mountNativePanel);
        } else {
          // Narrow test/legacy contexts without Cordis dynamic injection.
          mountNativePanel(ctx);
        }
        ctx.effect(() => () => {
          openedBy = null; listeners.clear(); libraryRefreshListeners.clear(); storageListeners.clear(); retainedDrafts.clear(); annotationDrafts.clear(); savingKeys.clear();
          for (const record of controllerRecords.values()) record.instance.dispose();
          controllerRecords.clear();
        });
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'dsh-session-notebook.annotations', order: 6,
        }, ConversationAnnotations));
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action', id: 'dsh-session-notebook.global-entry', order: 20,
        }, GlobalEntry));
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'dsh-session-notebook.overlay', order: 5,
        }, Overlay));
      },
    };
  },
});
