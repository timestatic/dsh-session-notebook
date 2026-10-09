const unavailable = () => ({ ok: false, code: 'INPUT_UNAVAILABLE' });
const changed = () => ({ ok: false, code: 'INPUT_CHANGED' });
const invalid = () => ({ ok: false, code: 'INPUT_INVALID' });
export const MAX_INPUT_INSERT_BYTES = 256 * 1024;
const reserved = /[\uE100-\uE11D\uFFFC]/u;

/** Read only the current, matching Session's public standard input source. */
export function currentInput(uiSession, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return null;
  try {
    const binding = uiSession?.adapter?.current?.getSnapshot?.();
    if (binding?.key !== sessionId) return null;
    const state = binding.hooks?.input?.getSnapshot?.();
    const actions = binding.props?.inputActions;
    if (!state || typeof state.draft !== 'string' || !Number.isSafeInteger(state.draftRev)
      || !Array.isArray(state.occurrences) || !Array.isArray(state.attachmentIds)
      || typeof actions?.insertText !== 'function') return null;
    return { state, actions };
  } catch { return null; }
}

function detectEnd(state) {
  let position = 0, removed = 0;
  for (const occurrence of state.occurrences) {
    if (!Number.isSafeInteger(occurrence?.offset) || occurrence.offset < position
      || !Number.isSafeInteger(occurrence.length) || occurrence.length < 1
      || occurrence.offset + occurrence.length > state.draft.length
      || state.draft.slice(occurrence.offset, occurrence.offset + occurrence.length)
        !== occurrence.clipboardText) return null;
    position = occurrence.offset + occurrence.length;
    removed += occurrence.length - 1;
  }
  return state.draft.length - removed;
}

/** One guarded, undoable edit. The caller confirms against the latest draft before this call. */
export function writeInput(uiSession, sessionId, content, mode, expected) {
  if (typeof content !== 'string' || !content || reserved.test(content)
    || new TextEncoder().encode(content).byteLength > MAX_INPUT_INSERT_BYTES
    || !['append', 'replace'].includes(mode)) return invalid();
  const current = currentInput(uiSession, sessionId);
  if (!current || !['plain', 'claimed'].includes(current.state.phase)) return unavailable();
  const { state, actions } = current;
  if (state.draftRev !== expected?.draftRev || state.draft !== expected?.draft) return changed();
  const end = detectEnd(state);
  if (end === null) return unavailable();
  if (mode === 'replace' && (state.occurrences.length || state.attachmentIds.length)) return unavailable();
  const text = mode === 'append' && state.draft
    ? `${state.draft.endsWith('\n') ? '\n' : '\n\n'}${content}` : content;
  const span = mode === 'replace'
    ? { start: 0, end, draftRev: state.draftRev }
    : { start: end, end, draftRev: state.draftRev };
  try { return actions.insertText(text, span) === true ? { ok: true } : unavailable(); }
  catch { return unavailable(); }
}
