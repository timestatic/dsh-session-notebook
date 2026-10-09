import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { checkedTestRoot } from './test-root.js';

// Test-only alternative medium: the Snapshot and generation share one SQLite row.
// Not a Cordis Storage backend, not a production recovery or multi-host protocol.
const [root, expectedText, nextText, value, mode, requestId = 'test-request'] = process.argv.slice(2);
try {
  const path = join(await checkedTestRoot(root), 'fenced-snapshot.sqlite');
  const db = new DatabaseSync(path);
  try {
    const expected = Number(expectedText); const next = Number(nextText);
    if (!Number.isSafeInteger(expected) || next !== expected + 1 || !['old', 'new'].includes(value)
      || !/^[a-z0-9-]{1,40}$/.test(requestId)) throw new Error('BAD_TEST_INPUT');
    const fingerprint = createHash('sha256').update(JSON.stringify([expected, next, value])).digest('hex');
    if (mode === 'paused') {
      // Deliberately read stale generation before the other process commits.
      if (db.prepare('SELECT generation FROM snapshot WHERE id = 1').get().generation !== expected) throw new Error('NOT_EXPECTED');
      process.send?.('READY');
      await new Promise(resolve => process.once('message', message => { if (message === 'GO') resolve(); }));
    }
    if (mode === 'busy-fast') db.exec('PRAGMA busy_timeout = 1');
    db.exec('BEGIN IMMEDIATE');
    try {
      if (mode === 'hold-transaction') {
        process.send?.('LOCKED');
        await new Promise(resolve => process.once('message', message => { if (message === 'GO') resolve(); }));
      }
      const receipt = db.prepare('SELECT fingerprint FROM receipts WHERE request_id = ?').get(requestId);
      if (receipt) {
        db.exec('ROLLBACK');
        process.send?.(receipt.fingerprint === fingerprint ? 'REPLAYED' : 'CONFLICT');
      } else {
        const result = db.prepare('UPDATE snapshot SET generation = ?, body = ? WHERE id = 1 AND generation = ?').run(next, value, expected);
        if (result.changes !== 1) {
          db.exec('ROLLBACK');
          process.send?.('REJECTED');
        } else {
          db.prepare('INSERT INTO receipts(request_id, fingerprint, generation) VALUES(?, ?, ?)').run(requestId, fingerprint, next);
          if (mode === 'abort-before-commit') throw new Error('SYNTHETIC_PRE_COMMIT_FAILURE');
          db.exec('COMMIT');
          if (mode === 'exit-after-commit') process.exit(78); // No ack after a durable-looking commit: parent must treat as unknown.
          process.send?.('COMMITTED');
        }
      }
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } finally { db.close(); }
} catch { process.send?.('FAILED'); process.exitCode = 1; }
