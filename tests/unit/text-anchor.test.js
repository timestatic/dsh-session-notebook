import test from 'node:test';
import assert from 'node:assert/strict';
import { locateTextAnchor } from '../../src/client/text-anchor.js';

test('an offset without surrounding context cannot identify one of repeated phrases', () => {
  const text = '😀重复。重复';
  assert.deepEqual(locateTextAnchor(text, { exact: '重复', startOffset: 5, endOffset: 7 }),
    { status: 'ambiguous' });
  assert.deepEqual(locateTextAnchor(text, { exact: '重复', startOffset: 2, endOffset: 4 }),
    { status: 'ambiguous' });
  assert.deepEqual(locateTextAnchor(text, { exact: '重复', startOffset: 5, endOffset: 7, prefix: '。' }),
    { status: 'found', startOffset: 5, endOffset: 7, match: 'offset' });
  assert.deepEqual(locateTextAnchor(text, { exact: '重复', startOffset: 5, endOffset: 7, prefix: '', suffix: '' }),
    { status: 'ambiguous' });
  assert.deepEqual(locateTextAnchor('甲重复。甲重复', {
    exact: '重复', startOffset: 1, endOffset: 3, prefix: '甲',
  }), { status: 'ambiguous' }, 'two matching contexts do not make the old offset authoritative');
});

test('unique context resolves a stale offset; ambiguous contexts never guess', () => {
  const text = '重复。甲重复。乙重复';
  assert.deepEqual(locateTextAnchor(text, { exact: '重复', startOffset: 999, endOffset: 1001, prefix: '甲', suffix: '。乙' }),
    { status: 'found', startOffset: 4, endOffset: 6, match: 'context' });
  assert.deepEqual(locateTextAnchor('重复。重复', { exact: '重复', prefix: '', suffix: '' }), { status: 'ambiguous' });
  assert.deepEqual(locateTextAnchor(text, { exact: '重复', prefix: '不存在' }), { status: 'ambiguous' });
  assert.deepEqual(locateTextAnchor('完全改变', { exact: '重复' }), { status: 'missing' });
  assert.deepEqual(locateTextAnchor('重复', { exact: '重复', prefix: '前文' }), { status: 'missing' });
  assert.deepEqual(locateTextAnchor('重复', { exact: '重复', suffix: '后文' }), { status: 'missing' });
  assert.deepEqual(locateTextAnchor('重复。重复', { exact: '重复', prefix: '超出整个文本的上下文' }),
    { status: 'ambiguous' });
});

test('an unchanged exact word at the old offset does not override changed context', () => {
  assert.deepEqual(locateTextAnchor('def foo xyz', {
    exact: 'foo', startOffset: 4, endOffset: 7, prefix: 'abc ', suffix: ' xyz',
  }), { status: 'missing' });
  assert.deepEqual(locateTextAnchor('bad foo. good foo.', {
    exact: 'foo', startOffset: 4, endOffset: 7, prefix: 'good ', suffix: '.',
  }), { status: 'found', startOffset: 14, endOffset: 17, match: 'context' });
});

test('occurrence and unique fallbacks do not fabricate matches or ignore contradictory context', () => {
  const text = '重复。重复';
  assert.deepEqual(locateTextAnchor(text, { exact: '重复' }), { status: 'ambiguous' });
  assert.deepEqual(locateTextAnchor(text, { exact: '重复', occurrence: 1 }),
    { status: 'ambiguous' }, 'an ordinal alone cannot prove duplicates did not shift');
  assert.deepEqual(locateTextAnchor('唯一', { exact: '唯一' }),
    { status: 'found', startOffset: 0, endOffset: 2, match: 'unique' });
  assert.deepEqual(locateTextAnchor('唯一', { exact: '唯一', occurrence: 2 }), { status: 'missing' });
  assert.deepEqual(locateTextAnchor('唯一', { exact: '唯一', prefix: '旧前文' }), { status: 'missing' });
});

test('malformed offsets and contexts fail closed', () => {
  const text = '前文😀尾部';
  for (const anchor of [null, { exact: '' }, { exact: '😀', startOffset: 2 },
    { exact: '😀', startOffset: -1, endOffset: 3 },
    { exact: '😀', startOffset: 3, endOffset: 2 },
    { exact: '😀', prefix: null }, { exact: '😀', occurrence: -1 }]) {
    assert.deepEqual(locateTextAnchor(text, anchor), { status: 'invalid' });
  }
  assert.deepEqual(locateTextAnchor(text, { exact: '😀', startOffset: 2, endOffset: 4 }),
    { status: 'found', startOffset: 2, endOffset: 4, match: 'unique' });
});
