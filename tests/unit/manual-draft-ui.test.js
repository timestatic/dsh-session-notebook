import { clientUiSource } from '../fixtures/client-ui-source.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Script, createContext } from 'node:vm';

test('manual draft UI stays local, prompts before discard and never invokes transport', async () => {
  let definition;
  new Script(await clientUiSource())
    .runInContext(createContext({ window: { __ModuleLoader__: { load: value => { definition = value; } } } }));
  const views = new Map();
  const state = [], cleanups = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useRef: initial => ({ current: initial }), useEffect() {},
    useState(initial) { if (!state.length) state.push(initial);
      return [state[0], value => { state[0] = typeof value === 'function' ? value(state[0]) : value; }]; },
  };
  definition.factory(() => React).apply({
    effect: setup => cleanups.push(setup()),
    get: key => key === 'sidebarRightTabs' ? { register: () => () => {} }
      : key === 'sidebarRight' ? { openTab() {} } : undefined,
    connection: { rpc: { call() { throw Error('draft must not call RPC'); } } },
    locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({}) },
    slots: { inject: (_, setup) => cleanups.push(setup()),
      register: (options, view) => { views.set(options.key ?? options.id, view); return () => views.delete(options.key ?? options.id); } },
  });
  const panelView = views.get('dsh-session-notebook');
  const panelProps = { sessionId: 'fixture', useTabInfo: () => ({ tab: { actions: { close() {} } } }) };
  const panel = () => panelView(panelProps);
  const render = () => { const view = panel().children.at(-3); return views.get('notebook-test-draft')({ ...view.props, unified: false }); };
  const open = render(); assert.equal(open.type, 'button'); open.props.onClick();
  const editor = render(); assert.equal(editor.type, 'section');
  assert.equal(editor.children[0].children[1].type, 'input');
  assert.equal(editor.children[0].children[1].props.maxLength, undefined);
  assert.equal(editor.children[1].children[1].type, 'textarea');
  assert.equal(editor.children[1].children[1].props.maxLength, undefined);
  const pasted = '😀'.repeat(1001);
  editor.children[0].children[1].props.onChange({ target: { value: pasted } });
  assert.equal(render().children[0].children[1].props.value, pasted);
  editor.children[1].children[1].props.onChange({ target: { value: '我的未保存草稿' } });
  panel().children[0].children[1].props.onClick();
  assert.equal(state[0].confirm, true, 'closing panel must not discard nonempty draft');
  render().children[3].children[2].props.onClick();
  render().children[3].props.onClick();
  const confirm = render();
  assert.equal(confirm.children[3].children[0].children[0], 'confirmDiscard');
  confirm.children[3].children[2].props.onClick();
  assert.equal(render().children[1].children[1].props.value, '我的未保存草稿');
  render().children[3].props.onClick();
  render().children[3].children[1].props.onClick();
  assert.equal(render().type, 'button');
  for (const cleanup of cleanups.reverse()) cleanup();
});

async function draftHarness(clipboard) {
  let definition;
  new Script(await clientUiSource())
    .runInContext(createContext({ navigator: { clipboard },
      window: { __ModuleLoader__: { load: value => { definition = value; } } } }));
  const views = new Map(), cleanups = [];
  let state, closed = 0, refIndex = 0, effectRegistered = false;
  const refs = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useState(initial) { state ??= initial; return [state, value => { state = typeof value === 'function' ? value(state) : value; }]; },
    useRef(initial) { const index = refIndex++; refs[index] ??= { current: initial }; return refs[index]; },
    useEffect(setup) { if (!effectRegistered) { effectRegistered = true; cleanups.push(setup()); } },
  };
  definition.factory(() => React).apply({
    effect: setup => cleanups.push(setup()),
    get: key => key === 'sidebarRightTabs' ? { register: () => () => {} }
      : key === 'sidebarRight' ? { openTab() {} } : undefined,
    connection: { rpc: { call() { assert.fail('draft does not call RPC'); } } },
    locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({}) },
    slots: { inject: (_, setup) => cleanups.push(setup()),
      register: (options, view) => { views.set(options.key ?? options.id, view); return () => views.delete(options.key ?? options.id); } },
  });
  const panel = () => views.get('dsh-session-notebook')({ sessionId: 'fixture',
    useTabInfo: () => ({ tab: { actions: { close() { closed++; } } } }) });
  const render = () => { refIndex = 0; const view = panel().children.at(-3); return views.get('notebook-test-draft')({ ...view.props, unified: false }); };
  render().props.onClick();
  return {
    render, panel, get state() { return state; }, get closed() { return closed; },
    edit(body) { render().children[1].children[1].props.onChange({ target: { value: body } }); },
    dispose() { for (const cleanup of cleanups.reverse()) cleanup?.(); },
  };
}

test('copy preserves exact draft text and failures retain the draft with a fixed status', async () => {
  const text = '  **正文**\r\n```\n<svg>😀\n```  ';
  const copied = [];
  const ui = await draftHarness({ writeText: async value => copied.push(value) });
  assert.equal(ui.render().children[4].props.disabled, true);
  ui.edit(text); await ui.render().children[4].props.onClick();
  assert.deepEqual(copied, [text]); assert.equal(ui.state.body, text);
  assert.equal(ui.state.copyStatus, 'copiedDraft'); assert.equal(ui.closed, 0);
  ui.dispose();
  for (const clipboard of [undefined, { writeText: async () => { throw Error('private exception'); } }]) {
    const failed = await draftHarness(clipboard); failed.edit(text);
    await failed.render().children[4].props.onClick();
    assert.equal(failed.state.copyStatus, 'copyDraftFailed');
    assert.equal(failed.state.body, text); assert.equal(failed.state.open, true);
    failed.dispose();
  }
});

test('copy deduplicates clicks and never reports old text as copied after an edit', async () => {
  let resolve, calls = 0;
  const ui = await draftHarness({ writeText: () => { calls++; return new Promise(done => { resolve = done; }); } });
  ui.edit('first'); const pending = ui.render().children[4].props.onClick();
  ui.edit('latest'); assert.equal(ui.render().children[4].props.disabled, true);
  await ui.render().children[4].props.onClick(); assert.equal(calls, 1);
  resolve(); await pending;
  assert.equal(ui.state.body, 'latest'); assert.equal(ui.state.copyStatus, null);
  assert.equal(ui.render().children[4].props.disabled, false); ui.dispose();
});

test('late clipboard completion after unload or discard cannot update a new draft', async () => {
  for (const unload of [true, false]) {
    let resolve;
    const ui = await draftHarness({ writeText: () => new Promise(done => { resolve = done; }) });
    ui.edit('same'); const pending = ui.render().children[4].props.onClick();
    if (unload) ui.dispose();
    else {
      ui.render().children[3].props.onClick(); ui.render().children[3].children[1].props.onClick();
      ui.render().props.onClick(); ui.edit('same');
    }
    const before = ui.state; resolve(); await pending;
    assert.equal(ui.state, before);
    if (!unload) ui.dispose();
  }
});

test('panel-close confirmation closes only after discard; editor discard keeps the panel open', async () => {
  const ui = await draftHarness(); ui.edit('unsaved');
  ui.panel().children[0].children[1].props.onClick(); assert.equal(ui.closed, 0);
  ui.render().children[3].children[2].props.onClick();
  assert.equal(ui.state.body, 'unsaved'); assert.equal(ui.state.closeAfterDiscard, false);
  ui.render().children[3].props.onClick(); ui.render().children[3].children[1].props.onClick();
  assert.equal(ui.closed, 0);
  ui.render().props.onClick(); ui.edit('another');
  ui.panel().children[0].children[1].props.onClick();
  ui.render().children[3].children[1].props.onClick();
  assert.equal(ui.closed, 1); assert.equal(ui.state.body, ''); ui.dispose();
});
