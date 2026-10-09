import test from 'node:test';
import assert from 'node:assert/strict';
import { backupJson, previewBackupReplacement } from '../../src/json-backup.js';
import { stageBackupFile } from '../../src/client/restore-transfer.js';
import { restoreUpload } from '../../src/restore-upload.js';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';

const actor = 'desktop-operator';
function api(upload, current = notebookFixture()) {
  return {
    backupBegin: request => upload.begin({ actor, ...request }),
    backupChunk: request => upload.append({ actor, ...request }),
    backupFinish: request => upload.finish({ actor, ...request }),
    backupPreview: request => ({ token: request.token,
      ...previewBackupReplacement(current, upload.candidate({ actor, ...request })) }),
  };
}

test('Client sends a valid large backup in bounded chunks and uses Host preview', async () => {
  const imported = notebookFixture();
  imported.notes.n1.bodyMarkdown = '😀'.repeat(40000);
  const source = backupJson(imported);
  assert.ok(source.bytes > 128 * 1024);
  const file = new Blob([source.content], { type: 'application/json' });
  const upload = restoreUpload();
  const calls = [];
  const host = api(upload);
  const wrapped = { ...host, backupChunk(request) {
    calls.push({ index: request.index, bytes: Buffer.from(request.base64, 'base64').length });
    return host.backupChunk(request);
  } };
  let token;
  const result = await stageBackupFile(file, wrapped, { uploadId: 'large_import',
    signal: new AbortController().signal, onToken: value => { token = value; } });
  assert.equal(result.token, token);
  assert.equal(result.summary.noteCount, 1);
  assert.equal(result.preview.current.revision, 0);
  assert.ok(calls.length >= 2);
  assert.ok(calls.every(call => call.bytes > 0 && call.bytes <= 128 * 1024));
  assert.deepEqual(upload.candidate({ actor, token }).snapshot, imported);
  upload.close();
});

test('lost chunk reply resumes with the same upload ID and does not resend accepted chunks', async () => {
  const imported = notebookFixture(); imported.notes.n1.bodyMarkdown = '汉'.repeat(60000);
  const source = backupJson(imported);
  const file = new Blob([source.content]);
  const upload = restoreUpload();
  const host = api(upload);
  let lose = true;
  const attempts = [];
  const wrapped = { ...host, backupChunk(request) {
    attempts.push(request.index);
    const receipt = host.backupChunk(request);
    if (lose) { lose = false; throw Object.assign(new Error('TIMEOUT'), { code: 'TIMEOUT' }); }
    return receipt;
  } };
  const args = { uploadId: 'stable_import', signal: new AbortController().signal };
  await assert.rejects(stageBackupFile(file, wrapped, args), { code: 'TIMEOUT' });
  const completed = await stageBackupFile(file, wrapped, args);
  assert.equal(completed.summary.noteCount, 1);
  assert.deepEqual(attempts, [0, 1]);
  upload.close();
});

test('abort settles a nonresponding file slice after Host begins staging', { timeout: 1000 }, async () => {
  const source = backupJson(notebookFixture());
  class StuckSlice extends Blob {
    slice() { return { arrayBuffer: () => new Promise(() => {}) }; }
  }
  const file = new StuckSlice([source.content]);
  const upload = restoreUpload();
  const controller = new AbortController();
  const reading = stageBackupFile(file, api(upload), { uploadId: 'stuck', signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(reading, { code: 'CANCELLED' });
  upload.cancel({ actor, uploadId: 'stuck' });
});
