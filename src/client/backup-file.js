import { inspectBackupJson, DEFAULT_BACKUP_BYTES } from '../json-backup.js';
import { downloadTimestamp } from './download-timestamp.js';

const fail = () => { throw Object.assign(new Error('INVALID_BACKUP'), { code: 'INVALID_BACKUP' }); };
const failure = code => { throw Object.assign(new Error(code), { code }); };

/** Reject an oversized local file before loading any of its bytes into memory. */
export async function readBackupFile(file, { maxBytes = DEFAULT_BACKUP_BYTES, signal } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !(file instanceof Blob)
    || !Number.isSafeInteger(file.size) || file.size < 0) fail();
  if (file.size > maxBytes) failure('BACKUP_TOO_LARGE');
  if (signal?.aborted) failure('CANCELLED');
  const reading = file.text();
  let content;
  if (signal) {
    let rejectCancelled;
    const cancelled = new Promise((_resolve, reject) => { rejectCancelled = reject; });
    const onAbort = () => rejectCancelled(Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' }));
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      if (signal.aborted) onAbort();
      content = await Promise.race([reading, cancelled]);
    } finally { signal.removeEventListener('abort', onAbort); }
  } else content = await reading;
  if (signal?.aborted) failure('CANCELLED');
  return inspectBackupJson(content, { declaredBytes: file.size, maxBytes });
}

/** Build a complete UTF-8 JSON file without modifying the live Notebook. */
export function backupFile(backup, { maxBytes = DEFAULT_BACKUP_BYTES, date = new Date() } = {}) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)
    || typeof backup.content !== 'string' || !Number.isSafeInteger(backup.bytes)
    || !Number.isSafeInteger(backup.revision)) fail();
  // inspectBackupJson validates byte length, complete format and every field and association.
  const inspected = inspectBackupJson(backup.content, { declaredBytes: backup.bytes, maxBytes });
  if (inspected.snapshot.revision !== backup.revision) fail();
  return { filename: `dsh-session-notebook-rev-${backup.revision}-${downloadTimestamp(date)}.json`,
    blob: new Blob([backup.content], { type: 'application/json;charset=utf-8' }), bytes: backup.bytes };
}

/** The caller owns its trusted document and must invoke this from a user action. */
export function downloadBackupFile(file, { document, URL } = {}) {
  if (!file || typeof file.filename !== 'string' || !/^dsh-session-notebook-rev-\d+-\d{14}\.json$/.test(file.filename)
    || !(file.blob instanceof Blob) || file.blob.type !== 'application/json;charset=utf-8'
    || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > DEFAULT_BACKUP_BYTES
    || file.blob.size !== file.bytes
    || typeof document?.createElement !== 'function' || typeof URL?.createObjectURL !== 'function'
    || typeof URL?.revokeObjectURL !== 'function') fail();
  const anchor = document.createElement('a');
  if (typeof anchor?.click !== 'function') fail();
  const href = URL.createObjectURL(file.blob);
  try {
    anchor.href = href;
    anchor.download = file.filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(href);
  }
}
