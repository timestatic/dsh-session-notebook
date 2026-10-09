import { messageTextIndex } from './message-text-index.js';
import { locateTextAnchor } from './text-anchor.js';

// One caller-verified mounted message and its already-persisted anchors. No
// global conversation search, DOM wrapper, source discovery, or save operation.
export function messageHighlights({ root, registry, Highlight, name,
  MutationObserver, schedule = queueMicrotask }) {
  if (typeof name !== 'string' || !/^dsh-notebook-[a-z0-9-]{1,64}$/.test(name)
    || typeof schedule !== 'function') throw new TypeError('INVALID_HIGHLIGHT_CONFIG');
  const supported = typeof Highlight === 'function' && typeof registry?.get === 'function'
    && typeof registry?.set === 'function' && typeof registry?.delete === 'function';
  if (supported && registry.get(name) !== undefined) throw new Error('HIGHLIGHT_NAME_IN_USE');
  let owned = null, closed = false, index = null, located = [];
  let observer = null, queued = false, generation = 0;
  const clear = () => {
    if (owned !== null && registry.get(name) === owned) registry.delete(name);
    owned = null; located = []; index = null;
  };
  const sync = entries => {
    if (closed) return { status: 'closed', items: [] };
    if (!supported) return { status: 'unavailable', items: [] };
    clear();
    if (registry.get(name) !== undefined) return { status: 'name-in-use', items: [] };
    if (!Array.isArray(entries) || entries.length > 10000) return { status: 'invalid', items: [] };
    // An empty library does not require a DOM scan.
    if (!entries.length) return { status: 'ready', items: [] };
    try { index = messageTextIndex(root); }
    catch { return { status: 'unavailable', items: [] }; }
    const ids = new Set();
    const items = entries.map(entry => {
      if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id))
        return { id: typeof entry?.id === 'string' ? entry.id : '', status: 'invalid' };
      ids.add(entry.id);
      const result = locateTextAnchor(index.text, entry.anchor);
      if (result.status !== 'found') return { id: entry.id, status: result.status };
      try {
        const range = index.range(result.startOffset, result.endOffset);
        located.push({ id: entry.id, exact: entry.anchor.exact, range });
        return { id: entry.id, status: 'found' };
      } catch { return { id: entry.id, status: 'unavailable' }; }
    });
    if (located.length) {
      owned = new Highlight(...located.map(entry => entry.range));
      registry.set(name, owned);
    }
    return { status: 'ready', items };
  };
  const hit = (x, y) => {
    if (closed || !index || !Number.isFinite(x) || !Number.isFinite(y)) return [];
    const hits = [];
    for (const entry of located) {
      try {
        index.selection(entry.range, entry.exact);
        if (Array.from(entry.range.getClientRects()).some(rect => rect.width > 0 && rect.height > 0
          && rect.left <= x && x <= rect.right && rect.top <= y && y <= rect.bottom)) hits.push(entry.id);
      } catch { clear(); return []; }
    }
    return hits;
  };
  return {
    sync,
    hit,
    hitEvent(event) {
      const doc = root?.ownerDocument;
      if (!event || event.defaultPrevented || event.button !== 0
        || typeof root?.contains !== 'function' || !root.contains(event.target)
        || typeof doc?.getSelection !== 'function' || typeof doc?.elementsFromPoint !== 'function') return [];
      if (doc.getSelection()?.isCollapsed !== true) return [];
      const top = doc.elementsFromPoint(event.clientX, event.clientY)[0];
      if (!top || !root.contains(top)) return [];
      for (let node = event.target; node; node = node.parentNode) {
        if (['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)
          || node.isContentEditable || ['button', 'link', 'textbox'].includes(node.getAttribute?.('role'))
          || node.hasAttribute?.('data-notebook-library') || node.hasAttribute?.('data-notebook-overlay')) return [];
        if (node === root) break;
      }
      // All overlaps remain candidates; the UI must ask instead of picking one.
      return hit(event.clientX, event.clientY);
    },
    watch(readEntries, report = () => {}) {
      if (closed || !supported || typeof MutationObserver !== 'function'
        || typeof readEntries !== 'function' || typeof report !== 'function' || observer) return false;
      const token = generation;
      observer = new MutationObserver(() => {
        if (closed) return;
        clear();
        if (queued) return;
        queued = true;
        schedule(() => {
          queued = false;
          if (closed || token !== generation) return;
          let entries;
          try { entries = readEntries(); }
          catch { report({ status: 'unavailable', items: [] }); return; }
          report(sync(entries));
        });
      });
      observer.observe(root, { childList: true, characterData: true, subtree: true });
      return true;
    },
    dispose() {
      if (closed) return;
      closed = true; generation++;
      observer?.disconnect(); observer = null; clear();
    },
  };
}
