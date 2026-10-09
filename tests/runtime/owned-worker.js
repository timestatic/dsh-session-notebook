import { parentPort, workerData } from 'node:worker_threads';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json';
import { DomainFacility, defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { snapshotBackend } from '../fixtures/snapshot-backend.js';
import { notebookSchema, notebookFixture } from '../fixtures/notebook-snapshot.js';
import { closeOwned } from './close-owned.js';
import { checkedTestRoot } from '../fixtures/test-root.js';

// TEST ONLY: worker owns whole library; parent cannot supply writes or arbitrary paths.
const root = await checkedTestRoot(workerData?.root);
const ctx = new Context(); await ctx.plugin(Storage);
const raw = new JsonStorageBackend(root);
const backend = snapshotBackend(root, async descriptor => {
  const unit = await raw.kv.open(descriptor);
  if (!workerData.testFailUnitClose) return unit;
  return { loadAll: () => unit.loadAll(), setGlobal: value => unit.setGlobal(value),
    close: async () => { await unit.close(); throw new Error('TEST_UNIT_CLOSE_FAILED'); } };
}, notebookSchema, { guardHooks: workerData.testRetainLockOnClose === true ? { retainLockOnClose: true }
  : workerData.testFailReleaseSync === true ? {
    beforeDirectorySync: async stage => { if (stage === 'release') throw new Error('TEST_RELEASE_SYNC_FAILURE'); },
  } : undefined });
const unregister = ctx.storage.backend.register('worker_test', backend);
const facility = new DomainFacility(ctx, { backend: 'worker_test' });
const spec = defineDomain({ name: 'notebook', version: 1, layout: 'single', tables: {},
  global: { schema: notebookSchema, initial: notebookFixture() } });
const domain = await facility.open(spec); // guarded backend acquires writer ownership before initialization decision
let absent = false;
try { await lstat(join(root, 'notebook.json')); }
catch (error) { if (error.code === 'ENOENT') absent = true; else throw error; }
if (absent) await domain.global.set(structuredClone(domain.global.get()));
let closing = false;
parentPort.on('message', async message => {
  const validId = message && Number.isSafeInteger(message.id) && message.id > 0;
  if (!validId || Object.keys(message).some(key => !['id', 'op', 'limit'].includes(key))) {
    parentPort.postMessage({ id: validId ? message.id : 0, code: 'VALIDATION_FAILED' }); return;
  }
  if (closing) { parentPort.postMessage({ id: message.id, code: 'CLOSED' }); return; }
  if (message.op === 'list' && Number.isSafeInteger(message.limit) && message.limit >= 1 && message.limit <= 100) {
    if (workerData.testPauseList === true) await new Promise(() => {}); // synthetic no-response failure; never production
    const value = domain.global.get();
    const notes = [];
    for (const key in value.notes) {
      if (!Object.hasOwn(value.notes, key)) continue;
      const note = value.notes[key];
      if (note.deletedAt) continue;
      notes.push({ id: note.id, kind: note.kind, version: note.version });
      if (notes.length === message.limit) break;
    }
    parentPort.postMessage({ id: message.id, revision: value.revision, notes }); return;
  }
  if (message.op === 'close' && message.limit === undefined) {
    closing = true;
    const code = await closeOwned([
      () => facility.closeAll(), () => backend.close(), () => unregister(),
      () => raw.close(), () => ctx.fiber.dispose(),
    ]);
    parentPort.postMessage({ id: message.id, code }); parentPort.close();
    return;
  }
  parentPort.postMessage({ id: message.id, code: 'VALIDATION_FAILED' });
});
parentPort.postMessage({ ready: true });
