import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { snapshotBackend } from '../fixtures/snapshot-backend.js';
import { autoTestRoot } from '../fixtures/auto-test-root.js';

const descriptor = { name: 'notebook', version: 1, layout: 'single', hasGlobal: true, tables: [] };
async function root() {
  return autoTestRoot('snapshot-errors-');
}

test('linked medium is refused before SDK access and external bytes remain untouched', async () => {
  const dir = await root(); const other = await root(); const target = `${other}/external.json`;
  await fs.writeFile(target, 'outside synthetic medium'); await fs.symlink(target, `${dir}/notebook.json`);
  const backend = snapshotBackend(dir, async () => assert.fail('must not follow linked medium'), { parse: value => value });
  await assert.rejects(backend.kv.open(descriptor), error => error.code === 'OPEN_FAILED');
  assert.equal(await fs.readFile(target, 'utf8'), 'outside synthetic medium');
  await assert.rejects(backend.close(), AggregateError);
});

test('read I/O failure is not misreported as invalid-record or protected medium', async () => {
  const dir = await root(); let closed = 0;
  const backend = snapshotBackend(dir, async () => ({
    loadAll: async () => { throw Object.assign(new Error('TEST_IO'), { code: 'EIO' }); },
    close: async () => { closed++; },
  }), { parse: value => value });
  await assert.rejects(backend.kv.open(descriptor), error => error.code === 'OPEN_FAILED');
  assert.equal(closed, 1);
  const files = await fs.readdir(dir);
  assert.deepEqual(files, ['notebook.writer.lock']);
});

test('test backend refuses Schema transforms before publish', async () => {
  const dir = await root(); let writes = 0;
  const backend = snapshotBackend(dir, async () => ({
    loadAll: async () => ({ global: null, tables: {} }),
    setGlobal: async () => { writes++; }, close: async () => {},
  }), { parse: value => ({ ...value, injectedDefault: true }) });
  const unit = await backend.kv.open(descriptor);
  try {
    await assert.rejects(unit.setGlobal({ revision: 1 }), error => error.code === 'VALIDATION_FAILED');
    assert.equal(writes, 0);
  } finally { await unit.close(); }
});
