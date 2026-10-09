import * as fs from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';

const root = resolve(process.argv[2]);
const mode = process.argv[3];
const allowed = fileURLToPath(new URL('../../.storage-test-output/', import.meta.url));
if (!root.startsWith(`${resolve(allowed)}${sep}`)) throw new Error('UNSAFE_TEST_ROOT');
const name = 'dsh-session-notebook-process-test';
const source = await fs.readFile(new URL('../../.sdk-reference/storage-json/package/lib/index.js', import.meta.url), 'utf8');
const start = source.indexOf('//#region lib/types/atomic.js');
const end = source.indexOf('//#region lib/types/per-record-unit.js', start);
if (start < 0 || end <= start) throw new Error('SDK_BOUNDARY_CHANGED');
const notify = message => new Promise((resolve, reject) => process.send(message, error => error ? reject(error) : resolve()));
const pause = async stage => {
  // A never-settling Promise does not keep Node alive (TLA exits with code 13).
  // Keep the dedicated child alive at the checkpoint until the parent kills it.
  const keepAlive = setInterval(() => {}, 1000);
  try { await notify({ stage }); await new Promise(() => {}); }
  finally { clearInterval(keepAlive); }
};
class StorageError extends Error { constructor(code, message) { super(message); this.code = code; } }
const openUnit = runInNewContext(`${source.slice(start, end)}\nopenSingleUnit`, {
  ...fs, dirname, join, randomUUID, process, StorageError,
  rename: async (...args) => {
    if (mode === 'before-rename') await pause('before-rename');
    await fs.rename(...args);
    if (mode === 'after-rename') await pause('after-rename');
  },
});
const unit = await openUnit({ name, version: 1, hasGlobal: true, tables: [] }, root, () => {});
const previous = (await unit.loadAll()).global;
if (mode === 'writer') {
  await notify({ stage: 'ready' });
  process.once('message', async message => {
    try {
      if (message.action !== 'commit' || !['A', 'B'].includes(message.writer)) throw new Error('INVALID_TEST_COMMAND');
      await unit.setGlobal({ ...previous, revision: 2, notes: { ...previous.notes, [message.writer]: message.writer } });
      await unit.close(); await notify({ stage: 'committed' }); process.disconnect();
    } catch { process.exit(1); }
  });
} else {
  await unit.setGlobal({ revision: 2, notes: { next: '完整新快照😀\n' } });
  await unit.close(); process.disconnect();
}
