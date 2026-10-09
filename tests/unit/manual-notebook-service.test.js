import test from 'node:test';
import assert from 'node:assert/strict';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { manualNotebookService } from '../../src/manual-notebook-service.js';
import { backupJson, inspectBackupJson } from '../../src/json-backup.js';
import { TAG_COLORS, defaultTagColor } from '../../src/tag-colors.js';

const time = '2026-10-05T00:00:00.000Z';
const request = (requestId, expectedRevision = 0) => ({ requestId, epoch: 'test-epoch',
  expectedRevision, title: '标题', bodyMarkdown: '## 记录\n\n- [ ] 😀' });
function medium(initial = notebookFixture()) {
  let disk = structuredClone(initial);
  let writes = 0;
  let failAfterCommit = false;
  return { global: { get: () => structuredClone(disk), async set(value) {
    writes++;
    disk = structuredClone(value);
    if (failAfterCommit) throw new Error('secret physical path');
  } }, disk: () => structuredClone(disk), writes: () => writes,
  failAfterCommit: () => { failAfterCommit = true; } };
}
const service = domain => manualNotebookService({ domain, now: () => time });

test('tag colors use safe defaults and selected colors persist through list and backup', async () => {
  const domain = medium(); const owner = service(domain);
  try {
    assert.equal(owner.tagList().items[0].color, defaultTagColor('t1'));
    await assert.rejects(owner.tagCreate({ requestId: 'invalid_color', epoch: 'test-epoch',
      expectedRevision: 0, name: '非法', color: 'red' }), { code: 'VALIDATION_FAILED' });
    assert.equal(domain.writes(), 0);
    await owner.tagCreate({ requestId: 'colored_tag', epoch: 'test-epoch',
      expectedRevision: 0, name: '彩色', color: TAG_COLORS[0] });
    const created = owner.tagList().items.find(tag => tag.name === '彩色');
    assert.equal(created.color, TAG_COLORS[0]);
    await owner.tagRename({ requestId: 'recolor_tag', epoch: 'test-epoch',
      expectedRevision: 1, tagId: created.id, expectedVersion: 1,
      name: '彩色', color: TAG_COLORS[4] });
    assert.equal(owner.tagList().items.find(tag => tag.id === created.id).color, TAG_COLORS[4]);
    assert.equal(owner.library({}).tags.find(tag => tag.id === created.id).color, TAG_COLORS[4]);
    assert.equal(JSON.parse(owner.exportJson().content).snapshot.tags[created.id].color, TAG_COLORS[4]);
  } finally { await owner.close(); }
});

test('library Service accepts a display activity projection without storing it or changing provenance', async () => {
  const initial = notebookFixture();
  initial.notes.n2 = { ...structuredClone(initial.notes.n1), id: 'n2',
    source: { ...initial.notes.n1.source, sessionId: 'newer-session' } };
  const domain = medium(initial), owner = service(domain);
  assert.deepEqual(owner.library({ sort: 'session', sessionActivity: [
    { sessionId: 'synthetic', updatedAt: 100 }, { sessionId: 'newer-session', updatedAt: 200 },
  ] }).ids, ['n2', 'n1']);
  assert.throws(() => owner.library({ sort: 'session', sessionActivity: [] }),
    { code: 'SESSION_ACTIVITY_UNAVAILABLE' });
  assert.equal(domain.writes(), 0); assert.deepEqual(domain.disk(), initial);
  await owner.close();
});

test('restore preview measures replacement rather than upload bytes, preserves both libraries and never writes', async () => {
  const domain = medium();
  const owner = manualNotebookService({ domain, maxSnapshotBytes: 1000 });
  const imported = notebookFixture();
  imported.notes.n1.bodyMarkdown = '😀'.repeat(500);
  const backup = backupJson(imported);
  const begun = owner.backupBegin('actor', { uploadId: 'budget', bytes: backup.bytes });
  owner.backupChunk('actor', { token: begun.token, index: 0,
    base64: Buffer.from(backup.content).toString('base64') });
  owner.backupFinish('actor', { token: begun.token });
  const preview = owner.backupPreview('actor', { token: begun.token });
  assert.equal(preview.capacity.limitBytes, 1000);
  assert.equal(preview.capacity.fits, false);
  assert.ok(preview.capacity.estimatedBytes > 1000);
  assert.equal(domain.writes(), 0);
  assert.deepEqual(domain.disk(), notebookFixture());
  assert.equal(imported.notes.n1.bodyMarkdown, '😀'.repeat(500));
  await owner.close();
});

test('manual create, list, detail, edit, backup and reopen use one validated snapshot', async () => {
  const domain = medium();
  const first = service(domain);
  assert.equal(first.list().total, 0);
  const created = await first.create(request('new_manual'));
  assert.equal(created.revision, 1);
  assert.match(created.noteId, /^manual_[a-f0-9]{32}$/);
  assert.equal(first.list().items[0].id, created.noteId);
  assert.equal(first.get(created.noteId).note.bodyMarkdown, request('new_manual').bodyMarkdown);
  const update = { requestId: 'edit_manual', epoch: created.epoch, expectedRevision: 1,
    id: created.noteId, expectedVersion: 1, bodyMarkdown: '改动\n保留空白  ' };
  assert.equal((await first.update(update)).revision, 2);
  assert.equal(first.get(created.noteId).note.version, 2);
  assert.equal(first.get(created.noteId).note.bodyMarkdown, update.bodyMarkdown);
  const exported = first.exportJson();
  const backup = inspectBackupJson(exported.content, { declaredBytes: exported.bytes });
  assert.equal(backup.snapshot.notes[created.noteId].bodyMarkdown, update.bodyMarkdown);
  await first.close();
  const reopened = service(domain);
  assert.equal(reopened.list().total, 1);
  assert.equal(reopened.get(created.noteId).note.bodyMarkdown, update.bodyMarkdown);
  assert.equal((await reopened.create(request('new_manual'))).noteId, created.noteId);
  assert.equal((await reopened.update(update)).revision, 2);
  assert.equal(domain.writes(), 2);
  await reopened.close();
});

test('manual create saves multiple tags and update can clear them', async () => {
  const domain = medium(); const owner = service(domain);
  try {
    const tag = await owner.tagCreate({ requestId: 'second_tag', epoch: 'test-epoch',
      expectedRevision: 0, name: '重要' });
    const secondId = owner.tagList().items.find(item => item.name === '重要').id;
    const created = await owner.create({ ...request('tagged_manual', 1), tagIds: ['t1', secondId] });
    assert.deepEqual(owner.get(created.noteId).note.tagIds, ['t1', secondId]);
    await assert.rejects(owner.create({ ...request('invalid_tags', 2), tagIds: ['t1', 't1'] }),
      { code: 'VALIDATION_FAILED' });
    await owner.update({ requestId: 'clear_tags', epoch: tag.epoch, expectedRevision: 2,
      id: created.noteId, expectedVersion: 1, tagIds: [] });
    assert.deepEqual(owner.get(created.noteId).note.tagIds, []);
  } finally { await owner.close(); }
});

test('one Service queries the full library with paging, filters, and hidden selection counts', async () => {
  const domain = medium(); const owner = service(domain);
  try {
    const created = await owner.create(request('library_manual'));
    const all = owner.library({ selectedIds: ['n1', created.noteId, 'not_visible'], limit: 1 });
    assert.deepEqual(all.ids, [created.noteId, 'n1']);
    assert.deepEqual(all.pageIds, [created.noteId]);
    assert.equal(all.total, 2);
    assert.equal(all.items[0].kind, 'manual');
    assert.equal(all.items[0].source, null);
    assert.deepEqual(all.tags, [{ id: 't1', name: 'TODO', color: defaultTagColor('t1'), active: 1, trashed: 0 }]);
    assert.deepEqual(all.selectedVisibleIds, ['n1', created.noteId]);
    assert.equal(all.hiddenSelectedCount, 1);
    const session = owner.library({ scope: 'session', sessionId: 'synthetic', tagIds: ['t1'] });
    assert.deepEqual(session.ids, ['n1']);
    assert.equal(session.items[0].kind, 'note');
    assert.equal(session.items[0].quoteFormat, 'plain_text');
    assert.equal(session.items[0].quoteExcerpt, '引用😀\n组合e\u0301');
    assert.equal(session.items[0].source.messageId, 'm1');
    assert.deepEqual(owner.library({ search: '记录' }).ids, [created.noteId]);
    assert.deepEqual(owner.library({ untagged: true }).ids, [created.noteId]);
    assert.throws(() => owner.library({ unknown: true }), { code: 'VALIDATION_FAILED' });
    assert.throws(() => owner.library({ scope: 'session' }), { code: 'VALIDATION_FAILED' });
    assert.equal(domain.writes(), 1, 'queries never write to Domain');
  } finally { await owner.close(); }
});

test('generic note edit changes only user fields and replays one durable receipt', async () => {
  const domain = medium(); const owner = service(domain);
  try {
    const original = owner.noteGet('n1').note;
    const intent = { requestId: 'edit_quoted_note', epoch: 'test-epoch', expectedRevision: 0,
      id: 'n1', expectedVersion: 1, title: '新标题', bodyMarkdown: '修改后的正文 😀', tagIds: [] };
    const committed = await owner.noteEdit(intent);
    assert.deepEqual(committed, { epoch: 'test-epoch', revision: 1, noteId: 'n1' });
    const changed = owner.noteGet('n1').note;
    assert.equal(changed.title, intent.title);
    assert.equal(changed.bodyMarkdown, intent.bodyMarkdown);
    assert.deepEqual(changed.tagIds, []);
    assert.equal(changed.version, 2);
    for (const field of ['id', 'kind', 'quote', 'anchor', 'source', 'createdAt'])
      assert.deepEqual(changed[field], original[field]);
    assert.deepEqual(await owner.noteEdit(intent), committed);
    assert.equal(domain.writes(), 1);
    await assert.rejects(owner.noteEdit({ ...intent, requestId: 'stale', expectedRevision: 0 }),
      { code: 'VERSION_CONFLICT' });
    await assert.rejects(owner.noteEdit({ ...intent, requestId: 'forged', expectedRevision: 1,
      quote: { format: 'plain_text', content: 'forged' } }), { code: 'VALIDATION_FAILED' });
    assert.equal(domain.writes(), 1);
  } finally { await owner.close(); }
});

test('Markdown export reads complete notes at the selected revision without changing storage', async () => {
  const domain = medium(); const owner = service(domain);
  try {
    const result = owner.exportMarkdown({ epoch: 'test-epoch', expectedRevision: 0,
      ids: ['n1'] });
    assert.equal(result.count, 1);
    assert.equal(result.bytes, new TextEncoder().encode(result.content).byteLength);
    assert.match(result.content, /原始引用/);
    assert.match(result.content, /会话 ID：synthetic/);
    assert.equal(domain.writes(), 0);
    assert.throws(() => owner.exportMarkdown({ epoch: 'old', expectedRevision: 0,
      ids: ['n1'] }), { code: 'EPOCH_CONFLICT' });
    assert.throws(() => owner.exportMarkdown({ epoch: 'test-epoch', expectedRevision: 1,
      ids: ['n1'] }), { code: 'VERSION_CONFLICT' });
    assert.throws(() => owner.exportMarkdown({ epoch: 'test-epoch', expectedRevision: 0,
      ids: ['missing'] }), { code: 'VALIDATION_FAILED' });
  } finally { await owner.close(); }
});

test('tag create, rename, confirmed merge and confirmed delete share one durable revision queue', async () => {
  const domain = medium(); const owner = service(domain);
  try {
    assert.deepEqual(owner.tagList().items.map(tag => [tag.name, tag.active]), [['TODO', 1]]);
    const created = await owner.tagCreate({ requestId: 'tag_new', epoch: 'test-epoch',
      expectedRevision: 0, name: '  重要  ' });
    assert.equal(created.revision, 1);
    assert.equal((await owner.tagCreate({ requestId: 'tag_new', epoch: 'test-epoch',
      expectedRevision: 0, name: '  重要  ' })).revision, 1);
    const added = owner.tagList().items.find(tag => tag.name === '重要');
    assert.match(added.id, /^tag_[a-f0-9]{32}$/);
    assert.equal((await owner.tagRename({ requestId: 'tag_rename', epoch: 'test-epoch',
      expectedRevision: 1, tagId: added.id, expectedVersion: 1, name: '  待验证  ' })).revision, 2);
    assert.equal(owner.tagList().items.find(tag => tag.id === added.id).name, '待验证');
    const preview = owner.tagPreview({ action: 'merge', sourceId: 't1', targetId: added.id });
    assert.equal(preview.activeAffected, 1);
    const merge = { requestId: 'tag_merge', epoch: 'test-epoch', expectedRevision: 2,
      sourceId: 't1', targetId: added.id, preview };
    await assert.rejects(owner.tagMerge({ ...merge, preview: { ...preview, activeAffected: 0 } }),
      { code: 'CONFIRM_REQUIRED' });
    assert.equal(domain.writes(), 2);
    assert.equal((await owner.tagMerge(merge)).revision, 3);
    assert.deepEqual(domain.disk().notes.n1.tagIds, [added.id]);
    assert.deepEqual(domain.disk().settings.quickTagIds, [added.id]);
    const deleting = owner.tagPreview({ action: 'delete', sourceId: added.id });
    const remove = { requestId: 'tag_delete', epoch: 'test-epoch', expectedRevision: 3,
      sourceId: added.id, preview: deleting };
    await assert.rejects(owner.tagDelete({ ...remove, preview: { ...deleting, quickTagAffected: false } }),
      { code: 'CONFIRM_REQUIRED' });
    assert.equal((await owner.tagDelete(remove)).revision, 4);
    assert.deepEqual(domain.disk().notes.n1.tagIds, []);
    assert.deepEqual(owner.tagList().items, []);
    assert.equal((await owner.tagDelete(remove)).revision, 4, 'retry uses the durable receipt');
    assert.equal(domain.writes(), 4);
  } finally { await owner.close(); }
});

test('confirmed batch trash, restore and permanent delete use one receipt queue', async () => {
  const initial = notebookFixture();
  initial.notes.n2 = { ...structuredClone(initial.notes.n1), id: 'n2', title: '第二条' };
  const domain = medium(initial), owner = service(domain);
  try {
    const trash = owner.notePreview({ action: 'trash', ids: ['n2', 'n1'] });
    const remove = { requestId: 'trash_batch', epoch: trash.epoch, expectedRevision: trash.revision,
      action: 'trash', preview: trash, confirmed: true };
    await assert.rejects(owner.noteApply({ ...remove, confirmed: false }), { code: 'CONFIRM_REQUIRED' });
    await assert.rejects(owner.noteApply({ ...remove, preview: { ...trash, entries: [
      { ...trash.entries[0], title: '伪造标题' }, trash.entries[1]] } }), { code: 'CONFIRM_REQUIRED' });
    assert.equal(domain.writes(), 0);
    assert.equal((await owner.noteApply(remove)).revision, 1);
    assert.equal((await owner.noteApply(remove)).revision, 1);
    assert.equal(domain.writes(), 1);
    assert.deepEqual(owner.library({ trashOnly: true }).ids.sort(), ['n1', 'n2']);
    assert.equal(owner.noteGet('n1').note.deletedAt, '2026-10-05T00:00:00.000Z');
    assert.deepEqual(owner.noteGet('n1').note.quote, initial.notes.n1.quote);
    const restore = owner.notePreview({ action: 'restore', ids: ['n2'] });
    assert.equal((await owner.noteApply({ requestId: 'restore_one', epoch: restore.epoch,
      expectedRevision: restore.revision, action: 'restore', preview: restore, confirmed: true })).revision, 2);
    assert.deepEqual(owner.library({ trashOnly: true }).ids, ['n1']);
    const purge = owner.notePreview({ action: 'purge', ids: ['n1'] });
    await assert.rejects(owner.noteApply({ requestId: 'purge_bad', epoch: purge.epoch,
      expectedRevision: purge.revision, action: 'purge',
      preview: { ...purge, count: 2 }, confirmed: true }), { code: 'CONFIRM_REQUIRED' });
    assert.equal((await owner.noteApply({ requestId: 'purge_one', epoch: purge.epoch,
      expectedRevision: purge.revision, action: 'purge', preview: purge, confirmed: true })).revision, 3);
    assert.equal(domain.disk().notes.n1, undefined);
    assert.equal(owner.noteGet('n1'), null);
    assert.ok(domain.disk().notes.n2);
    assert.equal(domain.writes(), 3);
  } finally { await owner.close(); }
});

test('type conversion retains note identity and provenance and requires body removal confirmation', async () => {
  const domain = medium(), owner = service(domain);
  try {
    const original = owner.noteGet('n1');
    assert.equal(original.note.kind, 'note');
    assert.equal(owner.noteGet('missing'), null);
    await assert.rejects(owner.noteConvert({ requestId: 'same_kind', epoch: original.epoch,
      expectedRevision: 0, id: 'n1', expectedVersion: 1, kind: 'note', bodyMarkdown: 'x' }),
    { code: 'VALIDATION_FAILED' });
    const toManual = { requestId: 'to_manual', epoch: original.epoch,
      expectedRevision: 0, id: 'n1', expectedVersion: 1, kind: 'manual',
      bodyMarkdown: original.note.quote.content };
    assert.equal((await owner.noteConvert(toManual)).revision, 1);
    assert.equal((await owner.noteConvert(toManual)).revision, 1);
    const manual = owner.noteGet('n1').note;
    for (const field of ['id', 'quote', 'anchor', 'source', 'tagIds', 'createdAt'])
      assert.deepEqual(manual[field], original.note[field]);
    await assert.rejects(owner.noteConvert({ requestId: 'remove_without_confirm', epoch: original.epoch,
      expectedRevision: 1, id: 'n1', expectedVersion: 2, kind: 'highlight' }),
    { code: 'CONFIRM_REQUIRED' });
    assert.equal(domain.writes(), 1);
    assert.equal((await owner.noteConvert({ requestId: 'to_highlight', epoch: original.epoch,
      expectedRevision: 1, id: 'n1', expectedVersion: 2, kind: 'highlight',
      confirmRemoveBody: true })).revision, 2);
    assert.equal(owner.noteGet('n1').note.bodyMarkdown, undefined);
    await assert.rejects(owner.noteConvert({ requestId: 'empty_note', epoch: original.epoch,
      expectedRevision: 2, id: 'n1', expectedVersion: 3, kind: 'note', bodyMarkdown: '  ' }),
    { code: 'VALIDATION_FAILED' });
    assert.equal((await owner.noteConvert({ requestId: 'to_note', epoch: original.epoch,
      expectedRevision: 2, id: 'n1', expectedVersion: 3, kind: 'note',
      bodyMarkdown: '新正文' })).revision, 3);
    const restored = owner.noteGet('n1').note;
    assert.equal(restored.kind, 'note');
    assert.equal(restored.bodyMarkdown, '新正文');
    assert.deepEqual(restored.source, original.note.source);
  } finally { await owner.close(); }
});

test('stale edit, malformed draft and forged provenance never publish', async () => {
  const domain = medium();
  const first = service(domain);
  const saved = await first.create(request('valid'));
  await assert.rejects(first.create(request('stale')), { code: 'VERSION_CONFLICT' });
  await assert.rejects(first.create({ ...request('bad', 1), bodyMarkdown: '   ' }), { code: 'VALIDATION_FAILED' });
  let accessed = false;
  const hostile = request('getter', 1);
  Object.defineProperty(hostile, 'bodyMarkdown', { enumerable: true,
    get() { accessed = true; throw new Error('should not run'); } });
  await assert.rejects(first.create(hostile), { code: 'VALIDATION_FAILED' });
  assert.equal(accessed, false);
  await assert.rejects(first.create({ ...request('invalid', 1), requestId: { toString: () => 'x' } }),
    { code: 'VALIDATION_FAILED' });
  await assert.rejects(first.create({ ...request('forged', 1), source: { sessionId: 'fake' } }),
    { code: 'VALIDATION_FAILED' });
  await assert.rejects(first.update({ requestId: 'bad_edit', epoch: saved.epoch, expectedRevision: 1,
    id: saved.noteId, expectedVersion: 1, bodyMarkdown: '' }), { code: 'VALIDATION_FAILED' });
  await assert.rejects(first.update({ requestId: 'bad_source', epoch: saved.epoch, expectedRevision: 1,
    id: saved.noteId, expectedVersion: 1, source: { sessionId: 'fake' }, title: 'x' }),
    { code: 'VALIDATION_FAILED' });
  assert.equal(first.list().total, 1);
  assert.equal(domain.writes(), 1);
  await first.close();
});

test('two callers of one Host owner serialize intents and reject stale pages', async () => {
  const domain = medium();
  const owner = service(domain);
  const intent = request('same');
  const [a, b] = await Promise.allSettled([owner.create(intent), owner.create(intent)]);
  assert.equal(a.status, 'fulfilled');
  assert.equal(b.status, 'fulfilled');
  assert.equal(a.value.noteId, b.value.noteId);
  assert.equal(domain.writes(), 1);
  await assert.rejects(owner.create({ ...request('another'), title: 'stale' }),
    { code: 'VERSION_CONFLICT' });
  await owner.close();
});

test('unknown commit freezes the handle and retry after isolated reopen uses durable receipt', async () => {
  const domain = medium();
  const first = service(domain);
  const intent = request('lost_reply');
  domain.failAfterCommit();
  await assert.rejects(first.create(intent), { code: 'COMMIT_UNKNOWN' });
  await assert.rejects(first.create(intent), { code: 'COMMIT_UNKNOWN' });
  assert.throws(() => first.list(), { code: 'COMMIT_UNKNOWN' });
  await first.close();
  // Simulate a verified sole-writer reopen, not an automatic Host recovery path.
  const fresh = medium(domain.disk());
  const reopened = service(fresh);
  assert.equal((await reopened.create(intent)).revision, 1);
  assert.equal(fresh.writes(), 0);
  await reopened.close();
});

test('invalid or future snapshot refuses construction rather than creating an empty library', () => {
  const invalid = notebookFixture(); invalid.schemaVersion = 99;
  assert.throws(() => service(medium(invalid)), { code: 'VALIDATION_FAILED' });
  invalid.schemaVersion = 1; invalid.notes.n1.bodyMarkdown = '';
  assert.throws(() => service(medium(invalid)), { code: 'VALIDATION_FAILED' });
});
