import { writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// This module owns only the explicitly supplied diagnostic target, never a Profile/Domain.
// Caller must retain runId and verify it when reading; an old file is not fresh evidence.
export function createSummaryWriter(target, io = { writeFile, rename }) {
  const runId = randomUUID();
  const temporary = `${target}.${runId}.tmp`;
  const records = [];
  let closed = false;
  let failed = false;
  let queue = Promise.resolve();
  const enqueue = () => {
    const content = JSON.stringify({ runId, records: records.map(record => ({ ...record })) });
    queue = queue.then(async () => {
      if (failed) return;
      try {
        await io.writeFile(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'w' });
        await io.rename(temporary, target);
      } catch { failed = true; }
    });
  };
  enqueue(); // Reset persisted records for this run; failure never claims readiness.
  return {
    runId,
    record(status) {
      if (closed || records.length >= 32) return;
      const safeStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
      records.push({ count: records.length + 1, status: safeStatus });
      enqueue();
    },
    async flush() { await queue; return { runId, failed }; },
    async close() { closed = true; await queue; return { runId, failed }; },
  };
}
