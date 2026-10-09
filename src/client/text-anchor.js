// Pure locator for one caller-verified, mounted message text block. Offsets
// are UTF-16 code units of that block; this function does not inspect the DOM,
// authenticate a messageId, or install browser highlights.
export function locateTextAnchor(text, anchor) {
  if (typeof text !== 'string' || !anchor || typeof anchor.exact !== 'string' || !anchor.exact.length) {
    return { status: 'invalid' };
  }
  const { exact, startOffset, endOffset, prefix, suffix, occurrence } = anchor;
  const hasStart = startOffset !== undefined;
  const hasEnd = endOffset !== undefined;
  if (hasStart !== hasEnd || (hasStart && (!Number.isSafeInteger(startOffset)
    || !Number.isSafeInteger(endOffset) || startOffset < 0 || endOffset <= startOffset))) {
    return { status: 'invalid' };
  }
  if ((prefix !== undefined && typeof prefix !== 'string')
    || (suffix !== undefined && typeof suffix !== 'string')
    || (occurrence !== undefined && (!Number.isSafeInteger(occurrence) || occurrence < 0))) {
    return { status: 'invalid' };
  }
  const matchesContext = position =>
    (prefix === undefined || (position >= prefix.length
      && text.slice(position - prefix.length, position) === prefix))
    && (suffix === undefined || (position + exact.length + suffix.length <= text.length
      && text.slice(position + exact.length, position + exact.length + suffix.length) === suffix));
  // An old offset is only a hint. Repeated matching contexts cannot identify
  // the original occurrence after source text changes.
  const hasContext = (typeof prefix === 'string' && prefix.length > 0)
    || (typeof suffix === 'string' && suffix.length > 0);
  const hits = [];
  for (let position = text.indexOf(exact); position !== -1; position = text.indexOf(exact, position + 1)) {
    hits.push(position);
  }
  if (!hits.length) return { status: 'missing' };
  if (prefix !== undefined || suffix !== undefined) {
    const contextual = hits.filter(matchesContext);
    if (contextual.length === 1) {
      const position = contextual[0];
      return { status: 'found', startOffset: position, endOffset: position + exact.length,
        match: hasStart && hasContext && position === startOffset && endOffset === position + exact.length
          ? 'offset' : 'context' };
    }
    if (contextual.length > 1) return { status: 'ambiguous' };
  }
  // An occurrence ordinal without a verified unchanged text snapshot cannot
  // distinguish shifted duplicate phrases; never highlight one arbitrarily.
  if (prefix === undefined && suffix === undefined && hits.length === 1) {
    if (occurrence !== undefined && occurrence !== 0) return { status: 'missing' };
    return { status: 'found', startOffset: hits[0], endOffset: hits[0] + exact.length, match: 'unique' };
  }
  return { status: hits.length > 1 ? 'ambiguous' : 'missing' };
}
