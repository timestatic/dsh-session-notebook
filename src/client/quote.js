// Pure Quote builder: only a separate SourceAdapter may establish that source
// Markdown and its offsets belong to this exact committed message/block.
// `verified` and `syntaxPreserved` are caller assertions, not proof supplied
// by this function; the renderer must sanitize Markdown independently.
// Never infer Markdown syntax or identity from the rendered selection.
export function prepareQuote(visibleExact, verifiedSource) {
  if (typeof visibleExact !== 'string' || !visibleExact.length) {
    return { ok: false, reason: 'INVALID_SELECTION' };
  }
  const plain = () => ({ ok: true, quote: Object.freeze({ format: 'plain_text', content: visibleExact }) });
  if (!verifiedSource || verifiedSource.verified !== true) return plain();
  const { markdown, startOffset, endOffset, renderedExact, syntaxPreserved } = verifiedSource;
  if (typeof markdown !== 'string' || !Number.isSafeInteger(startOffset) || !Number.isSafeInteger(endOffset)
    || startOffset < 0 || endOffset <= startOffset || endOffset > markdown.length
    || renderedExact !== visibleExact || syntaxPreserved !== true) return plain();
  const content = markdown.slice(startOffset, endOffset);
  // Reject empty markup and hostile raw HTML rather than claiming it is safe to
  // render. The actual Markdown renderer still needs independent sanitization.
  if (!content || /<\s*\/?\s*[a-z][^>]*>/i.test(content)
    || /\]\(\s*(?:javascript|data|vbscript)\s*:/i.test(content)) return plain();
  return { ok: true, quote: Object.freeze({ format: 'markdown', content }) };
}
