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

export function previewApi(connection, { timeoutMs = 10000 } = {}) {
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
