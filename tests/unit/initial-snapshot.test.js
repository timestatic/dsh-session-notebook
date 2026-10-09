import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSnapshot } from '../../src/initial-snapshot.js';
import { notebookSchema } from '../../src/notebook-schema.js';

test('a new library has one stable set of ordinary built-in quick tags and a fresh epoch', () => {
  const time = '2026-10-06T00:00:00.000Z';
  const first = createInitialSnapshot({ epoch: 'first-epoch', time });
  const second = createInitialSnapshot({ epoch: 'second-epoch', time });
  assert.deepEqual(first, notebookSchema.parse(first));
  assert.equal(first.revision, 0);
  assert.deepEqual(first.notes, {});
  assert.deepEqual(first.operationReceipts, {});
  assert.deepEqual(first.settings.quickTagIds,
    ['builtin_todo', 'builtin_important', 'builtin_verify']);
  assert.deepEqual(first.settings.quickTagIds, second.settings.quickTagIds);
  assert.deepEqual(first.settings.quickTagIds.map(id => first.tags[id].name),
    ['TODO', '重要', '待验证']);
  for (const tag of Object.values(first.tags)) {
    assert.equal(tag.isBuiltin, true);
    assert.equal(tag.createdAt, time);
    assert.equal(tag.updatedAt, time);
    assert.equal(tag.version, 1);
  }
  assert.equal(second.epoch, 'second-epoch');
  assert.notEqual(first.epoch, second.epoch);
});

test('initial factory rejects an invalid epoch or clock value before any medium write', () => {
  assert.throws(() => createInitialSnapshot({ epoch: 'bad epoch' }), { code: 'VALIDATION_FAILED' });
  assert.throws(() => createInitialSnapshot({ time: 'not-a-date' }), { code: 'VALIDATION_FAILED' });
});
