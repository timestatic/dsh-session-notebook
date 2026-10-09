import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { workerReader } from './worker-reader.js';

function fakeWorker() {
  const worker = new EventEmitter(); const sent = [];
  worker.postMessage = message => { sent.push(message); };
  return { worker, sent };
}

test('timeout ID cannot be reassigned to later request or duplicate response', async () => {
  const { worker, sent } = fakeWorker(); const reader = workerReader(worker, { timeoutMs: 25, maxPending: 1 });
  try {
    const first = reader.list(1);
    assert.deepEqual(sent[0], { id: 1, op: 'list', limit: 1 });
    await assert.rejects(reader.list(1), /WORKER_BUSY/);
    await assert.rejects(first, /WORKER_TIMEOUT/);
    const second = reader.list(2);
    assert.deepEqual(sent[1], { id: 2, op: 'list', limit: 2 });
    worker.emit('message', { id: 1, notes: ['stale'] });
    worker.emit('message', { id: 0, notes: ['unsolicited'] });
    worker.emit('message', { id: 2, notes: ['current'] });
    assert.deepEqual(await second, { id: 2, notes: ['current'] });
    worker.emit('message', { id: 2, notes: ['duplicate'] });
    assert.equal(worker.listenerCount('message'), 1);
  } finally { reader.close(); }
  assert.equal(worker.listenerCount('message'), 0);
  assert.equal(worker.listenerCount('error'), 0);
  assert.equal(worker.listenerCount('exit'), 0);
});

test('worker exit rejects all pending with fixed error and rejects subsequent calls', async () => {
  const { worker } = fakeWorker(); const reader = workerReader(worker);
  const first = reader.list(1); const second = reader.list(2);
  worker.emit('exit', 17);
  await assert.rejects(first, /WORKER_EXITED/); await assert.rejects(second, /WORKER_EXITED/);
  await assert.rejects(reader.list(1), /WORKER_CLOSED/);
  assert.equal(worker.listenerCount('message'), 0);
});

test('invalid limits do not post messages and explicit detach cancels without unlocking', async () => {
  const { worker, sent } = fakeWorker(); const reader = workerReader(worker);
  await assert.rejects(reader.list(101), /VALIDATION_FAILED/);
  const pending = reader.list(1); reader.close();
  await assert.rejects(pending, /WORKER_CLOSED/);
  assert.equal(sent.length, 1);
  assert.equal(worker.listenerCount('message'), 0);
});
