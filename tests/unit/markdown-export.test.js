import test from 'node:test';
import assert from 'node:assert/strict';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { exportMarkdown, markdownExportFilename } from '../../src/markdown-export.js';

test('exports selected records once in explicit order without changing the source', () => {
  const snapshot = notebookFixture();
  snapshot.revision = 7;
  snapshot.notes.n1.title = '恶意\n# 标题 [link](javascript:bad)';
  snapshot.notes.n1.source.workspacePath = '/workspace/evil\n---';
  snapshot.tags.t1.name = 'TODO\n# injected';
  snapshot.notes.n2 = { ...snapshot.notes.n1, id: 'n2', kind: 'manual',
    bodyMarkdown: '我的改写😀', quote: { format: 'markdown', content: '| 表格 | 值 |\n|---|---|\n|甲|乙|' } };
  const before = structuredClone(snapshot);
  const result = exportMarkdown(snapshot, ['n1', 'n2'], ['n2', 'n1']);
  assert.deepEqual([result.revision, result.count], [7, 2]);
  assert.ok(result.content.indexOf('- ID：n2') < result.content.indexOf('- ID：n1'));
  assert.match(result.content, /### 我的改写\n\n我的改写😀/);
  assert.match(result.content, /### 原始引用\n\n\| 表格 \| 值 \|/);
  assert.ok(!result.content.includes('恶意\n# 标题'));
  assert.ok(!result.content.includes('TODO\n# injected'));
  assert.ok(!result.content.includes('/workspace/evil\n---'));
  assert.deepEqual(snapshot, before);
});

test('Markdown export metadata and optional fields remain independent of original Snapshot', () => {
  const snapshot = notebookFixture(); const before = structuredClone(snapshot);
  snapshot.notes.n1.source.sessionTitle = '原始\n会话';
  snapshot.notes.n1.source.workspacePath = '/example/workspace';
  const selected = exportMarkdown(snapshot, ['n1'], ['n1'], { exportedAt: '2026-10-05T15:30:00+08:00' });
  assert.ok(selected.content.includes('导出时间：2026-10-05T15:30:00\\+08:00'));
  assert.match(selected.content, /笔记数量：1/);
  assert.match(selected.content, /会话标题：原始 会话/);
  assert.match(selected.content, /会话 ID：synthetic/);
  const withoutSourceIds = exportMarkdown(snapshot, ['n1'], ['n1'], { includeSourceIds: false });
  assert.match(withoutSourceIds.content, /会话标题：原始 会话/);
  assert.match(withoutSourceIds.content, /工作区：/);
  assert.doesNotMatch(withoutSourceIds.content, /会话 ID：|消息 ID：/);
  assert.match(withoutSourceIds.content, /- ID：n1/);
  const withoutNoteId = exportMarkdown(snapshot, ['n1'], ['n1'], { includeIds: false });
  assert.match(withoutNoteId.content, /会话 ID：synthetic/);
  assert.doesNotMatch(withoutNoteId.content, /- ID：n1/);
  const minimal = exportMarkdown(snapshot, ['n1'], ['n1'], { exportedAt: '2026-10-05T07:30:00Z',
    includeTags: false, includeSource: false, includeIds: false, includeTimes: false, includeQuote: false });
  for (const field of ['标签：', '会话标题：', '工作区：', '会话 ID：', '消息 ID：', '- ID：',
    '- 创建：', '- 更新：', '### 原始引用']) assert.ok(!minimal.content.includes(field), field);
  assert.match(minimal.content, /### 我的笔记/);
  assert.deepEqual(snapshot.notes.n1.source.sessionTitle, '原始\n会话');
  assert.equal(before.notes.n1.source.sessionTitle, undefined);
  for (const options of [null, { includeSource: 'no' }, { includeSourceIds: 'no' }, { exportedAt: 'yesterday' },
    { includeQuote: false, unknown: true }]) {
    assert.throws(() => exportMarkdown(snapshot, ['n1'], ['n1'], options), { message: 'INVALID_EXPORT' });
  }
});

test('export time rejects calendar dates that Date.parse normalizes', () => {
  const snapshot = notebookFixture();
  assert.match(exportMarkdown(snapshot, ['n1'], ['n1'], {
    exportedAt: '2024-02-29T10:00:00+08:00',
  }).content, /导出时间：2024-02-29T10:00:00\\\+08:00/);
  for (const exportedAt of ['2026-02-29T10:00:00Z', '2026-02-31T10:00:00Z',
    '2026-04-31T10:00:00Z']) {
    assert.throws(() => exportMarkdown(snapshot, ['n1'], ['n1'], { exportedAt }),
      { message: 'INVALID_EXPORT' });
  }
});

test('plain text quotes use a fence longer than embedded backtick runs', () => {
  const snapshot = notebookFixture();
  snapshot.notes.n1.quote.content = '第一行\n```js\nconst x = `<unsafe>`;\n````\n结尾';
  const result = exportMarkdown(snapshot, ['n1'], ['n1']);
  assert.match(result.content, /### 原始引用\n\n`````text\n第一行\n```js\nconst x = `<unsafe>`;\n````\n结尾\n`````/);
});

test('suggested filename rejects traversal, path separators and device names', () => {
  assert.equal(markdownExportFilename('记录/../其它\\2026\n😀'), '记录---其它-2026-😀.md');
  assert.equal(markdownExportFilename(), 'dsh-session-notebook.md');
  for (const unsafe of ['../', '..', 'CON', 'nul.txt', '  /  ', '\u0000'])
    assert.throws(() => markdownExportFilename(unsafe), { message: 'INVALID_EXPORT' });
});

test('long repeated backtick runs are handled without expanding match arrays', () => {
  const snapshot = notebookFixture();
  snapshot.notes.n1.quote.content = 'a`'.repeat(70000);
  const result = exportMarkdown(snapshot, ['n1'], ['n1']);
  assert.match(result.content, /### 原始引用\n\n```text\na`a`/);
});

test('missing, deleted, duplicate and reordered selections fail instead of silently dropping records', () => {
  const snapshot = notebookFixture();
  for (const [selected, ordered] of [[[], []], [['missing'], ['missing']], [['n1'], []],
    [['n1'], ['other']], [['n1', 'n1'], ['n1']]]) {
    assert.throws(() => exportMarkdown(snapshot, selected, ordered), { message: 'INVALID_EXPORT' });
  }
  snapshot.notes.n1.deletedAt = snapshot.notes.n1.updatedAt;
  assert.throws(() => exportMarkdown(snapshot, ['n1'], ['n1']), { message: 'INVALID_EXPORT' });
});
