import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';

test('typing does not rerun focus effect; close and Esc confirm latest draft', async () => {
  let definition, state, cursor = 0, effectDeps, pendingEffect, effectRuns = 0;
  const refs = [], views = new Map(), cleanups = [];
  new Script(await readFile(new URL('../../src/client/index.js', import.meta.url), 'utf8')).runInContext(createContext({
    window: { __ModuleLoader__: { load: value => { definition = value; } } },
  }));
  let overlayPhase = false;
  const React = { createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_fn, snapshot) => snapshot(),
    useRef(initial) { if (!overlayPhase) return { current: initial }; const i = cursor++; return refs[i] ??= { current: initial }; },
    useState(initial) { state ??= initial; return [state, next => { state = typeof next === 'function' ? next(state) : next; }]; },
    useEffect(setup, deps) { if (overlayPhase && (!effectDeps || deps.some((v, i) => v !== effectDeps[i]))) { effectDeps = deps; pendingEffect = setup; } } };
  definition.factory(() => React).apply({ effect: setup => { cleanups.push(setup()); },
    locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({}) },
    slots: { inject: (_name, setup) => { cleanups.push(setup()); }, register: (options, view) => {
      views.set(options.id, view); return () => views.delete(options.id); } } });
  views.get('dsh-session-notebook.global-entry')({ wide: true }).type({ sessionId: 'fixture' }).props.onClick();
  overlayPhase = true;
  const render = () => { cursor = 0; return views.get('dsh-session-notebook.overlay')(); };
  let dialog = render(), focused = 0, key;
  dialog.props.ref.current = { querySelector: () => ({ focus: () => focused++ }),
    addEventListener: (_name, handler) => { key = handler; }, removeEventListener() {} };
  const teardown = pendingEffect(); pendingEffect = null; effectRuns++;
  const draftProps = () => render().children.find(child => child?.type?.name === 'ManualDraft').props;
  draftProps().setDraft({ open: true, body: '', confirm: false });
  for (const body of ['a', 'ab', 'abc😀']) { draftProps().setDraft(old => ({ ...old, body })); dialog = render(); assert.equal(pendingEffect, null); }
  assert.equal(focused, 1); assert.equal(effectRuns, 1);
  key({ key: 'Escape', preventDefault() {} });
  assert.equal(state.confirm, true); assert.equal(state.body, 'abc😀');
  draftProps().setDraft(old => ({ ...old, confirm: false }));
  render().children[0].children[1].props.onClick(); assert.equal(state.confirm, true);
  draftProps().setDraft({ open: false, body: '', confirm: false });
  draftProps().onDiscard(true); assert.equal(render(), null);
  teardown(); for (const dispose of cleanups.reverse()) dispose();
});
