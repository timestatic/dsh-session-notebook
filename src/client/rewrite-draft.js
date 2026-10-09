// Transient editor initialization only. Never mutate a saved Quote or a DSH
// message. A caller must first verify the committed message's provenance.
function literalMarkdown(content) {
  let longest = 0;
  for (const run of content.matchAll(/`+/g)) longest = Math.max(longest, run[0].length);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}text\n${content}${content.endsWith('\n') ? '' : '\n'}${fence}`;
}

export function prepareNoteDraft(quote) {
  if (!quote || !['markdown', 'plain_text'].includes(quote.format)
    || typeof quote.content !== 'string' || !quote.content.trim())
    return { ok: false, reason: 'INVALID_QUOTE' };
  return { ok: true, kind: 'note', bodyMarkdown: '' };
}

export function prepareRewriteDraft(quote) {
  if (!quote || !['markdown', 'plain_text'].includes(quote.format)
    || typeof quote.content !== 'string' || !quote.content.trim())
    return { ok: false, reason: 'INVALID_QUOTE' };
  // Plain text is never interpreted as Markdown/HTML in the editable seed.
  return { ok: true, kind: 'manual', bodyMarkdown: quote.format === 'markdown'
    ? quote.content : literalMarkdown(quote.content) };
}
