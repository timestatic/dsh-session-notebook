import test from 'node:test';
import assert from 'node:assert/strict';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { backupJson, inspectBackupJson, previewBackupReplacement } from '../../src/json-backup.js';
import { prepareBackupReplacement } from '../../src/restore-candidate.js';

const expected = (snapshot, options) => {
  const backup = backupJson(snapshot, options);
  return inspectBackupJson(backup.content, { declaredBytes: backup.bytes, ...options });
};

test('backup includes trashed records, raw quote, anchor, source and complete settings', () => {
  const snapshot = notebookFixture();
  snapshot.notes.n1.deletedAt = '2026-10-05T00:00:00.000Z';
  snapshot.notes.n1.quote.content = '中文😀\r\n\n`重要`';
  const before = structuredClone(snapshot);
  const result = expected(snapshot);
  assert.deepEqual(result.snapshot, snapshot);
  assert.deepEqual(result.summary, { backupVersion: 1, schemaVersion: 1, revision: 0,
    noteCount: 1, trashedCount: 1, tagCount: 1 });
  assert.deepEqual(snapshot, before);
});

test('replacement preview counts overlap, trash and settings replacement without changing either library', () => {
  const existing = notebookFixture(); existing.revision = 8;
  existing.notes.n2 = { ...existing.notes.n1, id: 'n2', deletedAt: '2026-10-05T00:00:00.000Z' };
  const incoming = notebookFixture();
  incoming.notes.n3 = { ...incoming.notes.n1, id: 'n3' };
  incoming.settings.quickTagIds = [];
  const before = structuredClone(existing), inputBefore = structuredClone(incoming);
  const preview = previewBackupReplacement(existing, expected(incoming));
  assert.equal(preview.mode, 'replace-whole-library');
  assert.deepEqual(preview.current, { epoch: 'test-epoch', revision: 8, notes: 2, trashed: 1, tags: 1 });
  assert.deepEqual(preview.backup, { backupVersion: 1, schemaVersion: 1,
    notes: 2, trashed: 0, tags: 1 });
  assert.deepEqual(preview.impact, { notesRemoved: 1, notesReplaced: 1, notesAdded: 1,
    tagsRemoved: 0, tagsReplaced: 1, tagsAdded: 0 });
  assert.deepEqual(existing, before); assert.deepEqual(incoming, inputBefore);
  assert.throws(() => previewBackupReplacement(existing, { ...expected(incoming),
    snapshot: { ...incoming, schemaVersion: 2 } }),
    { code: 'VALIDATION_FAILED' });
});

test('bytes and actual UTF-8 size must fit before parsing an untrusted backup', () => {
  const snapshot = notebookFixture();
  const backup = backupJson(snapshot);
  assert.ok(backup.bytes > backup.content.length, 'emoji must count UTF-8 bytes');
  assert.throws(() => backupJson(snapshot, { maxBytes: backup.bytes - 1 }), { code: 'BACKUP_TOO_LARGE' });
  assert.throws(() => inspectBackupJson(backup.content, { declaredBytes: backup.bytes - 1 }), { code: 'BACKUP_TOO_LARGE' });
  assert.throws(() => inspectBackupJson(backup.content, { declaredBytes: backup.bytes, maxBytes: backup.bytes - 1 }),
    { code: 'BACKUP_TOO_LARGE' });
});

test('replacement candidate keeps imported business data and starts a new write generation', () => {
  const current = notebookFixture(); current.revision = 7;
  const imported = notebookFixture(); imported.epoch = 'backup-epoch'; imported.revision = 31;
  imported.notes.n1.deletedAt = '2026-10-05T00:00:00.000Z';
  imported.operationReceipts.old = { payloadHash: 'a'.repeat(64), committedRevision: 31 };
  const before = structuredClone(imported);
  const checked = expected(imported);
  const next = prepareBackupReplacement(current, checked, { newEpoch: 'restored-epoch' });
  assert.equal(next.epoch, 'restored-epoch');
  assert.equal(next.revision, 8);
  assert.deepEqual(next.operationReceipts, {});
  assert.deepEqual(next.notes, imported.notes);
  assert.deepEqual(next.tags, imported.tags);
  assert.deepEqual(next.settings, imported.settings);
  assert.deepEqual(imported, before);
  assert.equal(current.revision, 7);
  assert.throws(() => prepareBackupReplacement(current, checked, { newEpoch: current.epoch }),
    { code: 'VALIDATION_FAILED' });
  assert.throws(() => prepareBackupReplacement(current, checked, { newEpoch: imported.epoch }),
    { code: 'VALIDATION_FAILED' });
  assert.throws(() => prepareBackupReplacement(current, checked, { newEpoch: 'invalid epoch' }),
    { code: 'VALIDATION_FAILED' });
});

test('invalid envelope and corrupt associations are rejected without modifying source', () => {
  const snapshot = notebookFixture();
  const backup = backupJson(snapshot);
  for (const content of ['{', '{}', JSON.stringify({ format: 'other', backupVersion: 1, snapshot }),
    JSON.stringify({ format: 'dsh-session-notebook-backup', backupVersion: 99, snapshot }),
    JSON.stringify({ format: 'dsh-session-notebook-backup', backupVersion: 1,
      snapshot: { ...snapshot, notes: { n1: { ...snapshot.notes.n1, tagIds: ['missing'] } } } })]) {
    assert.throws(() => inspectBackupJson(content, { declaredBytes: Buffer.byteLength(content) }));
  }
  assert.deepEqual(backupJson(snapshot).content, backup.content);
});
