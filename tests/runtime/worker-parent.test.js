import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { once } from 'node:events';
import { workerParent } from './worker-parent.js';
import { acquireMedium } from '../fixtures/medium-guard.js';
import { autoTestRoot } from '../fixtures/auto-test-root.js';

async function root() { return autoTestRoot('worker-parent-'); }

function ready(worker) {
  return new Promise((resolve, reject) => {
    const onMessage = value => { if (value?.ready === true) { cleanup(); resolve(); } };
    const onError = error => { cleanup(); reject(error); };
    const onExit = () => { cleanup(); reject(new Error('WORKER_EXITED')); };
    const cleanup = () => { worker.off('message', onMessage); worker.off('error', onError); worker.off('exit', onExit); };
    worker.on('message', onMessage); worker.on('error', onError); worker.on('exit', onExit);
  });
}

test('parent permits exactly one replacement after observed clean close and exit', async () => {
  const parent = workerParent(await root());
  try {
    await ready(parent.start());
    await assert.rejects(Promise.resolve().then(() => parent.restart()), error => error.code === 'RESTART_DENIED');
    assert.equal(await parent.close(), 'CLOSED_OK');
    await ready(parent.restart());
    await assert.rejects(Promise.resolve().then(() => parent.restart()), error => error.code === 'RESTART_DENIED');
    assert.equal(await parent.close(), 'CLOSED_OK');
  } finally { await parent.terminateForTest(); }
});

test('offline-only close keeps residual lock and parent cannot auto restart after clean worker exit', async () => {
  const dir = await root(); const parent = workerParent(dir, { testRetainLockOnClose: true });
  try {
    await ready(parent.start());
    assert.equal(await parent.close(), 'CLOSE_FAILED');
    await assert.rejects(Promise.resolve().then(() => parent.restart()), error => error.code === 'RESTART_DENIED');
    await assert.rejects(acquireMedium(dir), error => error.code === 'WRITER_EXISTS');
    assert.equal((await fs.readdir(dir)).includes('notebook.writer.lock'), true);
  } finally { await parent.terminateForTest(); }
});

test('release-sync failure blocks same-parent restart even though new writer can acquire', async () => {
  const dir = await root(); const parent = workerParent(dir, { testFailReleaseSync: true });
  try {
    await ready(parent.start());
    assert.equal(await parent.close(), 'CLOSE_FAILED');
    await assert.rejects(Promise.resolve().then(() => parent.restart()), error => error.code === 'RESTART_DENIED');
    const other = await acquireMedium(dir); await other.release();
    await assert.rejects(Promise.resolve().then(() => parent.restart()), error => error.code === 'RESTART_DENIED');
  } finally { await parent.terminateForTest(); }
});
