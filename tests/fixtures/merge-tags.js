import { notebookSchema } from './notebook-snapshot.js';

// Test-only whole-candidate transformation, not a public mutation handler.
export function mergeTags(current, sourceId, targetId, expectedRevision) {
  notebookSchema.parse(current);
  if (current.revision !== expectedRevision) throw Object.assign(new Error('REVISION_CONFLICT'), { code: 'REVISION_CONFLICT' });
  if (sourceId === targetId || !Object.hasOwn(current.tags, sourceId) || !Object.hasOwn(current.tags, targetId)
    || current.tags[sourceId].deletedAt || current.tags[targetId].deletedAt) throw new Error('INVALID_MERGE');
  const next = structuredClone(current);
  const replace = ids => [...new Set(ids.map(id => id === sourceId ? targetId : id))];
  for (const note of Object.values(next.notes)) {
    if (note.tagIds.includes(sourceId)) { note.tagIds = replace(note.tagIds); note.version++; }
  }
  next.settings.quickTagIds = replace(next.settings.quickTagIds);
  delete next.tags[sourceId];
  next.tags[targetId].version++;
  next.revision++;
  notebookSchema.parse(next);
  return next;
}
