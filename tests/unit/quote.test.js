import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareQuote } from '../../src/client/quote.js';

const cases = JSON.parse(await readFile(new URL('../fixtures/selection-cases.json', import.meta.url), 'utf8')).cases;

test('unverified source always preserves selected text exactly as plain_text', () => {
  for (const sample of cases.filter(sample => sample.id !== 'SEL-012')) {
    const result = prepareQuote(sample.visibleSelection, { markdown: sample.sourceMarkdown,
      startOffset: 0, endOffset: sample.sourceMarkdown.length, renderedExact: sample.visibleSelection });
    assert.deepEqual(result, { ok: true, quote: { format: 'plain_text', content: sample.visibleSelection } }, sample.id);
  }
  assert.deepEqual(prepareQuote(''), { ok: false, reason: 'INVALID_SELECTION' });
});

test('trusted exact range and proven semantics may preserve original Markdown bytes', () => {
  const markdown = '之前\r\n**重要结论**\r\n之后';
  const content = '**重要结论**';
  const startOffset = markdown.indexOf(content);
  const result = prepareQuote('重要结论', { verified: true, markdown,
    startOffset, endOffset: startOffset + content.length,
    renderedExact: '重要结论', syntaxPreserved: true });
  assert.deepEqual(result, { ok: true, quote: { format: 'markdown', content } });
  assert.equal(Object.isFrozen(result.quote), true);
});

test('partial markup, changed visible text and unsafe raw source fail closed', () => {
  const exact = '开发';
  const source = '查看 [开发指南](https://example.invalid)。';
  const start = source.indexOf(exact);
  for (const sourceInput of [
    { verified: true, markdown: source, startOffset: start, endOffset: start + exact.length,
      renderedExact: exact, syntaxPreserved: false },
    { verified: true, markdown: source, startOffset: start, endOffset: start + exact.length,
      renderedExact: '其他', syntaxPreserved: true },
    { verified: true, markdown: source, startOffset: -1, endOffset: 5,
      renderedExact: exact, syntaxPreserved: true },
    { verified: true, markdown: '<img src=x onerror=alert(1)>', startOffset: 0,
      endOffset: '<img src=x onerror=alert(1)>'.length,
      renderedExact: exact, syntaxPreserved: true },
    { verified: true, markdown: '[x](javascript:alert(1))', startOffset: 0,
      endOffset: '[x](javascript:alert(1))'.length,
      renderedExact: exact, syntaxPreserved: true },
  ]) {
    assert.deepEqual(prepareQuote(exact, sourceInput), { ok: true, quote: { format: 'plain_text', content: exact } });
  }
});

test('line endings, indentation and Unicode are not normalized on plain fallback', () => {
  const selected = '第一行\r\n\n  😀e\u0301  ';
  assert.equal(prepareQuote(selected, null).quote.content, selected);
  const source = '源\r\n**行**';
  assert.deepEqual(prepareQuote('行', { verified: true, markdown: source, startOffset: 3, endOffset: 8,
    renderedExact: '行', syntaxPreserved: false }), { ok: true, quote: { format: 'plain_text', content: '行' } });
});
