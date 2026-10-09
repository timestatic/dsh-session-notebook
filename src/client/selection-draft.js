// Pure preparation step only. The session-owning DOM adapter must verify both
// endpoint identities and committed state with supported Host APIs before calling
// this function. The caller-provided labels are NOT independently authenticated here.
// This module neither reads Selection/DOM nor opens a save route.
export const DEFAULT_MAX_QUOTE_LENGTH = 8000;

export function prepareSelectionDraft(candidate, { maxQuoteLength = DEFAULT_MAX_QUOTE_LENGTH } = {}) {
  if (!Number.isSafeInteger(maxQuoteLength) || maxQuoteLength < 2) {
    return { ok: false, reason: 'INVALID_LIMIT' };
  }
  const { start, end, exact, sourceText, startOffset, endOffset } = candidate ?? {};
  const identity = endpoint => endpoint && typeof endpoint.sessionId === 'string' && endpoint.sessionId.length > 0
    && typeof endpoint.messageId === 'string' && endpoint.messageId.length > 0
    && (endpoint.role === 'user' || endpoint.role === 'assistant')
    && endpoint.committed === true;
  if (!identity(start) || !identity(end)
    || start.sessionId !== end.sessionId || start.messageId !== end.messageId || start.role !== end.role) {
    return { ok: false, reason: 'UNVERIFIED_MESSAGE' };
  }
  if (typeof exact !== 'string' || !exact.trim()) return { ok: false, reason: 'EMPTY_SELECTION' };
  const length = [...exact].length;
  // Product bounds use Unicode code points, not visible grapheme clusters.
  // Preserve original whitespace; ignore it only for the two-point minimum.
  const effectiveLength = [...exact].filter(point => !/\s/u.test(point)).length;
  if (effectiveLength < 2) return { ok: false, reason: 'TOO_SHORT' };
  if (length > maxQuoteLength) return { ok: false, reason: 'TOO_LONG' };
  const hasOffsets = startOffset !== undefined || endOffset !== undefined;
  let anchor = null;
  if (hasOffsets) {
    if (typeof sourceText !== 'string' || !Number.isSafeInteger(startOffset) || !Number.isSafeInteger(endOffset)
      || startOffset < 0 || endOffset <= startOffset || endOffset > sourceText.length
      || sourceText.slice(startOffset, endOffset) !== exact) {
      return { ok: false, reason: 'UNVERIFIED_OFFSET' };
    }
    // Offsets are UTF-16 indices into an explicitly supplied text block, not
    // guesses from rendered Markdown or from the whole conversation.
    anchor = Object.freeze({ startOffset, endOffset,
      prefix: sourceText.slice(Math.max(0, startOffset - 32), startOffset),
      suffix: sourceText.slice(endOffset, endOffset + 32) });
  }
  return { ok: true, draft: Object.freeze({
    sessionId: start.sessionId, messageId: start.messageId, role: start.role,
    exact, anchor,
    // No Markdown claim unless a future SourceAdapter proves the mapping.
    format: 'plain_text',
  }) };
}
