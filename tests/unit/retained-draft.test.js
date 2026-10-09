import { clientUiSource } from '../fixtures/client-ui-source.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Script, createContext } from 'node:vm';

async function harness() {
  let definition;
  const windowListeners = new Map();
  new Script(await clientUiSource())
    .runInContext(createContext({ window: { __ModuleLoader__: { load: value => { definition = value; } },
      addEventListener: (name, fn) => windowListeners.set(name, fn),
      removeEventListener: name => windowListeners.delete(name) } }));
  const views = new Map(), effects = []; let local;
  const React = { createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useRef: current => ({ current }), useEffect() {},
    useState: initial => { local ??= initial; return [local, next => { local = next; }]; } };
  const plugin = definition.factory(() => React);
  const ctx = { effect: setup => effects.push(setup()),
    get: key => key === 'sidebarRightTabs' ? { register: () => () => {} }
      : key === 'sidebarRight' ? { openTab() {} } : undefined,
    locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({}) },
    slots: { inject: (_key, setup) => effects.push(setup()), register: (options, view) => {
      views.set(options.key ?? options.id, view); return () => views.delete(options.key ?? options.id);
    } } };
  plugin.apply(ctx);
  function editor(sessionId) {
    const panel = views.get('dsh-session-notebook')({ sessionId,
      useTabInfo: () => ({ tab: { actions: { close() {} } } }) });
    const entry = panel.children.at(-3);
    return views.get('notebook-test-draft')({ ...entry.props, unified: false });
  }
  return { editor, windowListeners, unmount: () => { local = undefined; },
    dispose: () => { for (const cleanup of effects.reverse()) cleanup?.(); } };
}

test('title-only drafts are retained across panel remount and protected on close, discard and unload', async () => {
  const h = await harness();
  h.editor('title-session').props.onClick();
  h.editor('title-session').children[0].children[1].props.onChange({ target: { value: '  标题😀  ' } });
  h.unmount();
  assert.equal(h.editor('title-session').children[0].children[1].props.value, '  标题😀  ');
  assert.equal(h.editor('title-session').children[1].children[1].props.value, '');
  let prevented = false;
  const event = { preventDefault() { prevented = true; }, returnValue: undefined };
  h.windowListeners.get('beforeunload')(event);
  assert.equal(prevented, true);
  h.editor('title-session').children[3].props.onClick();
  assert.equal(h.editor('title-session').children[3].children[0].children[0], 'confirmDiscard');
  h.editor('title-session').children[3].children[2].props.onClick();
  assert.equal(h.editor('title-session').children[0].children[1].props.value, '  标题😀  ');
  h.editor('title-session').children[3].props.onClick();
  h.editor('title-session').children[3].children[1].props.onClick();
  assert.equal(h.editor('title-session').type, 'button');
  prevented = false; h.windowListeners.get('beforeunload')(event);
  assert.equal(prevented, false);
  h.dispose();
});

test('host panel removal and remount retain exact unsaved body independently per session', async () => {
  const h = await harness();
  h.editor('A').props.onClick();
  h.editor('A').children[1].children[1].props.onChange({ target: { value: '  **A**\r\n😀  ' } });
  h.unmount();
  assert.equal(h.editor('A').children[1].children[1].props.value, '  **A**\r\n😀  ');
  // Reuse the same hook state, as a host context change might do.
  assert.equal(h.editor('B').type, 'button');
  h.editor('B').props.onClick();
  h.editor('B').children[1].children[1].props.onChange({ target: { value: 'B' } });
  assert.equal(h.editor('A').children[1].children[1].props.value, '  **A**\r\n😀  ');
  assert.equal(h.editor('B').children[1].children[1].props.value, 'B');
  h.editor('A').children[3].props.onClick();
  h.editor('A').children[3].children[1].props.onClick();
  h.unmount(); assert.equal(h.editor('A').type, 'button');
  assert.equal(h.editor('B').children[1].children[1].props.value, 'B');
  let prevented = false;
  const event = { preventDefault() { prevented = true; }, returnValue: undefined };
  h.windowListeners.get('beforeunload')(event);
  assert.equal(prevented, true); assert.equal(event.returnValue, '');
  h.editor('B').children[3].props.onClick();
  h.editor('B').children[3].children[1].props.onClick();
  prevented = false; h.windowListeners.get('beforeunload')(event);
  assert.equal(prevented, false);
  h.dispose(); assert.equal(h.windowListeners.size, 0);
});
