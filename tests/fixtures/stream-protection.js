import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';

// Test-only raw-byte copy. Caller supplies fixed, checked same-root paths.
export async function streamProtection(source, temporary, target, maximum, hook = {}) {
  if (!Number.isSafeInteger(maximum) || maximum < 0) throw new Error('INVALID_LIMIT');
  const checkAbort = () => hook.signal?.throwIfAborted();
  checkAbort();
  const before = await fs.lstat(source);
  if (!before.isFile() || before.size > maximum) throw Object.assign(new Error('UNSAFE_MEDIUM'), { code: 'UNSAFE_MEDIUM' });
  const input = await fs.open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
  let output;
  try {
    const identity = await input.stat();
    if (identity.dev !== before.dev || identity.ino !== before.ino || !identity.isFile() || identity.size > maximum) throw new Error('SOURCE_CHANGED');
    output = await fs.open(temporary, 'wx', 0o600);
    const buffer = Buffer.alloc(64 * 1024); const hash = createHash('sha256'); let position = 0;
    while (true) {
      checkAbort();
      const { bytesRead } = await input.read(buffer, 0, buffer.length, position);
      if (!bytesRead) break;
      if (position + bytesRead > maximum) throw new Error('COPY_LIMIT');
      hash.update(buffer.subarray(0, bytesRead));
      let written = 0;
      while (written < bytesRead) {
        const result = await output.write(buffer, written, bytesRead - written, position + written);
        if (!result.bytesWritten) throw new Error('COPY_NO_PROGRESS');
        written += result.bytesWritten;
      }
      position += bytesRead; await hook.afterChunk?.(position);
    }
    const after = await input.stat();
    if (after.size !== identity.size || position !== identity.size || after.mtimeMs !== identity.mtimeMs || after.ctimeMs !== identity.ctimeMs) throw new Error('SOURCE_CHANGED');
    await output.sync(); await output.close(); output = undefined;
    const verification = await fs.open(temporary, constants.O_RDONLY | constants.O_NOFOLLOW);
    const verifyHash = createHash('sha256'); let verified = 0;
    try {
      while (true) {
        checkAbort();
        const { bytesRead } = await verification.read(buffer, 0, buffer.length, verified);
        if (!bytesRead) break;
        verified += bytesRead; if (verified > maximum) throw new Error('VERIFY_LIMIT');
        verifyHash.update(buffer.subarray(0, bytesRead));
      }
    } finally { await verification.close(); }
    const digest = hash.digest('hex');
    if (verified !== position || verifyHash.digest('hex') !== digest) throw new Error('PROTECTION_FAILED');
    // No overwrite publish; leftover .partial files are never accepted as backups.
    checkAbort();
    await fs.link(temporary, target);
    // Retain the partial hardlink: deliberate no-delete test artifact, not shipped.
    return { bytes: position, sha256: digest, path: target };
  } finally { if (output) await output.close(); await input.close(); }
}
