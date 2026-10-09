import { notebookSchema } from './notebook-schema.js';

const fail = code => { throw Object.assign(new Error(code), { code }); };

// Host-side candidate only. The caller must still recheck the current medium,
// protect its original bytes, and commit in the single mutation queue.
export function prepareBackupReplacement(current, inspected, { newEpoch } = {}) {
  const existing = notebookSchema.parse(current);
  if (!inspected || !Object.hasOwn(inspected, 'snapshot')) fail('INVALID_BACKUP');
  const incoming = notebookSchema.parse(inspected.snapshot);
  if (newEpoch === existing.epoch || newEpoch === incoming.epoch) fail('VALIDATION_FAILED');
  return notebookSchema.parse({ ...incoming, epoch: newEpoch,
    revision: existing.revision + 1, operationReceipts: {} });
}
