import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { autoTestRoot } from '../fixtures/auto-test-root.js';

// TEST ONLY: execute the saved SDK atomic writer unchanged, with a cooperative
// pre-publish generation check. No user media, no replacement Host service.
test('a pre-rename generation check cannot fence an old SDK writer after it passes the check', async () => {
  const root = await autoTestRoot('fence-window-');
  const target = join(root, 'notebook.json');
  const generation = join(root, 'generation');
  await fs.writeFile(generation, '1', { mode: 0o600 });
  let entered; const atCheck = new Promise(resolve => { entered = resolve; });
  let resume; const pause = new Promise(resolve => { resume = resolve; });
  const source = await fs.readFile(new URL('../../.sdk-reference/storage-json/package/lib/index.js', import.meta.url), 'utf8');
  const from = source.indexOf('//#region lib/types/atomic.js');
  const to = source.indexOf('//#region lib/types/format.js', from);
  assert.ok(from >= 0 && to > from);
  const writeAtomic = runInNewContext(`${source.slice(from, to)}\nwriteAtomic`, {
    open: fs.open, rename: async (fromPath, toPath) => {
      if (toPath === target && fromPath.startsWith(root)) {
        if ((await fs.readFile(generation, 'utf8')) !== '1') throw new Error('FENCE_REJECTED');
        entered(); await pause; // Old writer passed the check but has not published.
      }
      await fs.rename(fromPath, toPath);
    },
    rm: fs.rm, join, dirname, randomUUID, process,
  });
  const old = writeAtomic(target, 'old');
  await atCheck;
  try {
    await fs.writeFile(generation, '2');
    await fs.writeFile(target, 'new');
  } finally { resume(); }
  await old;
  assert.equal(await fs.readFile(target, 'utf8'), 'old');
  assert.equal(await fs.readFile(generation, 'utf8'), '2');
});
