import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkedTestRoot, isOwnedPrivateDirectory } from '../fixtures/test-root.js';
import { autoTestRoot } from '../fixtures/auto-test-root.js';

const base = new URL('../../.storage-test-output/', import.meta.url);
async function root() { return autoTestRoot('checked-root-'); }

test('private directory predicate rejects foreign owners and all non-private or non-directory modes', () => {
  const uid = process.getuid?.() ?? 501;
  const directory = (mode, owner) => ({ mode, uid: owner, isDirectory: () => true });
  assert.equal(isOwnedPrivateDirectory(directory(0o40700, uid), uid), true);
  assert.equal(isOwnedPrivateDirectory(directory(0o40700, uid + 1), uid), false);
  for (const mode of [0o40755, 0o40750, 0o40777, 0o40701]) {
    assert.equal(isOwnedPrivateDirectory(directory(mode, uid), uid), false);
  }
  assert.equal(isOwnedPrivateDirectory({ mode: 0o100700, uid, isDirectory: () => false }, uid), false);
});

test('explicit private direct test child is accepted and aliases are refused', async () => {
  const dir = await root(); assert.equal(await checkedTestRoot(dir), dir);
  const parent = fileURLToPath(base);
  const nested = join(dir, 'nested'); await fs.mkdir(nested, { mode: 0o700 });
  const alias = join(parent, `alias-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await fs.symlink(dir, alias);
  try {
    for (const invalid of [undefined, '', '.', dir + '/..', parent, nested, alias, new URL('file:///tmp/').pathname]) {
      await assert.rejects(checkedTestRoot(invalid), error => error.code === 'UNSAFE_TEST_ROOT');
    }
  } finally { await fs.unlink(alias); }
});

test('world-accessible or missing test roots fail closed', async () => {
  const dir = await root();
  try {
    await fs.chmod(dir, 0o755);
    await assert.rejects(checkedTestRoot(dir), error => error.code === 'UNSAFE_TEST_ROOT');
    await assert.rejects(checkedTestRoot(join(fileURLToPath(base), `missing-${Date.now()}`)), error => error.code === 'UNSAFE_TEST_ROOT');
  } finally { await fs.chmod(dir, 0o700); }
});
