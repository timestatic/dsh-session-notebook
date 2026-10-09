// Pure exporter for an already validated, immutable-revision Snapshot. Caller
// owns revision selection, authorization, UTF-8 file creation and cancellation.
const fail = () => { throw new TypeError('INVALID_EXPORT'); };
const plain = value => typeof value === 'string' ? value.replace(/[\r\n\u2028\u2029\u0000-\u001f\u007f]/g, ' ').replace(/\\/g, '\\\\')
  .replace(/([`*_{}\[\]()#+.!|<>~])/g, '\\$1').trim() : '';
const fenceFor = content => {
  let longest = 0;
  for (const match of content.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
  return '`'.repeat(Math.max(3, longest + 1));
};
const validTimestamp = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value)
    || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
};

/** A filename only, never a caller-supplied Host path. */
export function markdownExportFilename(label = 'dsh-session-notebook') {
  if (typeof label !== 'string') fail();
  const safe = label.normalize('NFKC').replace(/[\\/\u0000-\u001f\u007f-\u009f<>:"|?*]/g, '-')
    .replace(/\.{2,}/g, '-').replace(/[.\s-]+$/g, '').replace(/^[.\s-]+/g, '')
    .slice(0, 80).replace(/[.\s-]+$/g, '');
  if (!safe || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(safe)) fail();
  return `${safe}.md`;
}
function quoteBlock(quote) {
  if (!quote || typeof quote.content !== 'string' || !['markdown', 'plain_text'].includes(quote.format)) fail();
  if (quote.format === 'markdown') return quote.content;
  const fence = fenceFor(quote.content);
  // A plain-text quote is never handed to the Markdown parser as raw HTML.
  return `${fence}text\n${quote.content}\n${fence}`;
}

/** Export selected IDs in caller-provided deterministic query order; never omit a missing note. */
export function exportMarkdown(snapshot, selectedIds, orderedIds, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some(key => !['exportedAt', 'includeTags', 'includeSource',
      'includeSourceIds', 'includeIds', 'includeTimes', 'includeQuote'].includes(key))) fail();
  const { exportedAt = new Date().toISOString(), includeTags = true, includeSource = true,
    includeSourceIds = true, includeIds = true, includeTimes = true, includeQuote = true } = options;
  if (!validTimestamp(exportedAt)
    || [includeTags, includeSource, includeSourceIds, includeIds, includeTimes, includeQuote]
      .some(value => typeof value !== 'boolean')) fail();
  if (!snapshot || !snapshot.notes || !snapshot.tags || !Number.isSafeInteger(snapshot.revision)
    || !Array.isArray(selectedIds) || !selectedIds.length || !Array.isArray(orderedIds)
    || selectedIds.some(id => typeof id !== 'string' || !id)
    || orderedIds.some(id => typeof id !== 'string' || !id)
    || new Set(selectedIds).size !== selectedIds.length || new Set(orderedIds).size !== orderedIds.length) fail();
  const selected = new Set(selectedIds);
  if (orderedIds.length !== selected.size || orderedIds.some(id => !selected.has(id))) fail();
  const sections = orderedIds.map(id => {
    if (!Object.hasOwn(snapshot.notes, id) || snapshot.notes[id].deletedAt) fail();
    const note = snapshot.notes[id];
    if (!['highlight', 'note', 'manual'].includes(note.kind)
      || !Array.isArray(note.tagIds) || typeof note.createdAt !== 'string'
      || typeof note.updatedAt !== 'string') fail();
    const heading = plain(note.title || (note.kind === 'highlight' ? '划线' : note.kind === 'manual' ? '手工笔记' : '笔记'));
    const lines = [`## ${heading}`, '', `- 类型：${plain(note.kind)}`];
    if (includeIds) lines.push(`- ID：${plain(id)}`);
    if (includeTimes) lines.push(`- 创建：${plain(note.createdAt)}`, `- 更新：${plain(note.updatedAt)}`);
    if (includeTags && note.tagIds.length) {
      const names = note.tagIds.map(tagId => {
        if (!Object.hasOwn(snapshot.tags, tagId) || snapshot.tags[tagId].deletedAt) fail();
        return plain(snapshot.tags[tagId].name);
      });
      lines.push(`- 标签：${names.join('、')}`);
    }
    if (includeSource) {
      for (const [label, value] of [['会话标题', note.source?.sessionTitle],
        ['工作区标题', note.source?.workspaceTitle], ['工作区', note.source?.workspacePath]]) {
        if (value !== undefined) lines.push(`- ${label}：${plain(value)}`);
      }
      if (includeSourceIds) for (const [label, value] of [['会话 ID', note.source?.sessionId],
        ['消息 ID', note.source?.messageId]]) {
        if (value !== undefined) lines.push(`- ${label}：${plain(value)}`);
      }
    }
    if (includeQuote && note.quote) lines.push('', '### 原始引用', '', quoteBlock(note.quote));
    if (note.kind !== 'highlight') {
      if (typeof note.bodyMarkdown !== 'string') fail();
      lines.push('', note.kind === 'manual' && note.quote ? '### 我的改写' : '### 我的笔记', '', note.bodyMarkdown);
    }
    return lines.join('\n');
  });
  return { revision: snapshot.revision, count: sections.length,
    content: `# DSH AI 会话笔记本\n\n- 导出时间：${plain(exportedAt)}\n- 笔记数量：${sections.length}\n\n${sections.join('\n\n---\n\n')}\n` };
}
