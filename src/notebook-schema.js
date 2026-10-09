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

export const notebookSchema = {
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
