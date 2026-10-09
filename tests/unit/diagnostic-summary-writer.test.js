import test from 'node:test';
import assert from 'node:assert/strict';
import { createSummaryWriter } from '../../diagnostics/desktop-http-observer/summary-writer.js';

function fakeIo({ failAt } = {}) {
  const calls = []; const files = new Map(); let writes = 0;
  return { calls, files, io: {
    async writeFile(path, content, options) {
      calls.push(['write', path, content, options]);
      if (++writes === failAt) throw Error('secret I/O detail');
      files.set(path, content);
    },
    async rename(source, target) { calls.push(['rename', source, target]); files.set(target, files.get(source)); files.delete(source); },
  } };
}
test('summary writes are async, ordered, bounded and contain only fixed safe fields', async () => {
  const f = fakeIo(); const writer = createSummaryWriter('/explicit/workspace/result.json', f.io);
  for (let i = 0; i < 40; i++) writer.record(i === 0 ? 'secret' : 200);
  assert.equal(f.calls.length, 0, 'record must not synchronously call I/O');
  assert.deepEqual(await writer.flush(), { runId: writer.runId, failed: false });
  const value = JSON.parse(f.files.get('/explicit/workspace/result.json'));
  assert.deepEqual(Object.keys(value), ['runId', 'records']);
  assert.equal(value.records.length, 32);
  assert.deepEqual(value.records[0], { count: 1, status: 0 });
  assert.deepEqual(value.records[31], { count: 32, status: 200 });
  for (let i = 0; i < f.calls.length; i += 2) {
    assert.equal(f.calls[i][0], 'write'); assert.equal(f.calls[i + 1][0], 'rename');
    assert.equal(f.calls[i][3].mode, 0o600);
  }
});
test('write failure is isolated, fixed result does not expose I/O detail, and stops further writes', async () => {
  const f = fakeIo({ failAt: 1 }); const writer = createSummaryWriter('/explicit/result.json', f.io);
  writer.record(200); writer.record(503);
  assert.deepEqual(await writer.flush(), { runId: writer.runId, failed: true });
  assert.equal(f.calls.length, 1); assert.equal(f.files.has('/explicit/result.json'), false);
  await writer.close(); writer.record(200); assert.equal(f.calls.length, 1);
});
test('new run has different identity and empty initialization; old records cannot imply new PASS', async () => {
  const f = fakeIo(); const first = createSummaryWriter('/explicit/result.json', f.io);
  first.record(200); await first.close();
  const second = createSummaryWriter('/explicit/result.json', f.io);
  assert.notEqual(first.runId, second.runId); await second.flush();
  assert.deepEqual(JSON.parse(f.files.get('/explicit/result.json')), { runId: second.runId, records: [] });
  await second.close(); second.record(200);
  assert.equal(JSON.parse(f.files.get('/explicit/result.json')).records.length, 0);
});
test('rename rejection is isolated and no success is reported', async () => {
  const f = fakeIo(); f.io.rename = async () => { throw Error('private path'); };
  const writer = createSummaryWriter('/explicit/result.json', f.io);
  writer.record(200); assert.equal((await writer.close()).failed, true);
  assert.equal(f.files.has('/explicit/result.json'), false);
});
