// Pure whole-Snapshot note candidates, never a persistence or DSH session API.
// The Host must validate input, own time/IDs, persist atomically and publish only
// after commit. Confirmations are caller-owned user actions, not inferred here.
const fail = code => { throw Object.assign(new Error(code), { code }); };
const has = (value, key) => Object.hasOwn(value, key);
const identifier = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id)
  && !['__proto__', 'constructor', 'prototype'].includes(id);
const checkTime = time => typeof time === 'string' && Number.isFinite(Date.parse(time))
  && new Date(time).toISOString() === time;
// These are interim per-field limits, not a total library or transport quota.
// Validate before cloning the entire Snapshot; the final Schema remains authoritative.
const boundedText = (value, max) => typeof value === 'string' && value.length <= max
  && [...value].length <= max;

/**
 * Construct one candidate from a trusted Host-verified quote/source/anchor.
 * The input is an editable draft, never a transport DTO: Host must establish
 * message ownership and authenticate before supplying the trusted provenance.
 * Blank drafts are deliberately not persisted.
 */
export function createNote(current, draft, { id, time, expectedRevision, provenance = {} }, validate) {
  if (!current || !current.notes || !current.tags || !draft || typeof draft !== 'object'
    || Array.isArray(draft) || !provenance || typeof provenance !== 'object'
    || Array.isArray(provenance) || typeof validate !== 'function'
    || !Number.isSafeInteger(expectedRevision) || current.revision !== expectedRevision)
    fail('VERSION_CONFLICT');
  if (!identifier(id) || has(current.notes, id) || !checkTime(time)
    || Object.keys(draft).some(key => !['kind', 'title', 'bodyMarkdown', 'tagIds'].includes(key))
    || Object.keys(provenance).some(key => !['quote', 'anchor', 'source'].includes(key)))
    fail('VALIDATION_FAILED');
  const { kind, title, bodyMarkdown, tagIds = [] } = draft;
  if (!['highlight', 'note', 'manual'].includes(kind)
    || (title !== undefined && !boundedText(title, 1000))
    || !Array.isArray(tagIds) || tagIds.length > 10 || new Set(tagIds).size !== tagIds.length
    || tagIds.some(tagId => !identifier(tagId) || !has(current.tags, tagId) || current.tags[tagId].deletedAt)
    || (kind === 'highlight' && bodyMarkdown !== undefined)
    || (kind !== 'highlight' && (!boundedText(bodyMarkdown, 100000) || !bodyMarkdown.trim()))
    || (kind !== 'manual' && !provenance.quote)
    || (provenance.anchor && !provenance.quote)) fail('VALIDATION_FAILED');
  const next = structuredClone(current);
  next.notes[id] = { id, schemaVersion: 1, kind,
    ...(title === undefined ? {} : { title }),
    ...(bodyMarkdown === undefined ? {} : { bodyMarkdown }),
    ...structuredClone(provenance), tagIds: [...tagIds], createdBy: 'user',
    createdAt: time, updatedAt: time, version: 1 };
  next.revision++;
  return validate(next);
}

/** Read-only preview for the caller's high-risk confirmation UI. */
export function previewPermanentDelete(current, ids) {
  if (!current || !current.notes || !Number.isSafeInteger(current.revision)
    || !Array.isArray(ids) || ids.length < 1 || ids.length > 200
    || new Set(ids).size !== ids.length) fail('VALIDATION_FAILED');
  const entries = ids.map(id => {
    if (!identifier(id) || !has(current.notes, id) || !current.notes[id].deletedAt)
      fail('VALIDATION_FAILED');
    const note = current.notes[id];
    return { id, version: note.version, title: note.title ?? '', kind: note.kind };
  });
  return { epoch: current.epoch, revision: current.revision, count: entries.length, entries };
}

/** Confirmed note operations use the same ordered, version-bound preview. */
export function previewNoteChange(current, action, ids) {
  if (!['trash', 'restore', 'purge'].includes(action)) fail('VALIDATION_FAILED');
  if (action === 'purge') return { action, ...previewPermanentDelete(current, ids) };
  if (!current || !current.notes || !Number.isSafeInteger(current.revision)
    || !Array.isArray(ids) || ids.length < 1 || ids.length > 200
    || new Set(ids).size !== ids.length) fail('VALIDATION_FAILED');
  const entries = ids.map(id => {
    if (!identifier(id) || !has(current.notes, id)
      || (action === 'restore' ? !current.notes[id].deletedAt : !!current.notes[id].deletedAt))
      fail('VALIDATION_FAILED');
    const note = current.notes[id];
    return { id, version: note.version, title: note.title ?? '', kind: note.kind };
  });
  return { action, epoch: current.epoch, revision: current.revision,
    count: entries.length, entries };
}

/**
 * Explicitly confirmed, version-bound candidate; does not authorize itself.
 * UI/Host must show high-risk confirmation tied to this preview, and Host
 * must recheck epoch/revision through the same mutation queue before commit.
 */
export function permanentlyDeleteNotes(current, preview, { confirmed }, validate) {
  if (confirmed !== true || !preview || typeof preview !== 'object') fail('CONFIRM_REQUIRED');
  if (!current || current.epoch !== preview.epoch || current.revision !== preview.revision)
    fail('VERSION_CONFLICT');
  if (typeof validate !== 'function' || !Array.isArray(preview.entries)
    || !Number.isSafeInteger(preview.count) || preview.count !== preview.entries.length)
    fail('VALIDATION_FAILED');
  const fresh = previewPermanentDelete(current, preview.entries.map(entry => entry.id));
  if (fresh.count !== preview.count || fresh.entries.some((entry, index) => {
    const seen = preview.entries[index];
    return !seen || Object.keys(seen).length !== 4 || entry.id !== seen.id
      || entry.version !== seen.version || entry.title !== seen.title || entry.kind !== seen.kind;
  })) fail('VERSION_CONFLICT');
  const next = structuredClone(current);
  for (const entry of fresh.entries) delete next.notes[entry.id];
  next.revision++;
  return validate(next);
}

/** Version-check the whole batch before touching any candidate. */
export function changeNotes(current, { changes, expectedRevision, time }, validate) {
  if (!current || !current.notes || typeof validate !== 'function' || !checkTime(time)
    || !Number.isSafeInteger(expectedRevision) || current.revision !== expectedRevision)
    fail('VERSION_CONFLICT');
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > 200) fail('VALIDATION_FAILED');
  const seen = new Set();
  for (const change of changes) {
    if (!change || !identifier(change.id) || seen.has(change.id) || !has(current.notes, change.id)
      || !['edit', 'convert', 'trash', 'restore'].includes(change.action)) fail('VALIDATION_FAILED');
    seen.add(change.id);
    const note = current.notes[change.id];
    if (!Number.isSafeInteger(change.expectedVersion) || note.version !== change.expectedVersion)
      fail('VERSION_CONFLICT');
    if (change.action === 'restore' ? !note.deletedAt : !!note.deletedAt) fail('VALIDATION_FAILED');
    const permitted = change.action === 'edit' ? ['id', 'action', 'expectedVersion', 'title', 'bodyMarkdown', 'tagIds']
      : change.action === 'convert' ? ['id', 'action', 'expectedVersion', 'kind', 'bodyMarkdown', 'confirmRemoveBody']
        : ['id', 'action', 'expectedVersion'];
    if (Object.keys(change).some(key => !permitted.includes(key))) fail('VALIDATION_FAILED');
    if (change.action === 'convert' && !['highlight', 'note', 'manual'].includes(change.kind)) fail('VALIDATION_FAILED');
    if (change.action === 'edit' && !['title', 'bodyMarkdown', 'tagIds'].some(key => has(change, key))) fail('VALIDATION_FAILED');
    if ((has(change, 'title') && !boundedText(change.title, 1000))
      || (has(change, 'bodyMarkdown') && (!boundedText(change.bodyMarkdown, 100000)
        || (change.action === 'convert' && change.kind !== 'highlight' && !change.bodyMarkdown.trim()))))
      fail('VALIDATION_FAILED');
  }
  const next = structuredClone(current);
  for (const change of changes) {
    const note = next.notes[change.id];
    if (change.action === 'edit') {
      if (has(change, 'title')) {
        if (typeof change.title !== 'string' || [...change.title].length > 1000) fail('VALIDATION_FAILED');
        note.title = change.title;
      }
      if (has(change, 'bodyMarkdown')) {
        if (typeof change.bodyMarkdown !== 'string' || !change.bodyMarkdown.trim())
          fail('VALIDATION_FAILED');
        if (note.kind === 'highlight') note.kind = 'note';
        note.bodyMarkdown = change.bodyMarkdown;
      }
      if (has(change, 'tagIds')) {
        if (!Array.isArray(change.tagIds) || change.tagIds.length > 10
          || new Set(change.tagIds).size !== change.tagIds.length
          || change.tagIds.some(id => !identifier(id) || !has(next.tags, id) || next.tags[id].deletedAt))
          fail('VALIDATION_FAILED');
        note.tagIds = [...change.tagIds];
      }
    } else if (change.action === 'convert') {
      if (change.kind === 'highlight') {
        if (!note.quote || (note.bodyMarkdown && change.confirmRemoveBody !== true)) fail('CONFIRM_REQUIRED');
        delete note.bodyMarkdown;
      } else {
        if (change.kind === 'note' && !note.quote) fail('VALIDATION_FAILED');
        if (typeof change.bodyMarkdown !== 'string' || !change.bodyMarkdown.trim()) fail('VALIDATION_FAILED');
        note.bodyMarkdown = change.bodyMarkdown;
      }
      note.kind = change.kind;
    } else if (change.action === 'trash') note.deletedAt = time;
    else delete note.deletedAt;
    note.version++;
    note.updatedAt = time;
  }
  next.revision++;
  return validate(next);
}
