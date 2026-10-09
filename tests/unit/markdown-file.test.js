import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownFile, downloadMarkdownFile, MAX_MARKDOWN_FILE_BYTES } from '../../src/client/markdown-file.js';

test('Markdown file preserves UTF-8 content and releases the temporary URL', async () => {
  const content = '# 标题\n\n原文 😀\n';
  const file = markdownFile({ revision: 7, count: 1, content,
    bytes: new TextEncoder().encode(content).byteLength }, { date: new Date(2026, 9, 7, 15, 5, 9) });
  assert.equal(file.filename, 'dsh-session-notebook-rev-7-20261007150509.md');
  assert.equal(file.blob.type, 'text/markdown;charset=utf-8');
  assert.equal(await file.blob.text(), content);
  const events = [];
  downloadMarkdownFile(file, { document: { createElement: () => ({ click() {
    events.push(['click', this.href, this.download]);
  } }) }, URL: { createObjectURL: blob => {
    assert.equal(blob, file.blob); events.push(['create']); return 'blob:local';
  }, revokeObjectURL: value => events.push(['revoke', value]) } });
  assert.deepEqual(events, [['create'], ['click', 'blob:local', file.filename], ['revoke', 'blob:local']]);
});

test('Markdown file rejects invalid bytes and releases the URL when click fails', () => {
  assert.throws(() => markdownFile({ revision: 1, count: 1, content: '😀', bytes: 2 }),
    { code: 'INVALID_MARKDOWN_FILE' });
  assert.throws(() => markdownFile({ revision: 1, count: 1, content: 'x',
    bytes: MAX_MARKDOWN_FILE_BYTES + 1 }), { code: 'INVALID_MARKDOWN_FILE' });
  const file = markdownFile({ revision: 1, count: 1, content: 'x', bytes: 1 });
  const events = [];
  assert.throws(() => downloadMarkdownFile(file, { document: { createElement: () => ({
    click: () => { throw new Error('private path'); },
  }) }, URL: { createObjectURL: () => 'blob:local', revokeObjectURL: value => events.push(value) } }),
  /private path/);
  assert.deepEqual(events, ['blob:local']);
});

test('repeated exports of the same revision include seconds without changing content', async () => {
  const value = { revision: 7, count: 1, content: '正文', bytes: 6 };
  const first = markdownFile(value, { date: new Date(2026, 9, 7, 15, 5, 9) });
  const second = markdownFile(value, { date: new Date(2026, 9, 7, 15, 5, 10) });
  assert.equal(first.filename, 'dsh-session-notebook-rev-7-20261007150509.md');
  assert.equal(second.filename, 'dsh-session-notebook-rev-7-20261007150510.md');
  assert.equal(await second.blob.text(), value.content);
});
