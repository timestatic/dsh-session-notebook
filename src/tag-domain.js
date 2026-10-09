import { createNote } from './note-domain.js';
import { TAG_COLORS, isTagColor, normalizeTagColor, resolvedTagColor } from './tag-colors.js';

// Whole-Snapshot candidate transformations only. Never publish the result
// directly: the Host must validate it, serialize it through one authoritative
// mutation queue, persist atomically, and only then replace its cache.
const fail = code => { throw Object.assign(new Error(code), { code }); };
const has = (object, id) => Object.hasOwn(object, id);
const assertId = id => {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)
    || ['__proto__', 'constructor', 'prototype'].includes(id)) fail('VALIDATION_FAILED');
};
const assertRevision = (current, revision) => {
  if (!Number.isSafeInteger(revision) || current.revision !== revision) fail('VERSION_CONFLICT');
};
const liveTag = (current, id) => {
  assertId(id);
  if (!has(current.tags, id) || current.tags[id].deletedAt) fail('VALIDATION_FAILED');
  return current.tags[id];
};
const replace = (ids, from, to) => [...new Set(ids.map(id => id === from ? to : id).filter(Boolean))];
const assertTime = time => {
  if (typeof time !== 'string' || !Number.isFinite(Date.parse(time)) || new Date(time).toISOString() !== time)
    fail('VALIDATION_FAILED');
};
const finish = (current, next, validate) => {
  if (typeof validate !== 'function') fail('VALIDATION_FAILED');
  next.revision = current.revision + 1;
  // Validation returns an independent candidate (e.g. the product Schema's
  // parse output). Never publish an unvalidated mutable clone.
  return validate(next);
};
const nextTagColor = tags => {
  const counts = new Map(TAG_COLORS.map(color => [color, 0]));
  for (const tag of Object.values(tags)) {
    if (tag.deletedAt) continue;
    const color = resolvedTagColor(tag.color, tag.id);
    counts.set(color, counts.get(color) + 1);
  }
  return TAG_COLORS.reduce((choice, color) => counts.get(color) < counts.get(choice) ? color : choice);
};

/** Default list counts live notes; confirmation also shows trashed impact. */
export function tagUsage(current, id) {
  liveTag(current, id);
  let active = 0, trashed = 0;
  for (const note of Object.values(current.notes)) {
    if (note.tagIds.includes(id)) {
      if (note.deletedAt) trashed++;
      else active++;
    }
  }
  return { active, trashed };
}

/** Read-only preview: stale revision/version must be rechecked before any commit. */
export function previewTagChange(current, { action, sourceId, targetId }) {
  if (!['merge', 'delete'].includes(action)) fail('VALIDATION_FAILED');
  if (action === 'delete' && targetId !== undefined) fail('VALIDATION_FAILED');
  const source = liveTag(current, sourceId);
  if (action === 'merge' && (sourceId === targetId || !targetId)) fail('VALIDATION_FAILED');
  const target = action === 'merge' ? liveTag(current, targetId) : null;
  const affected = tagUsage(current, sourceId);
  return { action, epoch: current.epoch, revision: current.revision, sourceId,
    sourceVersion: source.version, ...(target && { targetId, targetVersion: target.version }),
    activeAffected: affected.active, trashedAffected: affected.trashed,
    quickTagAffected: current.settings.quickTagIds.includes(sourceId) };
}

export function createTag(current, { id, name, color, expectedRevision, time }, validate) {
  assertRevision(current, expectedRevision);
  assertId(id); assertTime(time);
  if (color !== undefined && !isTagColor(color)) fail('VALIDATION_FAILED');
  if (has(current.tags, id)) fail('VALIDATION_FAILED'); // Never reuse a deleted ID.
  const display = typeof name === 'string' ? name.trim() : name;
  const normalizedKey = normalizeTagName(display);
  if (Object.values(current.tags).some(tag => !tag.deletedAt && tag.normalizedKey === normalizedKey))
    fail('NAME_CONFLICT');
  const next = structuredClone(current);
  next.tags[id] = { id, schemaVersion: 1, name: display, normalizedKey,
    color: color === undefined ? nextTagColor(current.tags) : normalizeTagColor(color),
    createdAt: time, updatedAt: time, version: 1 };
  return finish(current, next, validate);
}

/** One candidate revision; a new tag and its first note never commit separately. */
export function createTaggedNote(current, draft, { tagId, tagName, noteId, time, expectedRevision,
  provenance = {} }, validate) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) fail('VALIDATION_FAILED');
  const withTag = createTag(current, { id: tagId, name: tagName, expectedRevision, time }, validate);
  const tagIds = draft.tagIds ?? [];
  if (!Array.isArray(tagIds) || tagIds.includes(tagId)) fail('VALIDATION_FAILED');
  const withNote = createNote(withTag, { ...draft, tagIds: [...tagIds, tagId] },
    { id: noteId, time, expectedRevision: withTag.revision, provenance }, validate);
  withNote.revision = current.revision + 1;
  return validate(withNote);
}

export function normalizeTagName(name) {
  if (typeof name !== 'string' || name !== name.trim() || !name
    || [...name].length > 32) fail('VALIDATION_FAILED');
  return name.normalize('NFKC').trim().toLowerCase();
}

/** Host supplies validated current Snapshot, committed time, and product Schema. */
export function renameTag(current, { id, name, color, expectedRevision, expectedVersion, time }, validate) {
  assertRevision(current, expectedRevision);
  const tag = liveTag(current, id);
  if (!Number.isSafeInteger(expectedVersion) || tag.version !== expectedVersion) fail('VERSION_CONFLICT');
  assertTime(time);
  if (color !== undefined && !isTagColor(color)) fail('VALIDATION_FAILED');
  const display = typeof name === 'string' ? name.trim() : name;
  const key = normalizeTagName(display);
  if (Object.values(current.tags).some(other => other.id !== id && !other.deletedAt && other.normalizedKey === key))
    fail('NAME_CONFLICT');
  const next = structuredClone(current);
  next.tags[id] = { ...next.tags[id], name: display, normalizedKey: key,
    ...(color !== undefined && { color: normalizeTagColor(color) }), updatedAt: time, version: tag.version + 1 };
  return finish(current, next, validate);
}

/** Merge source into target, including trashed notes and default quick tags. */
export function mergeTags(current, { sourceId, targetId, expectedRevision, time }, validate) {
  assertRevision(current, expectedRevision);
  const source = liveTag(current, sourceId);
  const target = liveTag(current, targetId);
  if (sourceId === targetId) fail('VALIDATION_FAILED');
  assertTime(time);
  const next = structuredClone(current);
  for (const note of Object.values(next.notes)) {
    if (note.tagIds.includes(sourceId)) {
      note.tagIds = replace(note.tagIds, sourceId, targetId);
      note.version++;
      note.updatedAt = time;
    }
  }
  next.settings.quickTagIds = replace(next.settings.quickTagIds, sourceId, targetId);
  next.tags[sourceId] = { ...source, deletedAt: time, updatedAt: time, version: source.version + 1 };
  next.tags[targetId] = { ...target, updatedAt: time, version: target.version + 1 };
  return finish(current, next, validate);
}

/** Remove associations everywhere, including trashed notes, without deleting the Tag ID. */
export function deleteTag(current, { id, expectedRevision, time }, validate) {
  assertRevision(current, expectedRevision);
  const tag = liveTag(current, id);
  assertTime(time);
  const next = structuredClone(current);
  for (const note of Object.values(next.notes)) {
    if (note.tagIds.includes(id)) {
      note.tagIds = note.tagIds.filter(value => value !== id);
      note.version++;
      note.updatedAt = time;
    }
  }
  next.settings.quickTagIds = next.settings.quickTagIds.filter(value => value !== id);
  next.tags[id] = { ...tag, deletedAt: time, updatedAt: time, version: tag.version + 1 };
  return finish(current, next, validate);
}
