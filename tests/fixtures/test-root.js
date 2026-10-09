import * as fs from 'node:fs/promises';
import { isAbsolute, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Test-only selector: never derive a production Profile, cwd or user-data location.
const base = resolve(fileURLToPath(new URL('../../.storage-test-output/', import.meta.url)));
const unsafe = () => Object.assign(new Error('UNSAFE_TEST_ROOT'), { code: 'UNSAFE_TEST_ROOT' });
export function isOwnedPrivateDirectory(entry, uid = process.getuid?.()) {
  return entry?.isDirectory() === true && (entry.mode & 0o777) === 0o700
    && (uid === undefined || entry.uid === uid);
}

export async function checkedTestRoot(root) {
  if (typeof root !== 'string' || !isAbsolute(root) || root !== resolve(root)) throw unsafe();
  const actualBase = await fs.realpath(base);
  // Only a private base owned by this process is a valid workspace sandbox.
  // Parent directory trust and a hostile same-UID process are separate, unresolved threats.
  const baseEntry = await fs.lstat(base);
  if (actualBase !== base || !isOwnedPrivateDirectory(baseEntry)) throw unsafe();
  if (root === actualBase || dirname(root) !== actualBase || !root.startsWith(`${actualBase}${sep}`)) throw unsafe();
  let entry;
  try { entry = await fs.lstat(root); }
  catch { throw unsafe(); }
  if (!isOwnedPrivateDirectory(entry)) throw unsafe();
  if (await fs.realpath(root) !== root) throw unsafe(); // Reject root symlinks and aliases.
  return root;
}
