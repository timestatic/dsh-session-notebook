import { readBackupFile } from './backup-file.js';

const CHUNK_BYTES = 128 * 1024;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

function base64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return globalThis.btoa(binary);
}

async function cancellable(promise, signal) {
  if (signal.aborted) fail('CANCELLED');
  let rejectCancelled;
  const cancelled = new Promise((_resolve, reject) => { rejectCancelled = reject; });
  const onAbort = () => rejectCancelled(Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' }));
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    if (signal.aborted) onAbort();
    return await Promise.race([promise, cancelled]);
  } finally { signal.removeEventListener('abort', onAbort); }
}

/** Validate locally, then have the admitted Host validate the same file again.
 * Retries use one uploadId and resume from the Host's reported byte offset. */
export async function stageBackupFile(file, api, { uploadId, signal, onToken } = {}) {
  if (!(file instanceof Blob) || !id(uploadId) || !signal || typeof api?.backupBegin !== 'function'
    || typeof api.backupChunk !== 'function' || typeof api.backupFinish !== 'function'
    || typeof api.backupPreview !== 'function' || (onToken !== undefined && typeof onToken !== 'function'))
    fail('INVALID_BACKUP');
  await readBackupFile(file, { signal });
  if (signal.aborted) fail('CANCELLED');
  const count = Math.ceil(file.size / CHUNK_BYTES);
  const started = await api.backupBegin({ uploadId, bytes: file.size }, signal);
  if (!id(started?.token) || !Number.isSafeInteger(started.nextIndex)
    || started.nextIndex < 0 || started.nextIndex > count
    || started.receivedBytes !== Math.min(started.nextIndex * CHUNK_BYTES, file.size))
    fail('INVALID_RESPONSE');
  onToken?.(started.token);
  for (let index = started.nextIndex; index < count; index++) {
    if (signal.aborted) fail('CANCELLED');
    const end = Math.min((index + 1) * CHUNK_BYTES, file.size);
    const part = new Uint8Array(await cancellable(file.slice(index * CHUNK_BYTES, end).arrayBuffer(), signal));
    if (part.byteLength !== end - index * CHUNK_BYTES) fail('INVALID_BACKUP');
    const receipt = await api.backupChunk({ token: started.token, index, base64: base64(part) }, signal);
    if (receipt?.token !== started.token || receipt.nextIndex !== index + 1
      || receipt.receivedBytes !== end) fail('INVALID_RESPONSE');
  }
  const finished = await api.backupFinish({ token: started.token }, signal);
  if (finished?.token !== started.token || finished.receivedBytes !== file.size
    || finished.nextIndex !== count) fail('INVALID_RESPONSE');
  const preview = await api.backupPreview({ token: started.token }, signal);
  if (preview?.token !== started.token) fail('INVALID_RESPONSE');
  return { token: started.token, summary: finished.summary, preview };
}
