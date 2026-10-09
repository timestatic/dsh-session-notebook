import { messageTextIndex } from './message-text-index.js';
import { locateTextAnchor } from './text-anchor.js';

const error = code => Object.assign(new Error(code), { code });
const excluded = 'input,textarea,select,button,a,[contenteditable="true"],[role="textbox"],[data-lexical-editor],.monaco-editor,.cm-editor,[data-notebook-library],[data-notebook-overlay],[data-notebook-annotations],[data-turn-process-inline]';

// The caller supplies bodies verified against the installed target renderer.
// DOM text anchors identify rendered text only; they do not assert message IDs.
export function conversationAnnotations({ document, sessionId, readBodies, api, createRequestId,
  registry, Highlight, MutationObserver, initialDraft = null, source = { sessionId }, onChange = () => {}, timeoutMs = 10000 }) {
  if (!document || typeof sessionId !== 'string' || !sessionId || typeof readBodies !== 'function'
    || typeof api?.anchors !== 'function' || typeof api?.library !== 'function' || typeof api?.notesGet !== 'function'
    || typeof api?.excerpt !== 'function' || typeof createRequestId !== 'function') throw error('INVALID_CONFIG');
  let alive = true, generation = 0, busy = false, owned = null, records = [], observer;
  let located = [], detailGeneration = 0;
  let state = { draft: initialDraft?.draft ?? null, pending: initialDraft?.pending ?? null,
    bodyMarkdown: initialDraft?.bodyMarkdown ?? '', tagIds: initialDraft?.tagIds ?? [], newTagName: initialDraft?.newTagName ?? '', status: 'loading', diagnostic: null, items: [], candidates: [], detail: null };
  const requests = new Set();
  const name = `dsh-notebook-annotations-${createRequestId()}`;
  if (!/^dsh-notebook-[a-z0-9-]{1,64}$/.test(name)) throw error('INVALID_CONFIG');
  const publish = change => { if (alive) { state = { ...state, ...change }; onChange({ ...state }); } };
  const clear = () => {
    if (owned && registry?.get(name) === owned) registry.delete(name);
    owned = null; located = [];
  };
  const bodies = () => Array.from(readBodies()).filter(body => body?.isConnected !== false);
  const locate = () => {
    clear();
    if (!alive) return;
    const indexes = bodies().map(root => { try { return messageTextIndex(root); } catch { return null; } }).filter(Boolean);
    const ranges = [], items = records.map(note => {
      const matches = [];
      let ambiguous = false;
      for (const index of indexes) {
        const result = locateTextAnchor(index.text, note.anchor);
        if (result.status === 'ambiguous') ambiguous = true;
        if (result.status === 'found') matches.push({ index, result });
      }
      if (ambiguous || matches.length > 1) return { id: note.id, status: 'ambiguous' };
      if (!matches.length) return { id: note.id, status: 'unloaded-or-changed' };
      try {
        const range = matches[0].index.range(matches[0].result.startOffset, matches[0].result.endOffset);
        if (typeof range.getClientRects === 'function' && !range.getClientRects().length)
          return { id: note.id, status: 'unloaded-or-changed' };
        ranges.push(range); located.push({ id: note.id, range, index: matches[0].index, exact: note.anchor.exact });
        return { id: note.id, status: typeof Highlight === 'function' && registry ? 'found' : 'highlight-unavailable' };
      } catch { return { id: note.id, status: 'unloaded-or-changed' }; }
    });
    if (ranges.length && typeof Highlight === 'function' && registry?.set && registry.get(name) === undefined) {
      owned = new Highlight(...ranges); registry.set(name, owned);
    }
    publish({ items });
  };
  const call = async action => {
    const pending = new AbortController(); requests.add(pending);
    let timedOut = false, rejectAbort;
    const aborted = new Promise((_resolve, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(error(timedOut ? 'TIMEOUT' : 'CANCELLED'));
    pending.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; pending.abort(); }, timeoutMs);
    try { return await Promise.race([action(pending.signal), aborted]); }
    finally { clearTimeout(timer); pending.signal.removeEventListener('abort', onAbort); requests.delete(pending); }
  };
  const reload = async () => {
    const token = ++generation;
    publish({ status: 'loading', diagnostic: null });
    try {
      const notes = []; const noteIds = new Set(); let snapshot = null;
      for (let offset = 0; ; offset += 50) {
        const page = await call(signal => api.anchors({ sessionId, offset, limit: 50 }, signal));
        if (!alive || token !== generation) return;
        if (!page || !Array.isArray(page.items) || page.items.length > 50 || !Number.isSafeInteger(page.total)
          || page.total < 0 || typeof page.epoch !== 'string' || !Number.isSafeInteger(page.revision)) throw error('INVALID_RESPONSE');
        if (snapshot && (snapshot.epoch !== page.epoch || snapshot.revision !== page.revision || snapshot.total !== page.total)) throw error('VERSION_CONFLICT');
        snapshot ??= { epoch: page.epoch, revision: page.revision, total: page.total };
        for (const row of page.items) {
          if (!row || typeof row.id !== 'string' || !['highlight', 'note'].includes(row.kind)
            || row.source?.sessionId !== sessionId || typeof row.anchor?.exact !== 'string') throw error('INVALID_RESPONSE');
          if (noteIds.has(row.id)) throw error('INVALID_RESPONSE');
          noteIds.add(row.id); notes.push(row);
        }
        if (offset + page.items.length >= page.total) break;
        if (page.items.length !== 50 || offset >= 10000) throw error('READ_UNAVAILABLE');
      }
      records = notes; publish({ status: 'ready' }); locate();
    } catch (failure) {
      if (alive && token === generation) { clear(); records = []; publish({ status: 'failed', diagnostic: failure?.code ?? 'READ_UNAVAILABLE', items: [] }); }
    }
  };
  const capture = () => {
    if (!alive || busy || state.pending) return;
    // A bare selection may move; edited annotations remain bound to their original quote.
    if (state.draft && (state.bodyMarkdown || state.tagIds.length || state.newTagName)) return;
    const selection = document.getSelection?.();
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return;
    const range = selection.getRangeAt(0);
    const element = node => node?.nodeType === 1 ? node : node?.parentElement;
    const start = element(range.startContainer), end = element(range.endContainer);
    if (!start || !end || start.closest?.(excluded) || end.closest?.(excluded)) return;
    const candidates = bodies().filter(body => body.contains(range.startContainer) && body.contains(range.endContainer));
    if (candidates.length !== 1) return;
    const body = candidates[0];
    // Reject selections that cross an excluded island even when endpoints are safe.
    if (Array.from(body.querySelectorAll?.(excluded) ?? []).some(node => range.intersectsNode(node))) return;
    const exact = selection.toString();
    if ([...exact].filter(point => !/\s/u.test(point)).length < 2 || [...exact].length > 8000) return;
    const rect = range.getBoundingClientRect();
    const draft = { quote: { format: 'plain_text', content: exact }, source: { ...source, sessionId },
      position: { left: rect.left, top: rect.bottom } };
    try {
      const indexed = messageTextIndex(body).selection(range, exact);
      publish({ draft: { ...draft, anchor: { exact,
        prefix: indexed.sourceText.slice(Math.max(0, indexed.startOffset - 32), indexed.startOffset),
          suffix: indexed.sourceText.slice(indexed.endOffset, indexed.endOffset + 32),
          ...(indexed.normalized ? {} : { startOffset: indexed.startOffset, endOffset: indexed.endOffset }) } }, diagnostic: null });
    } catch (failure) {
      if (failure?.code === 'UNMAPPABLE_RANGE')
        publish({ draft: { ...draft, anchor: { exact }, unlocated: true }, diagnostic: null });
      else publish({ diagnostic: failure?.code ?? 'UNMAPPABLE_RANGE' });
    }
  };
  const save = async (kind, bodyMarkdown = state.bodyMarkdown ?? '') => {
    // Every save action preserves typed annotations, including quick-tag shortcuts.
    if (kind === 'highlight' && bodyMarkdown.trim()) kind = 'note';
    if (!alive || busy || (!state.draft && !state.pending)) return;
    busy = true; publish({ status: 'saving', diagnostic: null });
    try {
      if (!state.pending) {
        if (!['highlight', 'note'].includes(kind) || (kind === 'note' && !bodyMarkdown.trim())) throw error('VALIDATION_FAILED');
        const version = await call(signal => api.library({ scope: 'session', sessionId, sort: 'updated', offset: 0, limit: 50 }, signal));
        if (!alive) return;
        if (typeof version?.epoch !== 'string' || !Number.isSafeInteger(version.revision)) throw error('INVALID_RESPONSE');
        const { quote, anchor, source } = state.draft;
        publish({ pending: { requestId: createRequestId(), epoch: version.epoch, expectedRevision: version.revision,
          kind, ...(kind === 'note' ? { bodyMarkdown } : {}), quote, anchor, source, tagIds: [...state.tagIds], ...(state.newTagName.trim() ? { newTagName: state.newTagName.trim() } : {}) } });
      }
      const intent = state.pending;
      const receipt = await call(signal => api.excerpt(structuredClone(intent), signal));
      if (!alive) return;
      if (receipt?.epoch !== intent.epoch || !Number.isSafeInteger(receipt.revision)
        || receipt.revision <= intent.expectedRevision || typeof receipt.noteId !== 'string' || !receipt.noteId) throw error('INVALID_RESPONSE');
      publish({ draft: null, pending: null, bodyMarkdown: '', tagIds: [], newTagName: '', status: 'saved' });
      await reload();
    } catch (failure) {
      publish({ status: 'failed', diagnostic: failure?.code ?? 'COMMIT_UNKNOWN',
        ...(['VERSION_CONFLICT', 'EPOCH_CONFLICT', 'VALIDATION_FAILED', 'REQUEST_LIMIT', 'SNAPSHOT_LIMIT', 'RECEIPT_LIMIT', 'NAME_CONFLICT'].includes(failure?.code) ? { pending: null } : {}) });
    } finally { busy = false; }
  };
  const openDetail = async id => {
    const token = ++detailGeneration;
    publish({ detail: null, diagnostic: null });
    try {
      const response = await call(signal => api.notesGet(id, signal));
      if (!alive || token !== detailGeneration) return;
      if (response?.note?.id !== id || response.note.source?.sessionId !== sessionId) throw error('INVALID_RESPONSE');
      publish({ detail: response.note, candidates: [] });
    } catch (failure) { if (alive && token === detailGeneration) publish({ diagnostic: failure?.code ?? 'READ_UNAVAILABLE' }); }
  };
  const click = event => {
    if (!alive || state.draft || state.pending || event.defaultPrevented || event.button !== 0
      || document.getSelection?.()?.isCollapsed !== true || event.target?.closest?.(excluded)) return;
    const top = document.elementsFromPoint?.(event.clientX, event.clientY)?.[0];
    if (!top || !bodies().some(body => body.contains(event.target) && body.contains(top))) return;
    const hits = [];
    for (const entry of located) {
      try {
        entry.index.selection(entry.range, entry.exact);
        if (Array.from(entry.range.getClientRects()).some(rect => rect.width > 0 && rect.height > 0
          && rect.left <= event.clientX && event.clientX <= rect.right && rect.top <= event.clientY && event.clientY <= rect.bottom)) hits.push(entry.id);
      } catch { clear(); return; }
    }
    if (hits.length) publish({ detailPosition: { left: event.clientX, top: event.clientY } });
    if (hits.length === 1) void openDetail(hits[0]);
    else if (hits.length > 1) publish({ candidates: hits, detail: null });
  };
  document.addEventListener?.('click', click);
  document.addEventListener?.('mouseup', capture);
  document.addEventListener?.('keyup', capture);
  let queued = false;
  if (typeof MutationObserver === 'function' && document.body) {
    observer = new MutationObserver(mutations => {
      if (!alive) return;
      const isSessionRegion = node => node?.getAttribute?.('data-conversation-region') === 'chat'
        && node.getAttribute('data-conversation-session') === sessionId;
      const containsSessionRegion = node => isSessionRegion(node)
        || Array.from(node?.querySelectorAll?.('[data-conversation-region="chat"][data-conversation-session]') ?? []).some(isSessionRegion);
      if (!mutations.some(mutation => {
        const target = mutation.target?.nodeType === 1 ? mutation.target : mutation.target?.parentElement;
        if (target?.closest?.('[data-notebook-annotations],[data-notebook-overlay],[data-notebook-library]')) return false;
        if (isSessionRegion(target?.closest?.('[data-conversation-region="chat"]'))) return true;
        // Whole occurrence replacement can report its outer parent as target.
        // Removed nodes are disconnected but still carry the session attributes.
        return [...Array.from(mutation.addedNodes ?? []), ...Array.from(mutation.removedNodes ?? [])].some(containsSessionRegion);
      })) return;
      clear();
      if (queued) return;
      queued = true; queueMicrotask(() => { queued = false; if (alive) locate(); });
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }
  return { name, reload, capture, save, openDetail,
    closeDetail() { detailGeneration++; publish({ detail: null, candidates: [] }); },
    editTags(tagIds, newTagName = '') { if (!busy && !state.pending && Array.isArray(tagIds) && tagIds.every(id => typeof id === 'string') && typeof newTagName === 'string') publish({ tagIds: [...new Set(tagIds)], newTagName }); },
    editBody(bodyMarkdown) { if (!busy && !state.pending) publish({ bodyMarkdown }); }, retry: () => save(), snapshot: () => ({ ...state }),
    discard(confirmed = false) { if (!busy && !state.pending && (!state.bodyMarkdown || confirmed === true)) publish({ draft: null, bodyMarkdown: '', tagIds: [], newTagName: '', diagnostic: null }); },
    dispose() { alive = false; generation++; observer?.disconnect(); clear();
      for (const request of requests) request.abort(); requests.clear();
      document.removeEventListener?.('click', click); document.removeEventListener?.('mouseup', capture); document.removeEventListener?.('keyup', capture); } };
}

// Verified installed @deepseek-ai/dsh-client-ui-chat 0.1.5-rc.2 renderer:
// Desktop app.asar chat 0.2.0-rc.2: .desktop-reference/chat-client.js
// MessageItem bubble (225,1332), AssistantMarkdown body (5868,5955).
// Shared chat 0.1.5-rc.2 remains supported with its separately verified classes.
// Fail closed on new markup; static package evidence is not runtime acceptance.
// Conversation 0.2.0-rc.2 stamps its session occurrence and chat region.
export function renderedConversationBodies(document, sessionId) {
  if (typeof document?.querySelectorAll !== 'function') return [];
  return Array.from(document.querySelectorAll('[data-conversation-region="chat"][data-conversation-session]'))
    .filter(region => region.getAttribute('data-conversation-session') === sessionId)
    .flatMap(region => Array.from(region.querySelectorAll('.IzP3Va_bubble,.gKv1-q_body,.Sixlwa_bubble,.hWmORq_body')))
    .filter(body => !body.closest('[data-streaming],[data-pending-steering],[data-submission-echo],[data-notebook-library],[data-notebook-overlay]'))
    // UserStyleBubble appends extra JSON blocks after projected inline text.
    // Until an extra-block selector is verified, reject the complete bubble
    // when it includes a block child instead of guessing which text is authored.
    .filter(body => !body.matches?.('.IzP3Va_bubble,.Sixlwa_bubble')
      || Array.from(body.children ?? []).every(child => ['SPAN', 'A', 'BR', 'CODE', 'STRONG', 'EM', 'B', 'I', 'U', 'S'].includes(child.tagName)));
}
