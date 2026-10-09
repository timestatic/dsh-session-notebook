import test from 'node:test';
import assert from 'node:assert/strict';
import { closeOwned } from './close-owned.js';

test('failed early owned cleanup still attempts all subsequent steps and never claims success', async () => {
  const called = [];
  const code = await closeOwned([
    async () => { called.push('facility'); throw new Error('private path and secrets must not cross boundary'); },
    async () => { called.push('backend'); throw new Error('unknown commit'); },
    () => { called.push('unregister'); },
    async () => { called.push('raw'); },
    async () => { called.push('context'); },
  ]);
  assert.equal(code, 'CLOSE_FAILED');
  assert.deepEqual(called, ['facility', 'backend', 'unregister', 'raw', 'context']);
});

test('only full successful shutdown reports CLOSED_OK', async () => {
  assert.equal(await closeOwned([async () => {}, () => {}]), 'CLOSED_OK');
});
