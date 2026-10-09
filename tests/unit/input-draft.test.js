import test from 'node:test';
import assert from 'node:assert/strict';
import { currentInput, writeInput, MAX_INPUT_INSERT_BYTES } from '../../src/client/input-draft.js';

function source(state, calls) {
  const actions = { insertText: (text, span) => { calls.push({ text, span }); return true; } };
  return { adapter: { current: { getSnapshot: () => ({ key: 'session-1',
    hooks: { input: { getSnapshot: () => state } }, props: { inputActions: actions } }) } } };
}

test('append targets the end of the latest plain draft and never submits', () => {
  const state = { draft: 'hello', draftRev: 3, phase: 'plain', occurrences: [], attachmentIds: [] };
  const calls = [], ui = source(state, calls);
  assert.equal(currentInput(ui, 'session-1').state, state);
  assert.equal(currentInput(ui, 'another-session'), null);
  assert.deepEqual(writeInput(ui, 'session-1', '# note', 'append',
    { draft: 'hello', draftRev: 3 }), { ok: true });
  assert.deepEqual(calls, [{ text: '\n\n# note', span: { start: 5, end: 5, draftRev: 3 } }]);
});

test('append preserves reference chips by mapping clipboard to detect coordinates', () => {
  const draft = 'ask /file done';
  const calls = [], ui = source({ draft, draftRev: 5, phase: 'claimed', attachmentIds: ['a1'],
    occurrences: [{ offset: 4, length: 5, clipboardText: '/file' }] }, calls);
  assert.deepEqual(writeInput(ui, 'session-1', 'next', 'append',
    { draft, draftRev: 5 }), { ok: true });
  assert.deepEqual(calls, [{ text: '\n\nnext', span: { start: draft.length - 4,
    end: draft.length - 4, draftRev: 5 } }]);
  assert.deepEqual(writeInput(ui, 'session-1', 'next', 'replace',
    { draft, draftRev: 5 }), { ok: false, code: 'INPUT_UNAVAILABLE' });
});

test('replace requires the confirmed latest plain draft and valid text', () => {
  const state = { draft: 'old', draftRev: 2, phase: 'plain', occurrences: [], attachmentIds: [] };
  const calls = [], ui = source(state, calls);
  assert.deepEqual(writeInput(ui, 'session-1', 'new', 'replace',
    { draft: 'older', draftRev: 1 }), { ok: false, code: 'INPUT_CHANGED' });
  assert.deepEqual(writeInput(ui, 'session-1', '\uFFFC', 'replace',
    { draft: 'old', draftRev: 2 }), { ok: false, code: 'INPUT_INVALID' });
  assert.deepEqual(writeInput(ui, 'session-1', 'x'.repeat(MAX_INPUT_INSERT_BYTES + 1), 'replace',
    { draft: 'old', draftRev: 2 }), { ok: false, code: 'INPUT_INVALID' });
  assert.deepEqual(writeInput(ui, 'session-1', 'new', 'replace',
    { draft: 'old', draftRev: 2 }), { ok: true });
  assert.deepEqual(calls, [{ text: 'new', span: { start: 0, end: 3, draftRev: 2 } }]);
});

test('frozen, malformed or unmappable input never mutates the composer', () => {
  const calls = [];
  const state = { draft: 'ask /file', draftRev: 4, phase: 'submitting', attachmentIds: [],
    occurrences: [{ offset: 4, length: 5, clipboardText: '/file' }] };
  const ui = source(state, calls);
  assert.deepEqual(writeInput(ui, 'session-1', 'next', 'append',
    { draft: state.draft, draftRev: 4 }), { ok: false, code: 'INPUT_UNAVAILABLE' });
  state.phase = 'plain'; state.occurrences[0].clipboardText = 'wrong';
  assert.deepEqual(writeInput(ui, 'session-1', 'next', 'append',
    { draft: state.draft, draftRev: 4 }), { ok: false, code: 'INPUT_UNAVAILABLE' });
  assert.deepEqual(calls, []);
});
