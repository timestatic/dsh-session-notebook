// Standard DOM operations for one caller-verified message body only. This
// module cannot discover a message, authenticate its identity, or save a quote.
const blockTags = new Set(['P', 'DIV', 'PRE', 'LI', 'UL', 'OL', 'BLOCKQUOTE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'TR']);
const excludedTags = new Set(['SCRIPT', 'STYLE', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']);
const fail = code => { throw Object.assign(new Error(code), { code }); };

export function messageTextIndex(root, { maxTextUnits = 1024 * 1024, maxNodes = 50000 } = {}) {
  if (root?.nodeType !== 1 || typeof root.ownerDocument?.createRange !== 'function'
    || !Number.isSafeInteger(maxTextUnits) || maxTextUnits < 1
    || !Number.isSafeInteger(maxNodes) || maxNodes < 1) fail('INVALID_TEXT_ROOT');
  let text = '', pendingGap = false, count = 0;
  const segments = [], boundaries = new Map(), extents = new Map(), tree = [];
  const append = value => {
    if (text.length + value.length > maxTextUnits) fail('TEXT_INDEX_LIMIT');
    text += value;
  };
  const walk = (node, depth = 0) => {
    if (++count > maxNodes || depth > 256) fail('TEXT_INDEX_LIMIT');
    tree.push({ node, children: Array.from(node.childNodes ?? []), value: node.data });
    if (node.nodeType === 3) {
      const value = node.data;
      if (value) {
        if (pendingGap && text && !text.endsWith('\n') && !value.startsWith('\n')) append('\n');
        pendingGap = false;
      }
      const start = text.length;
      append(value);
      segments.push({ node, start, end: text.length, value });
      if (value) extents.set(node, { start, end: text.length });
      return;
    }
    if (node.nodeType !== 1 || excludedTags.has(node.tagName)) return;
    const block = node !== root && blockTags.has(node.tagName);
    if (block) pendingGap = true;
    if (node.tagName === 'BR') {
      append('\n'); pendingGap = false; boundaries.set(node, [text.length - 1]); return;
    }
    const offsets = [text.length], before = segments.length;
    for (const child of node.childNodes) { walk(child, depth + 1); offsets.push(text.length); }
    boundaries.set(node, offsets);
    const nonempty = segments.slice(before).filter(entry => entry.end > entry.start);
    if (nonempty.length) extents.set(node, { start: nonempty[0].start, end: nonempty.at(-1).end });
    if (block) pendingGap = true;
  };
  walk(root);
  // Capture and relocation use this same DOM-backed stream. A whole-body
  // innerText comparison is unsafe: message controls can add unrelated text.
  const segmentFor = new Map(segments.map(entry => [entry.node, entry]));
  const current = () => {
    if (root.isConnected === false || tree.some(({ node, children, value }) =>
      node.data !== value || (node.childNodes?.length ?? 0) !== children.length
      || children.some((child, index) => node.childNodes[index] !== child))) fail('STALE_TEXT_INDEX');
  };
  const offset = (node, local, end) => {
    if (!Number.isSafeInteger(local) || local < 0) fail('UNMAPPABLE_RANGE');
    const segment = segmentFor.get(node);
    if (segment && local <= segment.value.length) return segment.start + local;
    const offsets = boundaries.get(node);
    if (offsets && local < offsets.length) {
      const extent = extents.get(node.childNodes[end ? local - 1 : local]);
      return extent ? end ? extent.end : extent.start : offsets[local];
    }
    fail('UNMAPPABLE_RANGE');
  };
  const point = (position, end) => {
    // At a shared boundary, start belongs to the following node and end to
    // the preceding one. Synthetic block gaps cannot become Range endpoints.
    const entry = end
      ? segments.find(part => part.start < position && position <= part.end)
      : segments.find(part => part.start <= position && position < part.end);
    if (!entry) fail('UNMAPPABLE_RANGE');
    return { node: entry.node, offset: position - entry.start };
  };
  return {
    text, nodes: segments.map(entry => entry.node),
    selection(range, exact) {
      current();
      if (!range || typeof exact !== 'string') fail('UNMAPPABLE_RANGE');
      const startOffset = offset(range.startContainer, range.startOffset, false);
      const endOffset = offset(range.endContainer, range.endOffset, true);
      const indexed = text.slice(startOffset, endOffset);
      if (startOffset >= endOffset || (indexed !== exact
        && foldedTextMap(indexed).text !== foldedTextMap(exact).text)) fail('UNMAPPABLE_RANGE');
      return { exact, sourceText: text, startOffset, endOffset,
        ...(indexed !== exact ? { normalized: true } : {}) };
    },
    range(startOffset, endOffset) {
      current();
      if (!Number.isSafeInteger(startOffset) || !Number.isSafeInteger(endOffset)
        || startOffset < 0 || endOffset <= startOffset || endOffset > text.length)
        fail('UNMAPPABLE_RANGE');
      const start = point(startOffset, false), end = point(endOffset, true);
      const range = root.ownerDocument.createRange();
      range.setStart(start.node, start.offset); range.setEnd(end.node, end.offset);
      return range;
    },
  };
}

// Whitespace folding is a derived lookup only. Raw text and quote stay intact.
export function foldedTextMap(text) {
  if (typeof text !== 'string') fail('INVALID_TEXT');
  let folded = '';
  const starts = [], ends = [];
  for (let offset = 0; offset < text.length;) {
    const start = offset;
    if (/\s/u.test(text[offset])) {
      while (offset < text.length && /\s/u.test(text[offset])) offset++;
      folded += ' '; starts.push(start); ends.push(offset);
    } else {
      folded += text[offset++]; starts.push(start); ends.push(offset);
    }
  }
  return { text: folded,
    rawRange(start, end) {
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
        || start < 0 || end <= start || end > folded.length) fail('UNMAPPABLE_RANGE');
      return { startOffset: starts[start], endOffset: ends[end - 1] };
    } };
}
