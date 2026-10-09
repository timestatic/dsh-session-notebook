import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { autoTestRoot } from '../fixtures/auto-test-root.js';

async function root() {
  return autoTestRoot('guard-process-');
}
function start(root) {
  const child = fork(fileURLToPath(new URL('../fixtures/guard-child.js', import.meta.url)), [root], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const done = once(child, 'exit'); let exited = false;
  child.on('exit', () => { exited = true; });
  const ready = Promise.race([
    once(child, 'message').then(([message]) => message.status),
    done.then(() => { throw new Error('CHILD_EXIT_BEFORE_READY'); }),
  ]);
  return { child, done, ready, stop: async () => { if (!exited) child.kill('SIGKILL'); await done; } };
}

test('real process contention rejects second owner; crash residue refuses all new writers', { timeout: 10000 }, async () => {
  const dir = await root(); const first = start(dir); const children = [first];
  try {
    assert.equal(await first.ready, 'acquired');
    const second = start(dir); children.push(second);
    assert.equal(await second.ready, 'WRITER_EXISTS'); assert.deepEqual(await second.done, [0, null]);
    first.child.kill('SIGKILL'); assert.deepEqual(await first.done, [null, 'SIGKILL']);
    const afterCrash = start(dir); children.push(afterCrash);
    assert.equal(await afterCrash.ready, 'WRITER_EXISTS'); assert.deepEqual(await afterCrash.done, [0, null]);
  } finally { await Promise.all(children.map(child => child.stop())); }
});

test('normal process release permits next writer without leftover lock', { timeout: 10000 }, async () => {
  const dir = await root(); const children = [];
  try {
    for (let i = 0; i < 2; i++) {
      const child = start(dir); children.push(child); assert.equal(await child.ready, 'acquired');
      child.child.send('release'); assert.deepEqual(await child.done, [0, null]);
    }
    assert.deepEqual(await fs.readdir(dir), []);
  } finally { await Promise.all(children.map(child => child.stop())); }
});
