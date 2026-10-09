import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { createSummaryWriter } from '../../diagnostics/desktop-http-observer/summary-writer.js';
import { observe } from '../../diagnostics/desktop-http-observer/index.js';

test('workspace medium writes isolated simulated evidence and unload waits for writer', async () => {
  // Never use result.json. These fixtures are explicitly synthetic, not Desktop HTTP proof.
  const directory = new URL('../../.diagnostic-test-output/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const target = fileURLToPath(new URL(`synthetic-${randomUUID()}.json`, directory));
  const writer = createSummaryWriter(target);
  const disposers = []; let listener;
  observe({ logger: () => ({ info() {} }), effect: setup => disposers.push(setup()),
    on: (_, fn) => { listener = fn; disposers.push(() => { listener = null; }); } }, writer);
  const res = new EventEmitter(); res.statusCode = 200;
  assert.equal(await listener({ method: 'POST', url: '/api/settings/describe' }, res, async () => 'gateway'), 'gateway');
  res.emit('finish');
  for (const dispose of disposers.reverse()) await dispose();
  const persisted = JSON.parse(await readFile(target, 'utf8'));
  assert.deepEqual(persisted, { runId: writer.runId, records: [{ count: 1, status: 200 }] });
  assert.equal((await stat(target)).mode & 0o777, 0o600);
  writer.record(500); await writer.flush();
  assert.deepEqual(JSON.parse(await readFile(target, 'utf8')), persisted);
});
