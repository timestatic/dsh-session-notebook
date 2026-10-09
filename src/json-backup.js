import { notebookSchema } from './notebook-schema.js';

// Pure serialization/preview only: no file IO, mutation, token issuance,
// medium protection or restore. Callers must check byte length BEFORE reading
// an untrusted file and must not treat a preview as permission to commit.
export const DEFAULT_BACKUP_BYTES = 50 * 1024 * 1024;
export const BACKUP_VERSION = 1;
const fail = code => { throw Object.assign(new Error(code), { code }); };
function limitBytes(maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) fail('INVALID_LIMIT');
}
export function backupJson(snapshot, { maxBytes = DEFAULT_BACKUP_BYTES } = {}) {
  limitBytes(maxBytes);
  const value = notebookSchema.parse(snapshot);
  const content = JSON.stringify({ format: 'dsh-session-notebook-backup', backupVersion: BACKUP_VERSION, snapshot: value });
  const bytes = new TextEncoder().encode(content).byteLength;
  if (bytes > maxBytes) fail('BACKUP_TOO_LARGE');
  return { content, bytes, revision: value.revision };
}

/** Caller passes the independently measured file size before loading bytes. */
export function inspectBackupJson(content, { declaredBytes, maxBytes = DEFAULT_BACKUP_BYTES } = {}) {
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
export function previewBackupReplacement(current, inspected) {
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
