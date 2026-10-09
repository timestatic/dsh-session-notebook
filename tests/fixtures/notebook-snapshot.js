// Test-only v1 product-shaped baseline from PRD §9 and guide §5.
// Operational limits below are fixture ceilings, NOT approved product quotas.
const bad = () => { throw Object.assign(new Error('INVALID_SNAPSHOT'), { code: 'VALIDATION_FAILED' }); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function keys(value, allowed, required = []) {
  if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) bad();
}
function text(value, maximum = 100000) { if (typeof value !== 'string' || [...value].length > maximum) bad(); }
function id(value) { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) bad(); }
function integer(value, minimum = 0) { if (!Number.isSafeInteger(value) || value < minimum) bad(); }
function date(value) { if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) bad(); }
function arrayIds(value, maximum) {
  if (!Array.isArray(value) || value.length > maximum || new Set(value).size !== value.length) bad();
  value.forEach(id);
}
export const notebookSchema = {
  safeParse(value) { try { return { success: true, data: this.parse(value) }; } catch { return { success: false }; } },
  parse(value) {
    // Normalize cross-realm JSON objects before prototype checks; never relax keys.
    value = structuredClone(value);
    keys(value, ['schemaVersion', 'epoch', 'revision', 'notes', 'tags', 'settings', 'operationReceipts'], ['schemaVersion', 'epoch', 'revision', 'notes', 'tags', 'settings', 'operationReceipts']);
    if (value.schemaVersion !== 1) bad(); id(value.epoch); integer(value.revision);
    keys(value.settings, ['quickTagIds', 'maxQuoteLength'], ['quickTagIds', 'maxQuoteLength']);
    integer(value.settings.maxQuoteLength, 2);
    arrayIds(value.settings.quickTagIds, 100);
    if (!plain(value.tags) || !plain(value.notes) || !plain(value.operationReceipts)) bad();
    const names = new Set();
    for (const [key, tag] of Object.entries(value.tags)) {
      id(key); keys(tag, ['id', 'schemaVersion', 'name', 'normalizedKey', 'color', 'isBuiltin', 'createdAt', 'updatedAt', 'deletedAt', 'version'], ['id', 'schemaVersion', 'name', 'normalizedKey', 'createdAt', 'updatedAt', 'version']);
      if (tag.id !== key || tag.schemaVersion !== 1) bad();
      text(tag.name, 32); if (!tag.name.trim() || tag.name !== tag.name.trim()) bad();
      const normalized = tag.name.normalize('NFKC').trim().toLowerCase();
      if (tag.normalizedKey !== normalized || (!tag.deletedAt && names.has(normalized))) bad();
      if (!tag.deletedAt) names.add(normalized);
      if (tag.isBuiltin !== undefined && typeof tag.isBuiltin !== 'boolean') bad();
      if (tag.color !== undefined) text(tag.color, 64);
      date(tag.createdAt); date(tag.updatedAt); if (tag.deletedAt) date(tag.deletedAt); integer(tag.version, 1);
    }
    const liveTag = key => { if (!Object.hasOwn(value.tags, key) || value.tags[key].deletedAt) bad(); };
    value.settings.quickTagIds.forEach(liveTag);
    for (const [key, note] of Object.entries(value.notes)) {
      id(key); keys(note, ['id', 'schemaVersion', 'kind', 'title', 'bodyMarkdown', 'quote', 'anchor', 'source', 'tagIds', 'createdBy', 'createdAt', 'updatedAt', 'deletedAt', 'version'], ['id', 'schemaVersion', 'kind', 'tagIds', 'createdBy', 'createdAt', 'updatedAt', 'version']);
      if (note.id !== key || note.schemaVersion !== 1 || !['highlight', 'note', 'manual'].includes(note.kind) || !['user', 'agent'].includes(note.createdBy)) bad();
      if (note.title !== undefined) text(note.title, 1000);
      if (note.bodyMarkdown !== undefined) text(note.bodyMarkdown);
      const hasBody = typeof note.bodyMarkdown === 'string' && !!note.bodyMarkdown.trim();
      if (note.kind === 'highlight' && note.bodyMarkdown !== undefined && note.bodyMarkdown !== '') bad();
      if (note.kind !== 'highlight' && !hasBody) bad();
      if (note.quote !== undefined) {
        keys(note.quote, ['format', 'content'], ['format', 'content']);
        if (!['plain_text', 'markdown'].includes(note.quote.format)) bad();
        text(note.quote.content, value.settings.maxQuoteLength); if (!note.quote.content.trim()) bad();
      } else if (note.kind !== 'manual') bad();
      if (note.anchor !== undefined) {
        if (!note.quote) bad();
        keys(note.anchor, ['exact', 'prefix', 'suffix', 'startOffset', 'endOffset', 'occurrence', 'markdownStartOffset', 'markdownEndOffset'], ['exact']);
        text(note.anchor.exact, value.settings.maxQuoteLength); if (!note.anchor.exact.trim()) bad();
        for (const field of ['prefix', 'suffix']) if (note.anchor[field] !== undefined) text(note.anchor[field], 1000);
        for (const pair of [['startOffset', 'endOffset'], ['markdownStartOffset', 'markdownEndOffset']]) {
          const [a, b] = pair;
          if ((note.anchor[a] === undefined) !== (note.anchor[b] === undefined)) bad();
          if (note.anchor[a] !== undefined) { integer(note.anchor[a]); integer(note.anchor[b]); if (note.anchor[b] < note.anchor[a]) bad(); }
        }
        if (note.anchor.occurrence !== undefined) integer(note.anchor.occurrence);
      }
      if (note.source !== undefined) {
        keys(note.source, ['sessionId', 'sessionTitle', 'messageId', 'messageRole', 'workspacePath', 'workspaceTitle', 'sessionState']);
        for (const field of ['sessionId', 'sessionTitle', 'messageId', 'workspacePath', 'workspaceTitle']) if (note.source[field] !== undefined) text(note.source[field], 4096);
        if (note.source.messageRole !== undefined && !['user', 'assistant', 'tool', 'system'].includes(note.source.messageRole)) bad();
        if (note.source.sessionState !== undefined && !['active', 'archived', 'deleted', 'unavailable', 'unknown'].includes(note.source.sessionState)) bad();
      }
      arrayIds(note.tagIds, 10); note.tagIds.forEach(liveTag);
      date(note.createdAt); date(note.updatedAt); if (note.deletedAt) date(note.deletedAt); integer(note.version, 1);
    }
    if (Object.keys(value.operationReceipts).length > 1000) bad();
    for (const [key, receipt] of Object.entries(value.operationReceipts)) {
      id(key); keys(receipt, ['payloadHash', 'resultNoteId', 'committedRevision'], ['payloadHash', 'committedRevision']);
      if (!/^[a-f0-9]{64}$/.test(receipt.payloadHash)) bad();
      integer(receipt.committedRevision); if (receipt.committedRevision > value.revision) bad();
      if (receipt.resultNoteId !== undefined) id(receipt.resultNoteId); // Receipt may outlive permanent deletion.
    }
    return structuredClone(value);
  },
};
export function notebookFixture() {
  const timestamp = '2026-10-04T00:00:00.000Z';
  return { schemaVersion: 1, epoch: 'test-epoch', revision: 0,
    notes: { n1: { id: 'n1', schemaVersion: 1, kind: 'note', bodyMarkdown: '**评论**\r\n```js\n  x();\n```',
      quote: { format: 'plain_text', content: '引用😀\n组合e\u0301' }, anchor: { exact: '引用😀\n组合e\u0301', startOffset: 0, endOffset: 9 },
      source: { sessionId: 'synthetic', messageId: 'm1', messageRole: 'assistant', sessionState: 'active' },
      tagIds: ['t1'], createdBy: 'user', createdAt: timestamp, updatedAt: timestamp, version: 1 } },
    tags: { t1: { id: 't1', schemaVersion: 1, name: 'TODO', normalizedKey: 'todo', isBuiltin: true, createdAt: timestamp, updatedAt: timestamp, version: 1 } },
    settings: { quickTagIds: ['t1'], maxQuoteLength: 8000 }, operationReceipts: {} };
}
