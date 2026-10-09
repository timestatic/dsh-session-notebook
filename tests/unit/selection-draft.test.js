import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSelectionDraft } from '../../src/client/selection-draft.js';

const endpoint = (overrides = {}) => ({
  sessionId: 'synthetic-session', messageId: 'synthetic-message', role: 'assistant', committed: true,
  ...overrides,
});
const candidate = (overrides = {}) => ({
  start: endpoint(), end: endpoint(), exact: '原文😀', sourceText: '开头原文😀末尾',
  startOffset: 2, endOffset: 6, ...overrides,
});

test('only same committed user/assistant message may create a non-persistent draft', () => {
  const prepared = prepareSelectionDraft(candidate());
  assert.equal(prepared.ok, true);
  assert.deepEqual(prepared.draft, {
    sessionId: 'synthetic-session', messageId: 'synthetic-message', role: 'assistant',
    exact: '原文😀', format: 'plain_text',
    anchor: { startOffset: 2, endOffset: 6, prefix: '开头', suffix: '末尾' },
  });
  assert.equal(Object.isFrozen(prepared.draft), true);
  assert.equal(Object.isFrozen(prepared.draft.anchor), true);
  for (const overrides of [
    { end: endpoint({ sessionId: 'other-session' }) },
    { end: endpoint({ messageId: 'other-message' }) },
    { end: endpoint({ role: 'user' }) },
    { start: endpoint({ role: 'tool' }) },
    { start: endpoint({ committed: false }) },
    { end: endpoint({ messageId: '' }) },
  ]) {
    assert.deepEqual(prepareSelectionDraft(candidate(overrides)), { ok: false, reason: 'UNVERIFIED_MESSAGE' });
  }
});

test('Unicode limits count code points without truncation and preserve selected whitespace', () => {
  const long = '😀'.repeat(8000);
  assert.equal(prepareSelectionDraft(candidate({ exact: long, sourceText: undefined,
    startOffset: undefined, endOffset: undefined })).draft.exact, long);
  assert.deepEqual(prepareSelectionDraft(candidate({ exact: long + '😀' })), { ok: false, reason: 'TOO_LONG' });
  assert.deepEqual(prepareSelectionDraft(candidate({ exact: '😀' })), { ok: false, reason: 'TOO_SHORT' });
  assert.deepEqual(prepareSelectionDraft(candidate({ exact: ' \n ' })), { ok: false, reason: 'EMPTY_SELECTION' });
  assert.deepEqual(prepareSelectionDraft(candidate({ exact: '字   \n\t' })), { ok: false, reason: 'TOO_SHORT' });
  for (const exact of ['e\u0301', '🧑‍💻', '字\u200d', '\u0301\u0301']) {
    assert.equal(prepareSelectionDraft(candidate({ exact, sourceText: exact,
      startOffset: 0, endOffset: exact.length })).draft.exact, exact);
  }
  assert.equal(prepareSelectionDraft(candidate({ exact: 'e\u0301字', sourceText: undefined,
    startOffset: undefined, endOffset: undefined })).draft.exact, 'e\u0301字');
  assert.deepEqual(prepareSelectionDraft(candidate({ exact: '😀 \n字' , sourceText: undefined,
    startOffset: undefined, endOffset: undefined })).draft.exact, '😀 \n字');
  const whitespace = '  行一\n\n  行二  ';
  assert.equal(prepareSelectionDraft(candidate({ exact: whitespace,
    sourceText: undefined, startOffset: undefined, endOffset: undefined })).draft.exact, whitespace);
  assert.deepEqual(prepareSelectionDraft(candidate(), { maxQuoteLength: 1 }), { ok: false, reason: 'INVALID_LIMIT' });
});

test('offsets are accepted only if exact UTF-16 source slice matches; no guessed Markdown', () => {
  for (const overrides of [
    { startOffset: 0, endOffset: 2 },
    { startOffset: 2, endOffset: 5 },
    { startOffset: -1 },
    { startOffset: 6, endOffset: 2 },
    { startOffset: 2, endOffset: 999 },
    { sourceText: undefined },
    { endOffset: undefined },
  ]) {
    assert.deepEqual(prepareSelectionDraft(candidate(overrides)), { ok: false, reason: 'UNVERIFIED_OFFSET' });
  }
  const withoutOffsets = prepareSelectionDraft(candidate({ sourceText: undefined,
    startOffset: undefined, endOffset: undefined }));
  assert.equal(withoutOffsets.ok, true);
  assert.equal(withoutOffsets.draft.anchor, null);
  assert.equal(withoutOffsets.draft.format, 'plain_text');
});
