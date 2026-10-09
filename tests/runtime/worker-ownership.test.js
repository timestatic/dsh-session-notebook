import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { acquireMedium } from '../fixtures/medium-guard.js';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { workerReader } from './worker-reader.js';
import { workerRestartGate } from './worker-restart-gate.js';
import { autoTestRoot } from '../fixtures/auto-test-root.js';

function response(worker, predicate = () => true, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); worker.off('message', message); worker.off('error', error); worker.off('exit', exit); };
    const message = value => { if (predicate(value)) { cleanup(); resolve(value); } };
    const error = () => { cleanup(); reject(new Error('WORKER_FAILED')); };
    const exit = () => { cleanup(); reject(new Error('WORKER_EXITED')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('WORKER_TIMEOUT')); }, timeout);
    worker.on('message', message); worker.on('error', error); worker.on('exit', exit);
  });
}
async function start(options = {}) {
  const root = options.root ?? await autoTestRoot('owner-worker-');
  const worker = new Worker(new URL('./owned-worker.js', import.meta.url), { workerData: { root, testFailUnitClose: options.testFailUnitClose === true, testPauseList: options.testPauseList === true, testFailReleaseSync: options.testFailReleaseSync === true } });
  try { const ready = await response(worker); assert.equal(ready.ready, true); }
  catch (error) { await worker.terminate(); throw error; }
  return { root, worker, request: async message => {
    const expected = Number.isSafeInteger(message?.id) && message.id > 0 ? message.id : 0;
    const pending = response(worker, value => value.id === expected); worker.postMessage(message); return pending;
  } };
}
test('worker owns real Cordis Domain, returns bounded DTO, normal close releases lock', async () => {
  const h = await start();
  try {
    const result = await h.request({ id: 1, op: 'list', limit: 10 });
    assert.deepEqual(result.notes, [{ id: 'n1', kind: 'note', version: 1 }]);
    assert.ok(Buffer.byteLength(JSON.stringify(result)) < 1024);
    assert.equal(result.notes[0].quote, undefined);
    assert.equal((await h.request({ id: 2, op: 'list', limit: 101 })).code, 'VALIDATION_FAILED');
    assert.equal((await h.request({ id: 3, op: 'write', value: {} })).code, 'VALIDATION_FAILED');
    for (const id of [-1, 0, 'opaque', { secret: 'must-not-echo' }]) {
      assert.deepEqual(await h.request({ id, op: 'list', limit: 1 }), { id: 0, code: 'VALIDATION_FAILED' });
    }
    assert.equal(h.worker.listenerCount('message'), 0);
    await assert.rejects(response(h.worker, () => false, 20), /WORKER_TIMEOUT/);
    assert.equal(h.worker.listenerCount('message'), 0);
    await assert.rejects(acquireMedium(h.root), error => error.code === 'WRITER_EXISTS');
    const exit = once(h.worker, 'exit');
    assert.equal((await h.request({ id: 4, op: 'close' })).code, 'CLOSED_OK');
    assert.equal((await exit)[0], 0);
    const guard = await acquireMedium(h.root); await guard.release();
  } finally { await h.worker.terminate(); }
});
test('unanswered list times out without unlocking, listener leaks or ownership transfer', async () => {
  const h = await start({ testPauseList: true });
  try {
    const pending = response(h.worker, message => message.id === 7, 30);
    h.worker.postMessage({ id: 7, op: 'list', limit: 1 });
    await assert.rejects(pending, /WORKER_TIMEOUT/);
    assert.equal(h.worker.listenerCount('message'), 0);
    await assert.rejects(acquireMedium(h.root), error => error.code === 'WRITER_EXISTS');
    const finished = once(h.worker, 'exit');
    assert.equal((await h.request({ id: 8, op: 'close' })).code, 'CLOSED_OK');
    assert.equal((await finished)[0], 0);
  } finally { await h.worker.terminate(); }
});

test('bounded parent reader correlates real worker summaries and detaches without unlocking', async () => {
  const h = await start(); const reader = workerReader(h.worker, { maxPending: 2 });
  try {
    const [first, second] = await Promise.all([reader.list(1), reader.list(2)]);
    assert.equal(first.id + 1, second.id);
    assert.deepEqual(first.notes, [{ id: 'n1', kind: 'note', version: 1 }]);
    assert.deepEqual(second.notes, first.notes);
    reader.close();
    assert.equal(h.worker.listenerCount('message'), 0);
    await assert.rejects(acquireMedium(h.root), error => error.code === 'WRITER_EXISTS');
    const exit = once(h.worker, 'exit');
    assert.equal((await h.request({ id: 12, op: 'close' })).code, 'CLOSED_OK');
    assert.equal((await exit)[0], 0);
  } finally { reader.close(); await h.worker.terminate(); }
});

test('normal restart reads existing Snapshot without rewriting its bytes', async () => {
  const first = await start();
  const path = join(first.root, 'notebook.json');
  try {
    const before = createHash('sha256').update(await fs.readFile(path)).digest('hex');
    const exit = once(first.worker, 'exit');
    assert.equal((await first.request({ id: 1, op: 'close' })).code, 'CLOSED_OK');
    assert.equal((await exit)[0], 0);
    const again = await start({ root: first.root });
    try {
      const result = await again.request({ id: 2, op: 'list', limit: 10 });
      assert.deepEqual(result.notes, [{ id: 'n1', kind: 'note', version: 1 }]);
      assert.equal(createHash('sha256').update(await fs.readFile(path)).digest('hex'), before);
      const finished = once(again.worker, 'exit');
      assert.equal((await again.request({ id: 3, op: 'close' })).code, 'CLOSED_OK');
      assert.equal((await finished)[0], 0);
    } finally { await again.worker.terminate(); }
  } finally { await first.worker.terminate(); }
});

test('second worker on same medium cannot initialize or overwrite the first owner', async () => {
  const first = await start();
  const source = join(first.root, 'notebook.json');
  try {
    const before = createHash('sha256').update(await fs.readFile(source)).digest('hex');
    await assert.rejects(start({ root: first.root }), /WORKER_FAILED|WORKER_EXITED/);
    assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), before);
    assert.deepEqual((await first.request({ id: 1, op: 'list', limit: 1 })).notes,
      [{ id: 'n1', kind: 'note', version: 1 }]);
    const exit = once(first.worker, 'exit');
    assert.equal((await first.request({ id: 2, op: 'close' })).code, 'CLOSED_OK');
    assert.equal((await exit)[0], 0);
  } finally { await first.worker.terminate(); }
});

test('worker startup on corrupt medium fails closed without READY or rewriting source', async () => {
  const root = await autoTestRoot('owner-corrupt-');
  const source = join(root, 'notebook.json'); const bytes = '{invalid synthetic medium';
  await fs.writeFile(source, bytes);
  await assert.rejects(start({ root }), /WORKER_FAILED|WORKER_EXITED/);
  assert.equal(await fs.readFile(source, 'utf8'), bytes);
  assert.equal((await fs.readdir(root)).includes('notebook.writer.lock'), true);
  await assert.rejects(acquireMedium(root), error => error.code === 'WRITER_EXISTS');
});

test('failed SDK unit close never reports successful worker shutdown or unlocks', async () => {
  const h = await start({ testFailUnitClose: true });
  try {
    const exit = once(h.worker, 'exit');
    assert.equal((await h.request({ id: 1, op: 'close' })).code, 'CLOSE_FAILED');
    assert.equal((await exit)[0], 0);
    await assert.rejects(acquireMedium(h.root), error => error.code === 'WRITER_EXISTS');
  } finally { await h.worker.terminate(); }
});

test('release sync failure blocks parent restart despite a newly acquirable lock and exit zero', async () => {
  const h = await start({ testFailReleaseSync: true });
  const gate = workerRestartGate();
  try {
    const exit = once(h.worker, 'exit');
    const reply = await h.request({ id: 1, op: 'close' });
    assert.equal(reply.code, 'CLOSE_FAILED');
    gate.closeReply({ code: reply.code });
    gate.exited((await exit)[0]);
    assert.equal(gate.mayRestart(), false);
    // Lock absence alone still permits another independent writer: this gate only controls this parent.
    const next = await acquireMedium(h.root);
    await next.release();
    assert.equal(gate.mayRestart(), false);
  } finally { await h.worker.terminate(); }
});

test('abnormal worker termination retains exclusion; no automatic ownership transfer', async () => {
  const h = await start(); await h.worker.terminate();
  await assert.rejects(acquireMedium(h.root), error => error.code === 'WRITER_EXISTS');
});
