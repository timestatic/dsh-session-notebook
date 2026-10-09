import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { experimentConfig } from '../fixtures/experiment-config.js';
import { autoTestRoot } from '../fixtures/auto-test-root.js';

async function privateRoot() { return autoTestRoot('experiment-config-'); }

test('explicit private test root yields immutable fixed namespace and performs no IO in root', async () => {
  const root = await privateRoot();
  const before = await fs.readdir(root);
  const config = await experimentConfig({ root });
  assert.deepEqual(config, { root, backend: 'notebook_probe_v1', domain: 'notebook_probe_v1' });
  assert.equal(Object.isFrozen(config), true);
  assert.deepEqual(await fs.readdir(root), before);
});

test('missing, extra, lazy, alias and unsafe roots reject before creating media', async () => {
  const root = await privateRoot(); const alias = join(new URL('../../.storage-test-output/', import.meta.url).pathname, `config-alias-${Date.now()}`);
  await fs.symlink(root, alias);
  try {
    const bad = [undefined, null, {}, [], { root, backend: 'json' }, { root, domain: 'notebook' },
      { root: undefined }, { root: '' }, { root: '.' }, { root: root + '/..' }, { root: alias },
      { root: join(root, 'missing') }, Object.defineProperty({}, 'root', { get: () => assert.fail('never evaluate getter'), enumerable: true })];
    for (const input of bad) await assert.rejects(experimentConfig(input), error => error.code === 'INVALID_EXPERIMENT_CONFIG' || error.code === 'UNSAFE_TEST_ROOT');
    assert.deepEqual(await fs.readdir(root), []);
  } finally { await fs.unlink(alias); }
});
