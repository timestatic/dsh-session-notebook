import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadTimestamp } from '../../src/client/download-timestamp.js';

test('download timestamps use local calendar time with zero padding and seconds', () => {
  assert.equal(downloadTimestamp(new Date(2026, 9, 7, 15, 5, 9)), '20261007150509');
  assert.equal(downloadTimestamp(new Date(2026, 0, 1, 0, 0, 0)), '20260101000000');
  assert.equal(downloadTimestamp(new Date(2026, 11, 31, 23, 59, 59)), '20261231235959');
  assert.match(downloadTimestamp(), /^\d{14}$/);
});

test('invalid or unbounded dates cannot produce invalid download filenames', () => {
  for (const date of [new Date(NaN), null, '2026-10-07', new Date('10000-01-01T00:00:00Z')])
    assert.throws(() => downloadTimestamp(date), { code: 'INVALID_DOWNLOAD_TIME' });
});
