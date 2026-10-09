import test from 'node:test';
import assert from 'node:assert/strict';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { notebookSchema } from '../../src/notebook-schema.js';
import { changeNotes, createNote, previewNoteChange, previewPermanentDelete,
  permanentlyDeleteNotes } from '../../src/note-domain.js';

const time = '2026-10-05T00:00:00.000Z';
const validate = snapshot => notebookSchema.parse(snapshot);
const request = (changes, expectedRevision = 0) => ({ changes, expectedRevision, time });
const change = (action, id = 'n1', extra = {}) => ({ id, action, expectedVersion: 1, ...extra });

test('create requires nonblank body except highlight, Host-owned fields and trusted provenance', () => {
  const original = notebookFixture(), before = structuredClone(original);
  const highlight = createNote(original, { kind: 'highlight', tagIds: ['t1'] },
    { id: 'new1', time, expectedRevision: 0, provenance: { quote: original.notes.n1.quote,
      anchor: original.notes.n1.anchor, source: original.notes.n1.source } }, validate);
  assert.deepEqual([highlight.notes.new1.version, highlight.notes.new1.createdBy, highlight.revision], [1, 'user', 1]);
  assert.deepEqual(highlight.notes.new1.quote, original.notes.n1.quote);
  const manual = createNote(original, { kind: 'manual', bodyMarkdown: '  中文😀  ' },
    { id: 'manual1', time, expectedRevision: 0 }, validate);
  assert.equal(manual.notes.manual1.bodyMarkdown, '  中文😀  ');
  assert.equal(manual.notes.manual1.quote, undefined);
  for (const draft of [{ kind: 'manual', bodyMarkdown: ' ' }, { kind: 'note', bodyMarkdown: '有正文' },
    { kind: 'manual', bodyMarkdown: '正文', createdBy: 'agent' },
    { kind: 'manual', bodyMarkdown: '正文', source: original.notes.n1.source }])
    assert.throws(() => createNote(original, draft,
      { id: 'new2', time, expectedRevision: 0 }, validate), { code: 'VALIDATION_FAILED' });
  assert.throws(() => createNote(original, { kind: 'manual', bodyMarkdown: '正文' },
    { id: 'n1', time, expectedRevision: 0 }, validate), { code: 'VALIDATION_FAILED' });
  assert.throws(() => createNote(original, { kind: 'manual', bodyMarkdown: '正文' },
    { id: 'new3', time, expectedRevision: 1 }, validate), { code: 'VERSION_CONFLICT' });
  assert.deepEqual(original, before);
});

test('oversized editable fields fail before candidate validation and leave input unchanged', () => {
  const original = notebookFixture(), before = structuredClone(original);
  let validations = 0;
  const countValidation = value => { validations++; return validate(value); };
  for (const draft of [
    { kind: 'manual', bodyMarkdown: '😀'.repeat(100001) },
    { kind: 'manual', bodyMarkdown: '正文', title: '字'.repeat(1001) },
  ]) assert.throws(() => createNote(original, draft,
    { id: 'new1', time, expectedRevision: 0 }, countValidation), { code: 'VALIDATION_FAILED' });
  for (const entry of [
    change('edit', 'n1', { bodyMarkdown: 'x'.repeat(100001) }),
    change('edit', 'n1', { title: '字'.repeat(1001) }),
    change('convert', 'n1', { kind: 'manual', bodyMarkdown: 'x'.repeat(100001) }),
  ]) assert.throws(() => changeNotes(original, request([entry]), countValidation), { code: 'VALIDATION_FAILED' });
  assert.equal(validations, 0);
  assert.deepEqual(original, before);
});

test('permanent deletion is only possible for explicitly confirmed matching trashed versions', () => {
  const current = notebookFixture();
  current.notes.n1.deletedAt = time;
  current.notes.n2 = { ...current.notes.n1, id: 'n2' };
  const before = structuredClone(current);
  const preview = previewPermanentDelete(current, ['n2', 'n1']);
  assert.deepEqual(preview.entries.map(entry => entry.id), ['n2', 'n1']);
  assert.equal(preview.count, 2);
  assert.throws(() => permanentlyDeleteNotes(current, preview, { confirmed: false }, validate),
    { code: 'CONFIRM_REQUIRED' });
  const changed = structuredClone(current); changed.notes.n2.version++;
  assert.throws(() => permanentlyDeleteNotes(changed, preview, { confirmed: true }, validate),
    { code: 'VERSION_CONFLICT' });
  assert.throws(() => permanentlyDeleteNotes(current, { ...preview, entries: [preview.entries[0]] },
    { confirmed: true }, validate), { code: 'VALIDATION_FAILED' });
  const next = permanentlyDeleteNotes(current, preview, { confirmed: true }, validate);
  assert.deepEqual(next.notes, {});
  assert.equal(next.revision, 1);
  assert.deepEqual(current, before);
  assert.throws(() => previewPermanentDelete(notebookFixture(), ['n1']), { code: 'VALIDATION_FAILED' });
});

test('note previews bind ordered IDs, versions, titles and trash state', () => {
  const current = notebookFixture();
  current.notes.n2 = { ...current.notes.n1, id: 'n2', title: '第二条' };
  const trash = previewNoteChange(current, 'trash', ['n2', 'n1']);
  assert.deepEqual(trash.entries.map(entry => entry.id), ['n2', 'n1']);
  assert.equal(trash.count, 2);
  assert.throws(() => previewNoteChange(current, 'restore', ['n1']), { code: 'VALIDATION_FAILED' });
  assert.throws(() => previewNoteChange(current, 'trash', ['n1', 'n1']), { code: 'VALIDATION_FAILED' });
  const trashed = changeNotes(current, request([change('trash', 'n2'), change('trash')]), validate);
  assert.equal(previewNoteChange(trashed, 'restore', ['n1']).entries[0].version, 2);
  assert.equal(previewNoteChange(trashed, 'purge', ['n2']).count, 1);
  assert.throws(() => previewNoteChange(trashed, 'trash', ['n1']), { code: 'VALIDATION_FAILED' });
});

test('editing preserves immutable Quote/Anchor/Source and caller snapshot', () => {
  const original = notebookFixture();
  const before = structuredClone(original);
  const next = changeNotes(original, request([change('edit', 'n1', {
    title: '我的标题', bodyMarkdown: '  新正文\n', tagIds: [],
  })]), validate);
  assert.equal(next.notes.n1.bodyMarkdown, '  新正文\n');
  for (const field of ['quote', 'anchor', 'source', 'createdAt', 'id'])
    assert.deepEqual(next.notes.n1[field], original.notes.n1[field]);
  assert.deepEqual([next.revision, next.notes.n1.version], [1, 2]);
  assert.deepEqual(original, before);
  assert.throws(() => changeNotes(original, request([change('edit', 'n1', { source: {} })]), validate),
    { code: 'VALIDATION_FAILED' });
});

test('explicit conversions retain source, ID and tag relations, body removal requires confirmation', () => {
  const original = notebookFixture();
  assert.throws(() => changeNotes(original, request([change('convert', 'n1', { kind: 'highlight' })]), validate),
    { code: 'CONFIRM_REQUIRED' });
  const highlight = changeNotes(original, request([change('convert', 'n1', { kind: 'highlight', confirmRemoveBody: true })]), validate);
  assert.equal(highlight.notes.n1.kind, 'highlight');
  assert.equal(highlight.notes.n1.bodyMarkdown, undefined);
  assert.deepEqual(highlight.notes.n1.quote, original.notes.n1.quote);
  const note = changeNotes(highlight, request([change('convert', 'n1', { expectedVersion: 2,
    kind: 'manual', bodyMarkdown: '用户自行改写' })], 1), validate);
  assert.equal(note.notes.n1.kind, 'manual');
  assert.deepEqual(note.notes.n1.source, original.notes.n1.source);
  assert.deepEqual(note.notes.n1.tagIds, original.notes.n1.tagIds);
  assert.equal(note.notes.n1.id, original.notes.n1.id);
});

test('batch trash and restore preflight versions all-or-nothing including highlights', () => {
  const original = notebookFixture();
  original.notes.n2 = { ...original.notes.n1, id: 'n2', kind: 'highlight' };
  delete original.notes.n2.bodyMarkdown;
  const before = structuredClone(original);
  assert.throws(() => changeNotes(original, request([change('trash'), change('trash', 'n2', { expectedVersion: 0 })]), validate),
    { code: 'VERSION_CONFLICT' });
  assert.deepEqual(original, before);
  const trashed = changeNotes(original, request([change('trash'), change('trash', 'n2')]), validate);
  assert.deepEqual([trashed.notes.n1.deletedAt, trashed.notes.n2.deletedAt], [time, time]);
  const restored = changeNotes(trashed, request([change('restore', 'n1', { expectedVersion: 2 }),
    change('restore', 'n2', { expectedVersion: 2 })], 1), validate);
  assert.equal(restored.notes.n2.deletedAt, undefined);
  assert.equal(restored.notes.n2.kind, 'highlight');
  assert.deepEqual(restored.notes.n2.source, original.notes.n2.source);
  assert.throws(() => changeNotes(original, request([change('trash'), change('trash')]), validate),
    { code: 'VALIDATION_FAILED' });
});

test('adding a body to a highlight uses one edit and keeps ID, quote, anchor and source', () => {
  const original = notebookFixture(); original.notes.n1.kind = 'highlight'; delete original.notes.n1.bodyMarkdown;
  const next = changeNotes(original, request([change('edit', 'n1', { bodyMarkdown: '我的补充笔记', tagIds: ['t1'] })]), validate);
  assert.equal(next.notes.n1.kind, 'note'); assert.equal(next.notes.n1.bodyMarkdown, '我的补充笔记');
  assert.equal(next.notes.n1.id, original.notes.n1.id); assert.equal(next.notes.n1.version, 2);
  for (const key of ['quote', 'anchor', 'source']) assert.deepEqual(next.notes.n1[key], original.notes.n1[key]);
  assert.equal(original.notes.n1.kind, 'highlight');
  assert.throws(() => changeNotes(original, request([change('edit', 'n1', { bodyMarkdown: ' ' })]), validate), { code: 'VALIDATION_FAILED' });
});
