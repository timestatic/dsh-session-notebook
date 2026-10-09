import test from 'node:test';
import assert from 'node:assert/strict';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { notebookSchema } from '../../src/notebook-schema.js';
import { createTag, createTaggedNote, renameTag, mergeTags, deleteTag,
  normalizeTagName, tagUsage, previewTagChange } from '../../src/tag-domain.js';
import { TAG_COLORS, resolvedTagColor } from '../../src/tag-colors.js';

const time = '2026-10-05T00:00:00.000Z';
function fixture() {
  const current = notebookFixture();
  current.tags.t2 = { ...current.tags.t1, id: 't2', name: '重要', normalizedKey: '重要' };
  current.notes.n2 = { ...current.notes.n1, id: 'n2', tagIds: ['t1', 't2'], deletedAt: time };
  current.settings.quickTagIds = ['t1', 't2'];
  return current;
}
const validate = candidate => notebookSchema.parse(candidate);

test('tag list counts only active notes; impact preview includes trash and shortcut references', () => {
  const original = fixture(), before = structuredClone(original);
  assert.deepEqual(tagUsage(original, 't1'), { active: 1, trashed: 1 });
  assert.deepEqual(tagUsage(original, 't2'), { active: 0, trashed: 1 });
  const preview = previewTagChange(original, { action: 'merge', sourceId: 't1', targetId: 't2' });
  assert.deepEqual(preview, { action: 'merge', epoch: 'test-epoch', revision: 0,
    sourceId: 't1', sourceVersion: 1, targetId: 't2', targetVersion: 1,
    activeAffected: 1, trashedAffected: 1, quickTagAffected: true });
  const deleting = previewTagChange(original, { action: 'delete', sourceId: 't2' });
  assert.throws(() => previewTagChange(original,
    { action: 'delete', sourceId: 't2', targetId: 't1' }), { code: 'VALIDATION_FAILED' });
  assert.equal(deleting.trashedAffected, 1);
  assert.equal(deleting.activeAffected, 0);
  assert.throws(() => previewTagChange(original, { action: 'merge', sourceId: 't1', targetId: 't1' }),
    { code: 'VALIDATION_FAILED' });
  assert.deepEqual(original, before);
});

test('createTag trims display name, rejects normalized duplicates and never reuses tombstones', () => {
  const original = fixture(), before = structuredClone(original);
  const next = createTag(original, { id: 't3', name: '  ＡＢＣ  ', time, expectedRevision: 0 }, validate);
  assert.deepEqual([next.tags.t3.name, next.tags.t3.normalizedKey, next.revision], ['ＡＢＣ', 'abc', 1]);
  assert.equal(next.tags.t3.color, TAG_COLORS[0]);
  const another = createTag(next, { id: 't4', name: '另一个标签', time,
    expectedRevision: next.revision }, validate);
  assert.notEqual(another.tags.t4.color, next.tags.t3.color);
  const chosen = createTag(original, { id: 't3', name: '彩色', color: TAG_COLORS[4], time,
    expectedRevision: 0 }, validate);
  assert.equal(chosen.tags.t3.color, TAG_COLORS[4]);
  assert.throws(() => createTag(original, { id: 't3', name: '非法颜色', color: 'red', time,
    expectedRevision: 0 }, validate), { code: 'VALIDATION_FAILED' });
  assert.throws(() => createTag(original, { id: 't3', name: ' todo ', time, expectedRevision: 0 }, validate),
    { code: 'NAME_CONFLICT' });
  assert.throws(() => createTag(original, { id: 't3', name: '   ', time, expectedRevision: 0 }, validate),
    { code: 'VALIDATION_FAILED' });
  original.tags.t3 = { ...next.tags.t3, deletedAt: time };
  assert.throws(() => createTag(original, { id: 't3', name: '新标签', time, expectedRevision: 0 }, validate),
    { code: 'VALIDATION_FAILED' });
  delete original.tags.t3;
  assert.deepEqual(original, before);
});

test('the previous eight colors display as their nearest current palette colors', () => {
  const old = ['#1d4ed8', '#7c3aed', '#15803d', '#b45309',
    '#be123c', '#0f766e', '#475569', '#be185d'];
  const expected = [TAG_COLORS[4], TAG_COLORS[5], TAG_COLORS[3], TAG_COLORS[1],
    TAG_COLORS[0], TAG_COLORS[3], TAG_COLORS[4], TAG_COLORS[0]];
  assert.deepEqual(old.map(color => resolvedTagColor(color, 'legacy')), expected);
  assert.equal(resolvedTagColor('#7b61ff', 'legacy'), TAG_COLORS[5]);
  assert.equal(resolvedTagColor('__proto__', 'legacy'), resolvedTagColor(undefined, 'legacy'));
});

test('new tag and highlight are a single validated revision candidate, not two visible commits', () => {
  const original = fixture(), before = structuredClone(original);
  const candidate = createTaggedNote(original, { kind: 'highlight', tagIds: ['t1'] }, {
    tagId: 't3', tagName: '补充', noteId: 'new1', time, expectedRevision: 0,
    provenance: { quote: original.notes.n1.quote, source: original.notes.n1.source },
  }, validate);
  assert.equal(candidate.revision, 1);
  assert.deepEqual(candidate.notes.new1.tagIds, ['t1', 't3']);
  assert.equal(candidate.tags.t3.name, '补充');
  assert.deepEqual(original, before);
  assert.throws(() => createTaggedNote(original, { kind: 'manual', bodyMarkdown: ' ' }, {
    tagId: 't3', tagName: '补充', noteId: 'new1', time, expectedRevision: 0,
  }, validate), { code: 'VALIDATION_FAILED' });
  assert.deepEqual(original, before);
});

test('normalized name rename changes only tag identity metadata and rejects collisions', () => {
  const current = fixture(), before = structuredClone(current);
  assert.equal(normalizeTagName('ＡＢＣ'), 'abc');
  const next = renameTag(current, { id: 't1', name: 'ＡＢＣ', time,
    expectedRevision: 0, expectedVersion: 1 }, validate);
  assert.equal(next.tags.t1.normalizedKey, 'abc');
  assert.deepEqual(next.notes, current.notes);
  assert.equal(next.revision, 1);
  const recolored = renameTag(current, { id: 't1', name: 'TODO', color: TAG_COLORS[2], time,
    expectedRevision: 0, expectedVersion: 1 }, validate);
  assert.equal(recolored.tags.t1.color, TAG_COLORS[2]);
  assert.deepEqual(recolored.notes, current.notes);
  assert.throws(() => renameTag(current, { id: 't1', name: 'TODO', color: 'url(javascript:bad)',
    time, expectedRevision: 0, expectedVersion: 1 }, validate), { code: 'VALIDATION_FAILED' });
  assert.deepEqual(current, before);
  assert.throws(() => renameTag(current, { id: 't1', name: '重要', time,
    expectedRevision: 0, expectedVersion: 1 }, validate), { code: 'NAME_CONFLICT' });
  const trimmed = renameTag(current, { id: 't1', name: '  ＡＢＣ  ', time,
    expectedRevision: 0, expectedVersion: 1 }, validate);
  assert.equal(trimmed.tags.t1.name, 'ＡＢＣ');
  assert.equal(trimmed.tags.t1.normalizedKey, 'abc');
  assert.throws(() => renameTag(current, { id: 't1', name: '  重要  ', time,
    expectedRevision: 0, expectedVersion: 1 }, validate), { code: 'NAME_CONFLICT' });
  assert.throws(() => renameTag(current, { id: 't1', name: '  ', time,
    expectedRevision: 0, expectedVersion: 1 }, validate), { code: 'VALIDATION_FAILED' });
});

test('merge rewrites live and trashed relations and default quick tags in one candidate', () => {
  const current = fixture(), before = structuredClone(current);
  const next = mergeTags(current, { sourceId: 't1', targetId: 't2', expectedRevision: 0, time }, validate);
  assert.equal(next.revision, 1);
  assert.deepEqual(next.notes.n1.tagIds, ['t2']);
  assert.deepEqual(next.notes.n2.tagIds, ['t2']);
  assert.equal(next.notes.n1.version, 2);
  assert.equal(next.notes.n2.version, 2);
  assert.deepEqual(next.settings.quickTagIds, ['t2']);
  assert.equal(next.tags.t1.deletedAt, time);
  assert.deepEqual(current, before);
  assert.throws(() => mergeTags(current, { sourceId: 't1', targetId: 't2',
    expectedRevision: 1, time }, validate), { code: 'VERSION_CONFLICT' });
});

test('delete unlinks trashed notes; invalid or failing validator never mutates old snapshot', () => {
  const current = fixture(), before = structuredClone(current);
  const next = deleteTag(current, { id: 't1', expectedRevision: 0, time }, validate);
  assert.deepEqual(next.notes.n1.tagIds, []);
  assert.deepEqual(next.notes.n2.tagIds, ['t2']);
  assert.deepEqual(next.settings.quickTagIds, ['t2']);
  assert.equal(next.tags.t1.deletedAt, time);
  assert.throws(() => deleteTag(current, { id: 't1', expectedRevision: 0, time }, () => { throw Error('FAIL'); }),
    { message: 'FAIL' });
  assert.throws(() => deleteTag(current, { id: '__proto__', expectedRevision: 0, time }, validate),
    { code: 'VALIDATION_FAILED' });
  assert.deepEqual(current, before);
});
