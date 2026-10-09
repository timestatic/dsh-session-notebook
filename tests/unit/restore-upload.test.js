import test from 'node:test';
import assert from 'node:assert/strict';
import { backupJson } from '../../src/json-backup.js';
import { restoreUpload } from '../../src/restore-upload.js';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';

const actor = 'desktop:peer-1';
const source = backupJson(notebookFixture());
const bytes = Buffer.from(source.content, 'utf8');
const parts = Array.from({ length: Math.ceil(bytes.length / 128) }, (_, index) =>
  bytes.subarray(index * 128, (index + 1) * 128).toString('base64'));

test('bounded chunks survive duplicate retries and validate one complete candidate', () => {
  const upload = restoreUpload({ maxChunkBytes: 128 });
  const started = upload.begin({ actor, uploadId: 'stable_upload', bytes: bytes.length });
  assert.equal(started.nextIndex, 0);
  assert.deepEqual(upload.begin({ actor, uploadId: 'stable_upload', bytes: bytes.length }), started);
  assert.throws(() => upload.candidate({ actor, token: started.token }), { code: 'UPLOAD_INCOMPLETE' });
  assert.throws(() => upload.append({ actor: 'other', token: started.token, index: 0,
    base64: parts[0] }), { code: 'UPLOAD_NOT_FOUND' });
  parts.forEach((base64, index) => {
    const progress = upload.append({ actor, token: started.token, index, base64 });
    assert.equal(progress.nextIndex, index + 1);
    assert.deepEqual(upload.append({ actor, token: started.token, index, base64 }), progress);
  });
  const finished = upload.finish({ actor, token: started.token });
  assert.equal(finished.nextIndex, parts.length);
  assert.equal(finished.receivedBytes, bytes.length);
  assert.equal(finished.summary.noteCount, 1);
  assert.deepEqual(upload.finish({ actor, token: started.token }), finished);
  assert.deepEqual(upload.begin({ actor, uploadId: 'stable_upload', bytes: bytes.length }), {
    token: started.token, nextIndex: parts.length, receivedBytes: bytes.length });
  const candidate = upload.candidate({ actor, token: started.token });
  assert.deepEqual(candidate.snapshot, notebookFixture());
  candidate.snapshot.notes.n1.bodyMarkdown = 'tampered';
  assert.deepEqual(upload.candidate({ actor, token: started.token }).snapshot, notebookFixture());
  upload.close();
  assert.throws(() => upload.candidate({ actor, token: started.token }), { code: 'CLOSED' });
});

test('chunk limits, order, identity and contents fail without publishing a candidate', () => {
  const upload = restoreUpload({ maxBytes: bytes.length, maxChunkBytes: 128 });
  assert.throws(() => upload.begin({ actor, uploadId: 'too_large', bytes: bytes.length + 1 }),
    { code: 'VALIDATION_FAILED' });
  const started = upload.begin({ actor, uploadId: 'first', bytes: bytes.length });
  assert.throws(() => upload.begin({ actor, uploadId: 'second', bytes: bytes.length }),
    { code: 'UPLOAD_BUSY' });
  assert.throws(() => upload.append({ actor, token: started.token, index: 1,
    base64: parts[1] }), { code: 'UPLOAD_CONFLICT' });
  assert.throws(() => upload.append({ actor, token: started.token, index: 0,
    base64: Buffer.alloc(129).toString('base64') }), { code: 'VALIDATION_FAILED' });
  assert.throws(() => upload.append({ actor, token: started.token, index: 0,
    base64: 'not-base64!' }), { code: 'VALIDATION_FAILED' });
  assert.throws(() => upload.finish({ actor, token: started.token }), { code: 'UPLOAD_INCOMPLETE' });
  upload.append({ actor, token: started.token, index: 0, base64: parts[0] });
  assert.throws(() => upload.append({ actor, token: started.token, index: 0,
    base64: Buffer.alloc(128).toString('base64') }), { code: 'UPLOAD_CONFLICT' });
  assert.throws(() => upload.cancel({ actor: 'other', token: started.token }),
    { code: 'UPLOAD_NOT_FOUND' });
  upload.cancel({ actor, token: started.token });
  assert.throws(() => upload.candidate({ actor, token: started.token }), { code: 'UPLOAD_NOT_FOUND' });
});

test('invalid UTF-8 and invalid backup release the bounded staging slot', () => {
  const upload = restoreUpload();
  for (const content of [Buffer.from([0xff]), Buffer.from('{}')]) {
    const started = upload.begin({ actor, uploadId: `bad_${content.length}`, bytes: content.length });
    upload.append({ actor, token: started.token, index: 0, base64: content.toString('base64') });
    assert.throws(() => upload.finish({ actor, token: started.token }), error =>
      ['INVALID_BACKUP', 'UNSUPPORTED_BACKUP'].includes(error.code));
    assert.throws(() => upload.candidate({ actor, token: started.token }), { code: 'UPLOAD_NOT_FOUND' });
  }
});

test('expired or closed uploads reject stale tokens and free candidate memory', () => {
  let clock = 1000;
  const upload = restoreUpload({ ttlMs: 10, now: () => clock });
  const started = upload.begin({ actor, uploadId: 'expiring', bytes: bytes.length });
  clock = 1010;
  assert.throws(() => upload.append({ actor, token: started.token, index: 0,
    base64: parts[0] }), { code: 'UPLOAD_NOT_FOUND' });
  assert.notEqual(upload.begin({ actor, uploadId: 'expiring', bytes: bytes.length }).token,
    started.token);
  upload.close();
  assert.throws(() => upload.begin({ actor, uploadId: 'new', bytes: bytes.length }),
    { code: 'CLOSED' });
});

test('stable upload ID cancels staging when the begin reply is lost', () => {
  const upload = restoreUpload();
  const started = upload.begin({ actor, uploadId: 'lost_begin', bytes: bytes.length });
  assert.throws(() => upload.cancel({ actor: 'other', uploadId: 'lost_begin' }),
    { code: 'UPLOAD_NOT_FOUND' });
  upload.cancel({ actor, uploadId: 'lost_begin' });
  assert.throws(() => upload.candidate({ actor, token: started.token }),
    { code: 'UPLOAD_NOT_FOUND' });
  assert.throws(() => upload.begin({ actor, uploadId: 'lost_begin', bytes: bytes.length }),
    { code: 'UPLOAD_NOT_FOUND' });
});

test('cancel before a delayed begin prevents a stale upload from occupying the slot', () => {
  let clock = 1000;
  const upload = restoreUpload({ ttlMs: 10, now: () => clock });
  upload.cancel({ actor, uploadId: 'late_begin' });
  assert.throws(() => upload.begin({ actor, uploadId: 'late_begin', bytes: bytes.length }),
    { code: 'UPLOAD_NOT_FOUND' });
  const fresh = upload.begin({ actor, uploadId: 'new_file', bytes: bytes.length });
  upload.cancel({ actor, token: fresh.token });
  assert.throws(() => upload.begin({ actor, uploadId: 'new_file', bytes: bytes.length }),
    { code: 'UPLOAD_NOT_FOUND' });
  clock = 1010;
  assert.ok(upload.begin({ actor, uploadId: 'late_begin', bytes: bytes.length }).token);
});

test('cancel tombstone overflow refuses new uploads until delayed begins leave the TTL window', () => {
  let clock = 1000;
  const upload = restoreUpload({ ttlMs: 10, now: () => clock });
  for (let index = 0; index < 33; index++)
    upload.cancel({ actor, uploadId: `cancel_${index}` });
  assert.throws(() => upload.begin({ actor, uploadId: 'cancel_0', bytes: bytes.length }),
    { code: 'UPLOAD_BUSY' }, 'an evicted ID cannot reopen a staging slot');
  assert.throws(() => upload.begin({ actor, uploadId: 'fresh', bytes: bytes.length }),
    { code: 'UPLOAD_BUSY' });
  assert.throws(() => upload.begin({ actor, uploadId: 'cancel_32', bytes: bytes.length }),
    { code: 'UPLOAD_NOT_FOUND' });
  clock = 1009;
  assert.throws(() => upload.begin({ actor, uploadId: 'fresh', bytes: bytes.length }),
    { code: 'UPLOAD_BUSY' });
  clock = 1010;
  assert.ok(upload.begin({ actor, uploadId: 'fresh', bytes: bytes.length }).token);
});
