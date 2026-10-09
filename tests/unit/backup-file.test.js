import test from 'node:test';
import assert from 'node:assert/strict';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { backupJson, inspectBackupJson } from '../../src/json-backup.js';
import { readBackupFile, backupFile, downloadBackupFile } from '../../src/client/backup-file.js';

test('complete backup becomes exact UTF-8 file without changing the source', async () => {
  const snapshot = notebookFixture();
  snapshot.notes.n1.deletedAt = '2026-10-06T00:00:00Z';
  const before = structuredClone(snapshot);
  const source = backupJson(snapshot);
  const file = backupFile(source, { date: new Date(2026, 9, 7, 15, 5, 9) });
  assert.equal(file.filename, 'dsh-session-notebook-rev-0-20261007150509.json');
  assert.equal(file.blob.type, 'application/json;charset=utf-8');
  assert.equal(file.bytes, source.bytes);
  assert.equal(await file.blob.text(), source.content);
  const inspected = inspectBackupJson(await file.blob.text(), { declaredBytes: file.bytes });
  assert.deepEqual(inspected.snapshot, before);
  assert.equal(inspected.summary.trashedCount, 1);
  assert.deepEqual(snapshot, before);
});

test('mismatched revision, byte size, invalid payload and over-limit backup never create a file', () => {
  const source = backupJson(notebookFixture());
  for (const corrupted of [{ ...source, revision: 1 }, { ...source, bytes: source.bytes - 1 },
    { ...source, content: '{}' }, { ...source, content: source.content + 'x' }, null]) {
    assert.throws(() => backupFile(corrupted), error => ['INVALID_BACKUP', 'BACKUP_TOO_LARGE',
      'UNSUPPORTED_BACKUP'].includes(error.code), 'bad payload is rejected');
  }
  assert.throws(() => backupFile(source, { maxBytes: source.bytes - 1 }), { code: 'BACKUP_TOO_LARGE' });
});

test('local backup reader checks file size before reading and validates the complete snapshot', async () => {
  const source = backupJson(notebookFixture());
  let reads = 0;
  class ObservedBlob extends Blob {
    async text() { reads++; return super.text(); }
  }
  const file = new ObservedBlob([source.content], { type: 'application/json' });
  await assert.rejects(readBackupFile(file, { maxBytes: source.bytes - 1 }), { code: 'BACKUP_TOO_LARGE' });
  assert.equal(reads, 0);
  const inspected = await readBackupFile(file, { maxBytes: source.bytes });
  assert.equal(reads, 1);
  assert.equal(inspected.snapshot.revision, source.revision);
  const corrupt = new ObservedBlob(['{bad'], { type: 'application/json' });
  await assert.rejects(readBackupFile(corrupt), { code: 'INVALID_BACKUP' });
});

test('cancelled backup read cannot publish an inspected result', async () => {
  const source = backupJson(notebookFixture());
  let release;
  class DelayedBlob extends Blob {
    async text() { await new Promise(resolve => { release = resolve; }); return super.text(); }
  }
  const file = new DelayedBlob([source.content]);
  const abort = new AbortController();
  const reading = readBackupFile(file, { signal: abort.signal });
  abort.abort(); release();
  await assert.rejects(reading, { code: 'CANCELLED' });
});

test('cancellation settles even when file reading never responds', { timeout: 1000 }, async () => {
  const source = backupJson(notebookFixture());
  class StuckBlob extends Blob {
    text() { return new Promise(() => {}); }
  }
  const file = new StuckBlob([source.content]);
  const abort = new AbortController();
  const reading = readBackupFile(file, { signal: abort.signal });
  abort.abort();
  await assert.rejects(reading, { code: 'CANCELLED' });
});

test('download creates only a temporary Blob URL and always revokes it', () => {
  const file = backupFile(backupJson(notebookFixture()));
  const anchor = { click() { assert.equal(this.download, file.filename); assert.equal(this.href, 'blob:test'); } };
  const events = [];
  const browser = { document: { createElement(tag) { assert.equal(tag, 'a'); return anchor; } },
    URL: { createObjectURL(blob) { assert.equal(blob, file.blob); events.push('created'); return 'blob:test'; },
      revokeObjectURL(href) { assert.equal(href, 'blob:test'); events.push('revoked'); } } };
  downloadBackupFile(file, browser);
  assert.deepEqual(events, ['created', 'revoked']);
  anchor.click = () => { throw Error('click failed'); };
  assert.throws(() => downloadBackupFile(file, browser), /click failed/);
  assert.deepEqual(events, ['created', 'revoked', 'created', 'revoked']);
  assert.throws(() => downloadBackupFile({ ...file, filename: '../escape.json' }, browser), { code: 'INVALID_BACKUP' });
  assert.throws(() => downloadBackupFile({ ...file, bytes: file.bytes - 1 }, browser), { code: 'INVALID_BACKUP' });
});
