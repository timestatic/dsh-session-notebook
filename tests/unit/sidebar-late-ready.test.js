import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';

test('single menu stays disabled until native pane is ready and disables again after withdrawal', async () => {
  let definition, injectCallback;
  new Script(await readFile(new URL('../../src/client/index.js', import.meta.url), 'utf8')).runInContext(createContext({
    window: { __ModuleLoader__: { load: value => { definition = value; } } },
  }));
  const views = new Map(), cleanup = [], nativeCleanup = [], opens = [];
  const slots = { inject: (_name, setup) => { const dispose = setup(); cleanup.push(dispose); return dispose; },
    register: (options, view) => { const key = options.key ?? options.id; views.set(key, view); return () => views.delete(key); } };
  const React = { createElement: (type, props, ...children) => ({ type, props, children }),
    useRef: initial => ({ current: initial }), useEffect() {}, useState: initial => [initial, () => {}],
    useSyncExternalStore: (_subscribe, snapshot) => snapshot() };
  definition.factory(() => React).apply({ get: () => undefined,
    inject: (_keys, callback) => { injectCallback = callback; }, slots,
    effect: setup => { const dispose = setup(); cleanup.push(dispose); return dispose; },
    locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({}) } });
  const render = () => { const item = views.get('dsh-session-notebook.global-entry')({ wide: true }); return item.type(item.props); };
  let entry = render();
  assert.equal(entry.props.disabled, true);
  entry.props.onClick();
  assert.equal(views.get('dsh-session-notebook.overlay')(), null);
  let registered = false;
  injectCallback({ slots: { ...slots, inject: (_name, setup) => { nativeCleanup.push(setup()); } }, sidebarRightTabs: { register: () => { registered = true; return () => { registered = false; }; } },
    sidebarRight: { openTab: kind => opens.push(kind) }, effect: setup => { nativeCleanup.push(setup()); } });
  assert.equal(registered, true);
  entry = render(); assert.equal(entry.props.disabled, false);
  entry.props.onClick(); assert.deepEqual(opens, ['dsh-session-notebook']);
  assert.equal(views.get('dsh-session-notebook.overlay')(), null);
  for (const dispose of nativeCleanup.splice(0).reverse()) dispose();
  assert.equal(registered, false); assert.equal(views.has('dsh-session-notebook'), false);
  entry = render(); assert.equal(entry.props.disabled, true);
  entry.props.onClick(); assert.equal(views.get('dsh-session-notebook.overlay')(), null);
  for (const dispose of cleanup.reverse()) dispose();
});
