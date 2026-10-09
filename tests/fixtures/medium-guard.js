import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { streamProtection } from './stream-protection.js';

// Approved TEST-ONLY primitive; not installed, not a backend registration.
// Stable lock persists after crash; no time/PID-based stealing, no auto repair.
const base = resolve(fileURLToPath(new URL('../../.storage-test-output/', import.meta.url)));
function error(code) { return Object.assign(new Error(code), { code }); }
async function checkedRoot(root) {
  const actual = await fs.realpath(root);
  const actualBase = await fs.realpath(base);
  if (!actual.startsWith(`${actualBase}${sep}`)) throw error('UNSAFE_TEST_ROOT');
  return actual;
}
async function readRegular(path, maximum) {
  const before = await fs.lstat(path);
  if (!before.isFile() || before.size > maximum) throw error('UNSAFE_MEDIUM');
  const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size > maximum) throw error('UNSAFE_MEDIUM');
    // Bound allocation even if the source grows after stat; one extra byte detects growth.
    const buffer = Buffer.alloc(maximum + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > maximum) throw error('UNSAFE_MEDIUM');
    return { bytes: buffer.subarray(0, offset), identity: opened };
  } finally { await handle.close(); }
}
export async function acquireMedium(root, testHooks = {}) {
  const actual = await checkedRoot(root);
  const lock = join(actual, 'notebook.writer.lock');
  const syncDirectory = async stage => {
    await testHooks.beforeDirectorySync?.(stage);
    const directory = await fs.open(actual, 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  };
  let handle;
  try { handle = await fs.open(lock, 'wx', 0o600); }
  catch (cause) { if (cause.code === 'EEXIST') throw error('WRITER_EXISTS'); throw error('LOCK_FAILED'); }
  const ownerIdentity = await handle.stat();
  const token = randomUUID();
  // Initialization failure leaves an exclusive residual lock, never unsafe removal.
  try { await handle.writeFile(token, 'utf8'); await handle.sync(); }
  catch { throw error('LOCK_FAILED'); }
  finally { await handle.close(); }
  try { await syncDirectory('acquire'); }
  catch { throw error('LOCK_FAILED'); } // Residual lock stays fail-closed.
  let released = false;
  let releaseUnknown = false;
  let closing = false;
  let chain = Promise.resolve();
  const enqueue = operation => {
    const result = chain.then(operation);
    chain = result.then(() => {}, () => {});
    return result;
  };
  const checkOwner = async () => {
    if (await checkedRoot(root) !== actual) throw error('UNSAFE_TEST_ROOT');
    let current;
    try { current = await readRegular(lock, 128); }
    catch { throw error('LOCK_OWNERSHIP_LOST'); }
    if (current.identity.dev !== ownerIdentity.dev || current.identity.ino !== ownerIdentity.ino
      || current.bytes.toString('utf8') !== token) throw error('LOCK_OWNERSHIP_LOST');
  };
  return {
    // Detect an ownership loss already visible before a write; not an atomic publish fence.
    assertOwner() {
      if (closing || released) return Promise.reject(error('GUARD_CLOSED'));
      return enqueue(checkOwner);
    },
    protect() {
      if (closing || released) return Promise.reject(error('GUARD_CLOSED'));
      return enqueue(async () => {
      await checkOwner();
      const source = join(actual, 'notebook.json');
      const target = join(actual, `notebook.protected-${randomUUID()}.json`);
      // Fixed same-root paths; no caller-controlled path, preserve corrupt raw bytes.
      const result = await streamProtection(source, `${target}.partial`, target,
        testHooks.maximumBytes ?? 1024 * 1024, testHooks.copyHooks);
      await checkOwner();
      await syncDirectory('protect');
      return result;
      });
    },
    release() {
      closing = true;
      return enqueue(async () => {
      if (releaseUnknown) throw error('RELEASE_UNKNOWN');
      if (released) return;
      // Verify exact absolute intended target and exclusive owner before deletion.
      if (lock !== join(await checkedRoot(root), 'notebook.writer.lock')) throw error('UNSAFE_TEST_ROOT');
      await checkOwner();
      // Test-only offline-first policy: stop this owner without deleting the lock.
      // No automatic restart is possible; only separately authorized offline recovery may clear it.
      if (testHooks.retainLockOnClose === true) throw error('OFFLINE_RECOVERY_REQUIRED');
      await fs.unlink(lock);
      released = true;
      // A failed directory sync after unlink cannot prove exclusion; never report a clean shutdown.
      try { await syncDirectory('release'); }
      catch { releaseUnknown = true; throw error('RELEASE_UNKNOWN'); }
      });
    },
  };
}
