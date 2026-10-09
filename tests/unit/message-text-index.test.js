import test from 'node:test';
import assert from 'node:assert/strict';
import { messageTextIndex, foldedTextMap } from '../../src/client/message-text-index.js';
import { prepareSelectionDraft } from '../../src/client/selection-draft.js';

// Narrow DOM stand-in; these tests are not browser selection/rendering proof.
const document = { createRange: () => ({
  setStart(node, offset) { this.startContainer = node; this.startOffset = offset; },
  setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; },
}) };
const text = data => ({ nodeType: 3, data });
const element = (tagName, ...childNodes) => ({ nodeType: 1, tagName, childNodes, ownerDocument: document });

test('inline, blocks, BR, code and emoji retain raw text and reversible text endpoints', () => {
  const first = text('原文 '), strong = text('粗体'), code = text('x  y'), last = text('😀尾部');
  const root = element('DIV', element('P', first, element('STRONG', strong), element('CODE', code)),
    element('P', last, element('BR'), text('下一行')));
  const index = messageTextIndex(root);
  assert.equal(index.text, '原文 粗体x  y\n😀尾部\n下一行');
  const selected = { startContainer: strong, startOffset: 0, endContainer: last, endOffset: 2 };
  const prepared = index.selection(selected, '粗体x  y\n😀');
  const range = index.range(prepared.startOffset, prepared.endOffset);
  assert.equal(range.startContainer, strong); assert.equal(range.endContainer, last);
  assert.equal(range.endOffset, 2);
  const identity = { sessionId: 's', messageId: 'm', role: 'assistant', committed: true };
  const draft = prepareSelectionDraft({ start: identity, end: identity, ...prepared });
  assert.equal(draft.ok, true); assert.equal(draft.draft.exact, '粗体x  y\n😀');
  assert.equal(draft.draft.format, 'plain_text');
});

test('rendered paragraph and list gaps keep the exact visible quote and reversible endpoints', () => {
  const first = text('子作用域可以继承祖先的注册内容，较近的同名注册可以遮蔽较远的注册。');
  const intro = text('因此可以做到：');
  const items = ['公共工具所有 Agent 可见。', '某个 Agent 有专属工具。',
    '不同 Agent 使用不同工具限制。', 'Agent 销毁后，专属注册一起撤销'].map(text);
  const root = element('DIV', element('P', first), element('P', intro),
    element('UL', ...items.map(item => element('LI', item))));
  root.innerText = `${first.data}\n\n${intro.data}\n\n${items.map(item => item.data).join('\n')}`;
  const index = messageTextIndex(root);
  const domText = `${first.data}\n${intro.data}\n${items.map(item => item.data).join('\n')}`;
  assert.equal(index.text, domText);
  const selected = { startContainer: first, startOffset: 0,
    endContainer: items.at(-1), endOffset: items.at(-1).data.length };
  assert.deepEqual(index.selection(selected, root.innerText),
    { exact: root.innerText, sourceText: domText, startOffset: 0, endOffset: domText.length, normalized: true });
  const restored = index.range(0, domText.length);
  assert.equal(restored.startContainer, first);
  assert.equal(restored.endContainer, items.at(-1));
  items.at(-1).data += 'changed';
  assert.throws(() => index.range(0, 2), { code: 'STALE_TEXT_INDEX' });
});

test('unrelated innerText content does not invalidate a DOM-backed selection', () => {
  const first = text('甲'), last = text('乙');
  const root = element('DIV', first, element('BUTTON', text('复制')), last);
  root.innerText = '甲额外内容乙';
  const index = messageTextIndex(root);
  assert.equal(index.text, '甲乙');
  assert.deepEqual(index.selection({ startContainer: first, startOffset: 0,
    endContainer: first, endOffset: 1 }, '甲'),
  { exact: '甲', sourceText: '甲乙', startOffset: 0, endOffset: 1 });
});

test('selection accepts only whitespace-equivalent browser text without falsifying indexed offsets', () => {
  const first = text('甲段'), last = text('乙段');
  const root = element('DIV', element('UL', element('LI', first)), element('P', last));
  root.innerText = '甲段\n\n乙段';
  const index = messageTextIndex(root);
  assert.deepEqual(index.selection({ startContainer: first, startOffset: 0,
    endContainer: last, endOffset: 2 }, '甲段\n乙段'),
  { exact: '甲段\n乙段', sourceText: '甲段\n乙段', startOffset: 0, endOffset: 5 });
  assert.deepEqual(index.selection({ startContainer: first, startOffset: 0,
    endContainer: last, endOffset: 2 }, root.innerText),
  { exact: root.innerText, sourceText: '甲段\n乙段', startOffset: 0, endOffset: 5, normalized: true });
  assert.throws(() => index.selection({ startContainer: first, startOffset: 0,
    endContainer: last, endOffset: 2 }, '甲段\n错字'), { code: 'UNMAPPABLE_RANGE' });
});

test('element boundaries map only within the indexed body; foreign and mismatching selections reject', () => {
  const a = text('甲乙'), b = text('丙丁'); const root = element('P', a, element('CODE', b));
  const index = messageTextIndex(root);
  assert.deepEqual(index.selection({ startContainer: root, startOffset: 0,
    endContainer: root, endOffset: 2 }, '甲乙丙丁'),
  { exact: '甲乙丙丁', sourceText: '甲乙丙丁', startOffset: 0, endOffset: 4 });
  for (const [range, exact] of [[{ startContainer: text('甲乙'), startOffset: 0,
    endContainer: b, endOffset: 2 }, '甲乙丙丁'],
  [{ startContainer: a, startOffset: 0, endContainer: b, endOffset: 2 }, 'changed']])
    assert.throws(() => index.selection(range, exact), { code: 'UNMAPPABLE_RANGE' });
});

test('block element endpoints normalize after synthetic gaps without including a preceding paragraph', () => {
  const a = text('甲乙'), b = text('丙丁');
  const first = element('P', a), second = element('P', element('STRONG', b));
  const root = element('DIV', first, second), index = messageTextIndex(root);
  for (const range of [{ startContainer: second, startOffset: 0, endContainer: second, endOffset: 1 },
    { startContainer: root, startOffset: 1, endContainer: root, endOffset: 2 }]) {
    assert.deepEqual(index.selection(range, '丙丁'),
      { exact: '丙丁', sourceText: '甲乙\n丙丁', startOffset: 3, endOffset: 5 });
  }
  root.childNodes[1] = element('P', b);
  assert.throws(() => index.range(3, 5), { code: 'STALE_TEXT_INDEX' });
});

test('reordered or replaced nodes invalidate old indexes even when visible text remains identical', () => {
  const a = text('重复'), b = text('重复'); const root = element('P', a, b);
  const index = messageTextIndex(root);
  root.childNodes.reverse();
  assert.throws(() => index.range(0, 2), { code: 'STALE_TEXT_INDEX' });
  root.childNodes = [text('重复'), b];
  assert.throws(() => index.range(0, 2), { code: 'STALE_TEXT_INDEX' });
});

test('excluded controls, changed content, synthetic gap endpoints and bounded work reject safely', () => {
  const a = text('甲乙'), b = text('丙丁');
  const root = element('DIV', element('P', a), element('BUTTON', text('UI')), element('P', b));
  const index = messageTextIndex(root);
  assert.equal(index.text, '甲乙\n丙丁');
  assert.throws(() => index.range(2, 4), { code: 'UNMAPPABLE_RANGE' });
  assert.throws(() => messageTextIndex(root, { maxTextUnits: 3 }), { code: 'TEXT_INDEX_LIMIT' });
  assert.throws(() => messageTextIndex(root, { maxNodes: 2 }), { code: 'TEXT_INDEX_LIMIT' });
  a.data = '变化';
  assert.throws(() => index.range(0, 2), { code: 'STALE_TEXT_INDEX' });
});

test('folded lookup maps CRLF, repeated spaces and emoji back to original UTF-16 offsets', () => {
  const raw = '😀甲\r\n  乙\t丙'; const map = foldedTextMap(raw);
  assert.equal(map.text, '😀甲 乙 丙');
  const begin = map.text.indexOf('甲'), end = map.text.indexOf('乙') + 1;
  const range = map.rawRange(begin, end);
  assert.equal(raw.slice(range.startOffset, range.endOffset), '甲\r\n  乙');
  assert.equal(map.rawRange(0, 2).endOffset, 2);
  assert.throws(() => map.rawRange(-1, 2), { code: 'UNMAPPABLE_RANGE' });
});
