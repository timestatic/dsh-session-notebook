import { after } from 'node:test';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkedTestRoot } from './test-root.js';

// File-scoped test roots are released after every test in the importing file,
// including failed tests. The selector never accepts caller-provided paths.
const base = fileURLToPath(new URL('../../.storage-test-output/', import.meta.url));
const created = new Set();

after(async () => {
  const outcomes = await Promise.allSettled([...created].map(async root => {
    await checkedTestRoot(root);
    await fs.rm(root, { recursive: true });
    created.delete(root);
  }));
  const failures = outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason);
  if (failures.length) throw new AggregateError(failures, 'TEST_ROOT_CLEANUP_FAILED');
});

export async function autoTestRoot(prefix) {
  if (typeof prefix !== 'string' || !/^[a-z][a-z0-9-]{0,40}-$/.test(prefix))
    throw new TypeError('INVALID_TEST_PREFIX');
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const root = await fs.mkdtemp(join(base, prefix));
  created.add(root);
  return root;
}
