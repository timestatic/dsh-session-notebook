import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';

test('native type registration pairs body key and opens through sidebar controller', async () => {
  let definition;
  new Script(await readFile(new URL('../../src/client/index.js', import.meta.url), 'utf8'))
    .runInContext(createContext({ window: { __ModuleLoader__: { load: value => { definition = value; } } } }));
  const views = new Map();
  const disposers = [];
  const opens = [];
  let registered;
  let removed = false;
  let closed = false;
  const services = {
    sidebarRightTabs: { register: value => { registered = value; return () => { removed = true; }; } },
    sidebarRight: { openTab: kind => opens.push(kind) },
  };
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useRef: () => ({ current: null }), useEffect() {}, useState: initial => [initial, () => {}],
  };
  definition.factory(() => React).apply({
    get: key => services[key],
    effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose; },
    locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({ revision: 1 }) },
    slots: {
      inject: (_key, setup) => { const dispose = setup(); disposers.push(dispose); return dispose; },
      register: (options, view) => { views.set(options.key ?? options.id, view); return () => views.delete(options.key ?? options.id); },
    },
  });
  assert.equal(registered.id, 'dsh-session-notebook');
  assert.equal(registered.kind, registered.id);
  assert.equal(registered.title(), 'title');
  const entry = views.get('dsh-session-notebook.global-entry')({ wide: true }).type({ sessionId: 'fixture' });
  entry.props.onClick();
  assert.deepEqual(opens, ['dsh-session-notebook']);
  assert.equal(views.get('dsh-session-notebook.overlay')(), null);
  const panel = views.get(registered.id)({
    sessionId: 'fixture', useTabInfo: () => ({ tab: { actions: { close: () => { closed = true; } } } }),
  });
  panel.children[0].children[1].props.onClick();
  assert.equal(closed, true);
  assert.equal(panel.children.at(-2).type().props['data-notebook-version'],
    JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).version);
  const workspaceView = panel.children.at(-4).type;
  assert.equal(panel.children.at(-3).type.name, 'NotebookHome');
  const snapshot = { state: 'idle', phase: 'ready', items: [
    { title: 'Other', path: '/other', sessionIds: ['another'] },
    { title: 'Fixture Workspace', path: '/canonical/fixture', sessionIds: ['fixture'] },
  ] };
  const renderWorkspace = (sessionId = 'fixture') => workspaceView({
    sessionId, useWorkspaces: selector => selector(snapshot),
  });
  const workspace = renderWorkspace();
  assert.equal(workspace.children[0].children[0], 'Fixture Workspace');
  assert.equal(workspace.props.title, '/canonical/fixture');
  assert.equal(workspace.children[1].children[0], ' · 工作区');
  assert.equal(renderWorkspace('missing').children[0].children[0], 'noWorkspace');
  snapshot.items.push({ title: 'Ambiguous', path: '/wrong', sessionIds: ['fixture'] });
  assert.equal(renderWorkspace().children[0].children[0], 'workspaceAmbiguous');
  snapshot.items.pop();
  snapshot.items[1] = { title: 'Updated Workspace', path: '/updated', sessionIds: ['fixture'] };
  assert.equal(renderWorkspace().children[0].children[0], 'Updated Workspace');
  assert.equal(renderWorkspace().props.title, '/updated');
  snapshot.phase = 'pending';
  assert.equal(renderWorkspace().children[0].children[0], 'workspacePending');
  snapshot.state = 'error';
  assert.equal(renderWorkspace().children[0].children[0], 'workspaceError');
  const globalComponent = views.get('dsh-session-notebook.global-entry')({ wide: false });
  const globalEntry = globalComponent.type(globalComponent.props);
  assert.equal(globalEntry.children[0].children[0], '▤');
  assert.equal(globalEntry.children[1], null);
  assert.equal(globalEntry.props['aria-label'], 'open');
  globalEntry.props.onClick();
  assert.equal(opens.length, 2, 'global menu opens the same native pane');
  assert.equal(views.get('dsh-session-notebook.overlay')(), null);
  for (const dispose of disposers.reverse()) dispose();
  assert.equal(removed, true);
  assert.equal(views.size, 0);
});
