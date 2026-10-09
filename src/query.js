// Pure, read-only query over a validated NotebookSnapshot. This does not open
// storage or navigate to sessions; the caller supplies canonical workspace paths.
const own = (object, key) => Object.hasOwn(object, key);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const searchText = (note, tags) => [note.title, note.bodyMarkdown, note.quote?.content,
  note.source?.sessionTitle, note.source?.workspaceTitle, note.source?.workspacePath,
  ...(note.tagIds ?? []).map(id => own(tags, id) && !tags[id].deletedAt ? tags[id].name : '')]
  .filter(value => typeof value === 'string').join('\n').normalize('NFKC').toLocaleLowerCase('und');

/** Returns matching ids, page ids and selection visibility without mutating the snapshot. */
export function queryNotes(snapshot, filter = {}) {
  if (!snapshot || !snapshot.notes || !snapshot.tags || !filter || typeof filter !== 'object'
    || Array.isArray(filter) || Object.keys(filter).some(key => ![
      'scope', 'sessionId', 'workspacePath', 'kind', 'tagIds', 'tagMode', 'untagged', 'search',
      'includeDeleted', 'trashOnly', 'timeField', 'from', 'to', 'sort', 'sessionActivity', 'offset', 'limit', 'selectedIds'].includes(key)))
    throw new TypeError('INVALID_QUERY');
  const { scope = 'all', sessionId, workspacePath, kind, tagIds = [], tagMode = 'any',
    untagged = false, search = '', includeDeleted = false, trashOnly = false,
    timeField = 'updated', from, to, sort = 'updated', sessionActivity,
    offset = 0, limit = 50, selectedIds = [] } = filter;
  // Timestamps are instants with an explicit offset; bounds are inclusive.
  // Date-only and local timestamps would silently depend on Host time zone.
  const timestamp = value => typeof value === 'string'
    && /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)
    && Number.isFinite(Date.parse(value))
    && Number(value.slice(8, 10)) <= new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)), 0)).getUTCDate();
  const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id)
    && !['__proto__', 'constructor', 'prototype'].includes(id);
  if (!['all', 'session', 'workspace', 'manual', 'archived', 'unavailable'].includes(scope)
    || !['highlight', 'note', 'manual', undefined].includes(kind)
    || !['any', 'all'].includes(tagMode) || !['updated', 'created', 'workspace', 'tag', 'session'].includes(sort)
    || !Array.isArray(tagIds) || tagIds.length > 100 || tagIds.some(id => !validId(id))
    || !Array.isArray(selectedIds) || selectedIds.length > 10000 || selectedIds.some(id => !validId(id))
    || typeof search !== 'string' || [...search].length > 1000
    || typeof untagged !== 'boolean' || typeof includeDeleted !== 'boolean'
    || typeof trashOnly !== 'boolean' || (trashOnly && includeDeleted)
    || !['updated', 'created'].includes(timeField)
    || (from !== undefined && !timestamp(from)) || (to !== undefined && !timestamp(to))
    || (from !== undefined && to !== undefined && Date.parse(from) > Date.parse(to))
    || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200
    || (scope === 'session' && (typeof sessionId !== 'string' || !sessionId || sessionId.length > 4096))
    || (scope === 'workspace' && (typeof workspacePath !== 'string' || !workspacePath || workspacePath.length > 4096))
    || (sessionId !== undefined && (typeof sessionId !== 'string' || !sessionId || sessionId.length > 4096))
    || (workspacePath !== undefined && (typeof workspacePath !== 'string' || !workspacePath || workspacePath.length > 4096)))
    throw new TypeError('INVALID_QUERY');
  // Activity is a transient display projection, not persisted source identity.
  // An explicit empty catalog differs from an unavailable catalog.
  if (sort === 'session' ? !Array.isArray(sessionActivity) || sessionActivity.length > 10000
    : sessionActivity !== undefined) throw new TypeError('INVALID_QUERY');
  const activity = new Map();
  for (const entry of sessionActivity ?? []) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || Object.keys(entry).length !== 2 || typeof entry.sessionId !== 'string'
      || !entry.sessionId || entry.sessionId.length > 4096
      || !Number.isSafeInteger(entry.updatedAt) || entry.updatedAt < 0
      || activity.has(entry.sessionId)) throw new TypeError('INVALID_QUERY');
    activity.set(entry.sessionId, entry.updatedAt);
  }
  const query = search.normalize('NFKC').trim().toLocaleLowerCase('und');
  const notes = Object.values(snapshot.notes);
  const matches = notes.filter(note => {
    if (trashOnly ? !note.deletedAt : !includeDeleted && !!note.deletedAt) return false;
    const selectedTime = Date.parse(timeField === 'created' ? note.createdAt : note.updatedAt);
    if ((from !== undefined && selectedTime < Date.parse(from))
      || (to !== undefined && selectedTime > Date.parse(to))) return false;
    if (kind && note.kind !== kind) return false;
    const source = note.source;
    // Supplied source constraints always combine with the selected scope and
    // other filters; they are never silently ignored outside their matching scope.
    if (sessionId !== undefined && source?.sessionId !== sessionId) return false;
    if (workspacePath !== undefined && source?.workspacePath !== workspacePath) return false;
    // "manual" means no session source; use `kind: 'manual'` for manual kind.
    if (scope === 'manual' && source?.sessionId) return false;
    if (scope === 'archived' && source?.sessionState !== 'archived') return false;
    if (scope === 'unavailable' && !['unavailable', 'deleted', 'unknown'].includes(source?.sessionState)) return false;
    if (untagged && note.tagIds.length) return false;
    if (tagIds.length && !(tagMode === 'all'
      ? tagIds.every(id => note.tagIds.includes(id)) : tagIds.some(id => note.tagIds.includes(id)))) return false;
    return !query || searchText(note, snapshot.tags).includes(query);
  });
  // Compute each key once rather than normalizing tag names and parsing dates
  // repeatedly inside the sort comparator (which is called O(n log n) times).
  const ordered = matches.map(note => ({ note,
    time: Date.parse(note.updatedAt),
    key: sort === 'workspace' ? note.source?.workspacePath ?? ''
      : sort === 'tag' ? note.tagIds.map(id => snapshot.tags[id]?.name.normalize('NFKC').toLowerCase() ?? '')
        .sort(compare)[0] ?? '' : '',
    created: sort === 'created' ? Date.parse(note.createdAt) : 0,
    sessionTime: sort === 'session' ? activity.get(note.source?.sessionId) : undefined,
  }));
  // The placement of notes without activity is still a product decision.
  // Do not silently invent an order while that decision remains pending.
  if (sort === 'session' && ordered.some(entry => entry.sessionTime === undefined))
    throw Object.assign(new TypeError('SESSION_ACTIVITY_UNAVAILABLE'), { code: 'SESSION_ACTIVITY_UNAVAILABLE' });
  ordered.sort((a, b) => {
    if (sort === 'created') return compare(b.created, a.created) || compare(a.note.id, b.note.id);
    if (sort === 'updated') return compare(b.time, a.time) || compare(a.note.id, b.note.id);
    if (sort === 'session') return compare(b.sessionTime, a.sessionTime)
      || compare(a.note.source.sessionId, b.note.source.sessionId)
      || compare(b.time, a.time) || compare(a.note.id, b.note.id);
    return compare(a.key, b.key) || compare(b.time, a.time) || compare(a.note.id, b.note.id);
  });
  const ids = ordered.map(entry => entry.note.id);
  const visible = new Set(ids);
  const selected = [...new Set(selectedIds)];
  return {
    ids, pageIds: ids.slice(offset, offset + limit), total: ids.length,
    selectedVisibleIds: selected.filter(id => visible.has(id)),
    hiddenSelectedCount: selected.filter(id => !visible.has(id)).length,
  };
}
