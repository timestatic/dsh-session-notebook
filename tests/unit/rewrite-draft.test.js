import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareNoteDraft, prepareRewriteDraft } from '../../src/client/rewrite-draft.js';

test('note drafts start empty while rewrite drafts retain original Markdown', () => {
  const quote = Object.freeze({ format: 'markdown', content: '**强调**\r\n- 列表😀' });
  assert.deepEqual(prepareNoteDraft(quote), { ok: true, kind: 'note', bodyMarkdown: '' });
  assert.deepEqual(prepareRewriteDraft(quote), { ok: true, kind: 'manual', bodyMarkdown: quote.content });
  assert.equal(quote.content, '**强调**\r\n- 列表😀');
});

test('plain-text rewrite draft fences malicious markup and long backtick sequences literally', () => {
  const quote = Object.freeze({ format: 'plain_text', content: '<script>alert(1)</script>\n```js\n````\n中文😀' });
  const result = prepareRewriteDraft(quote);
  assert.deepEqual(result, { ok: true, kind: 'manual',
    bodyMarkdown: '`````text\n<script>alert(1)</script>\n```js\n````\n中文😀\n`````' });
  assert.equal(quote.content, '<script>alert(1)</script>\n```js\n````\n中文😀');
  const trailing = prepareRewriteDraft({ format: 'plain_text', content: '末尾\n' });
  assert.equal(trailing.bodyMarkdown, '```text\n末尾\n```');
});

test('invalid and empty quotes do not initialize savable drafts', () => {
  for (const quote of [undefined, { format: 'html', content: 'x' },
    { format: 'plain_text', content: '  \n' }, { format: 'markdown', content: 7 }]) {
    assert.deepEqual(prepareRewriteDraft(quote), { ok: false, reason: 'INVALID_QUOTE' });
    assert.deepEqual(prepareNoteDraft(quote), { ok: false, reason: 'INVALID_QUOTE' });
  }
});
