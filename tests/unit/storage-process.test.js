import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { autoTestRoot } from '../fixtures/auto-test-root.js';

const name = 'dsh-session-notebook-process-test';
const old = { revision: 1, notes: { old: '完整旧快照😀\n' } };
const next = { revision: 2, notes: { next: '完整新快照😀\n' } };
async function medium() {
  const root = await autoTestRoot('process-');
  const path = join(root, `${name}.json`);
  await fs.writeFile(path, JSON.stringify({ unit: { name, version: 1 }, global: old, tables: {} }), { mode: 0o600 });
  return { root, read: async () => JSON.parse(await fs.readFile(path, 'utf8')).global };
}
function child(root, mode) {
  const cp = fork(fileURLToPath(new URL('../fixtures/storage-child.js', import.meta.url)), [root, mode], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const messages = []; let pending; let exited = false;
  let errorOutput = '';
  cp.stderr.on('data', data => { errorOutput = (errorOutput + data).slice(-2000); });
  cp.on('message', value => { messages.push(value); pending?.(); });
  const done = once(cp, 'exit');
  cp.on('exit', () => { exited = true; pending?.(); });
  const stage = async expected => {
    const deadline = AbortSignal.timeout(5000);
    while (true) {
      const at = messages.findIndex(message => message.stage === expected);
      if (at >= 0) { messages.splice(at, 1); return; }
      if (exited) throw new Error(`Test child exited before ${expected}: ${errorOutput}`);
      await new Promise((resolve, reject) => {
        const abort = () => { pending = undefined; reject(new Error('TEST_CHILD_TIMEOUT')); };
        pending = () => { pending = undefined; deadline.removeEventListener('abort', abort); resolve(); };
        if (deadline.aborted) abort(); else deadline.addEventListener('abort', abort, { once: true });
      });
    }
  };
  return { cp, done, stage, stop: async () => {
    if (!exited) cp.kill('SIGKILL');
    await done;
  } };
}
for (const [mode, expected] of [['before-rename', old], ['after-rename', next]]) {
  test(`dedicated child SIGKILL ${mode} leaves a complete expected snapshot`, async () => {
    const h = await medium(); const c = child(h.root, mode);
    try {
      await c.stage(mode);
      c.cp.kill('SIGKILL');
      const [code, signal] = await c.done;
      assert.equal(code, null); assert.equal(signal, 'SIGKILL');
      assert.deepEqual(await h.read(), expected);
      // OS still running: validates process crash atomicity, NOT power-loss durability.
    } finally { await c.stop(); }
  });
}

test('two dedicated SDK write processes reproduce lost updates without exclusion', async () => {
  const h = await medium(); const a = child(h.root, 'writer'); const b = child(h.root, 'writer');
  try {
    await Promise.all([a.stage('ready'), b.stage('ready')]);
    a.cp.send({ action: 'commit', writer: 'A' }); await a.stage('committed');
    assert.deepEqual((await h.read()).notes, { ...old.notes, A: 'A' });
    b.cp.send({ action: 'commit', writer: 'B' }); await b.stage('committed');
    assert.deepEqual((await h.read()).notes, { ...old.notes, B: 'B' });
    assert.deepEqual(await a.done, [0, null]); assert.deepEqual(await b.done, [0, null]);
    // Green means the risk is proven; it is NOT a safe multi-Host result.
  } finally { await a.stop(); await b.stop(); }
});
