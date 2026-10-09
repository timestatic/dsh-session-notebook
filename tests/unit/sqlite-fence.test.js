import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { fork } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const childScript = new URL('../fixtures/sqlite-fence-child.js', import.meta.url);
function launch(root, expected, next, value, mode, requestId = 'test-request') {
  const child = fork(childScript, [root, String(expected), String(next), value, mode, requestId], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let timer;
  const done = new Promise((resolve, reject) => {
    const messages = [];
    timer = setTimeout(() => { child.kill(); reject(new Error('CHILD_TIMEOUT')); }, 4000);
    child.on('message', message => messages.push(message));
    child.on('error', reject);
    child.on('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal, messages }); });
  });
  const ready = new Promise((resolve, reject) => {
    if (!['paused', 'hold-transaction'].includes(mode)) return resolve();
    child.on('message', message => { if (message === (mode === 'paused' ? 'READY' : 'LOCKED')) resolve();
      else if (message === 'FAILED') reject(new Error('CHILD_FAILED')); });
    child.on('exit', () => reject(new Error('CHILD_EXITED_BEFORE_READY')));
  });
  return { child, done, ready };
}

async function isolatedRoot(t) {
  const base = new URL('../../.storage-test-output/', import.meta.url);
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const root = await fs.mkdtemp(new URL('sqlite-fence-', base).pathname);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const db = new DatabaseSync(join(root, 'fenced-snapshot.sqlite'));
  try {
    db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; CREATE TABLE snapshot (id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL, body TEXT NOT NULL); CREATE TABLE receipts(request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, generation INTEGER NOT NULL); INSERT INTO snapshot VALUES(1, 1, \'initial\')');
  } finally { db.close(); }
  return root;
}
function snapshot(root) {
  const db = new DatabaseSync(join(root, 'fenced-snapshot.sqlite'), { readOnly: true });
  try { return { ...db.prepare('SELECT generation, body FROM snapshot WHERE id=1').get() }; }
  finally { db.close(); }
}

test('SQLite conditional row update rejects a stale writer in two independent processes', async (t) => {
  const root = await isolatedRoot(t);
  const old = launch(root, 1, 2, 'old', 'paused');
  try {
    await old.ready;
    const newer = launch(root, 1, 2, 'new', 'immediate', 'new-request');
    const first = await newer.done;
    assert.deepEqual(first, { code: 0, signal: null, messages: ['COMMITTED'] });
  } finally { old.child.send('GO'); }
  assert.deepEqual(await old.done, { code: 0, signal: null, messages: ['READY', 'REJECTED'] });
  assert.deepEqual(snapshot(root), { generation: 2, body: 'new' });
});

test('SQLite pre-commit failure rolls back generation and body, next independent process may commit', async (t) => {
  const root = await isolatedRoot(t);
  assert.deepEqual(await launch(root, 1, 2, 'old', 'abort-before-commit').done,
    { code: 1, signal: null, messages: ['FAILED'] });
  assert.deepEqual(snapshot(root), { generation: 1, body: 'initial' });
  assert.deepEqual(await launch(root, 1, 2, 'new', 'immediate').done,
    { code: 0, signal: null, messages: ['COMMITTED'] });
  assert.deepEqual(snapshot(root), { generation: 2, body: 'new' });
});

test('SQLite post-commit lost reply can be reconciled by an atomic receipt in a new process', async (t) => {
  const root = await isolatedRoot(t);
  assert.deepEqual(await launch(root, 1, 2, 'new', 'exit-after-commit').done,
    { code: 78, signal: null, messages: [] });
  // A fresh process retries the exact intent; the receipt is committed with the Snapshot.
  assert.deepEqual(await launch(root, 1, 2, 'new', 'immediate').done,
    { code: 0, signal: null, messages: ['REPLAYED'] });
  assert.deepEqual(await launch(root, 1, 2, 'old', 'immediate').done,
    { code: 0, signal: null, messages: ['CONFLICT'] });
  assert.deepEqual(await launch(root, 1, 2, 'old', 'immediate', 'other-request').done,
    { code: 0, signal: null, messages: ['REJECTED'] });
  assert.deepEqual(snapshot(root), { generation: 2, body: 'new' });
});

test('two pre-read independent writers with same intent serialize to one commit and one replay', async (t) => {
  const root = await isolatedRoot(t);
  const first = launch(root, 1, 2, 'new', 'paused');
  const second = launch(root, 1, 2, 'new', 'paused');
  try {
    await Promise.all([first.ready, second.ready]);
    first.child.send('GO');
    assert.deepEqual(await first.done, { code: 0, signal: null, messages: ['READY', 'COMMITTED'] });
  } finally { second.child.send('GO'); }
  assert.deepEqual(await second.done, { code: 0, signal: null, messages: ['READY', 'REPLAYED'] });
  assert.deepEqual(snapshot(root), { generation: 2, body: 'new' });
  const db = new DatabaseSync(join(root, 'fenced-snapshot.sqlite'), { readOnly: true });
  try { assert.equal(db.prepare('SELECT COUNT(*) AS count FROM receipts').get().count, 1); }
  finally { db.close(); }
});

test('SQLite busy writer exits without changing snapshot or receipts while first transaction is held', async (t) => {
  const root = await isolatedRoot(t);
  const holder = launch(root, 1, 2, 'new', 'hold-transaction', 'first-request');
  try {
    await holder.ready;
    assert.deepEqual(await launch(root, 1, 2, 'old', 'busy-fast', 'second-request').done,
      { code: 1, signal: null, messages: ['FAILED'] });
  } finally { holder.child.send('GO'); }
  assert.deepEqual(await holder.done, { code: 0, signal: null, messages: ['LOCKED', 'COMMITTED'] });
  assert.deepEqual(snapshot(root), { generation: 2, body: 'new' });
  const db = new DatabaseSync(join(root, 'fenced-snapshot.sqlite'), { readOnly: true });
  try {
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM receipts').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM receipts WHERE request_id = ?').get('second-request').count, 0);
  } finally { db.close(); }
});

test('SQLite rollback leaves no receipt, allowing the identical intent to commit once', async (t) => {
  const root = await isolatedRoot(t);
  assert.deepEqual(await launch(root, 1, 2, 'new', 'abort-before-commit').done,
    { code: 1, signal: null, messages: ['FAILED'] });
  assert.deepEqual(await launch(root, 1, 2, 'new', 'immediate').done,
    { code: 0, signal: null, messages: ['COMMITTED'] });
  assert.deepEqual(await launch(root, 1, 2, 'new', 'immediate').done,
    { code: 0, signal: null, messages: ['REPLAYED'] });
  assert.deepEqual(snapshot(root), { generation: 2, body: 'new' });
});
