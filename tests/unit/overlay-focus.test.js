import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';

for (const connected of [true, false]) {
  test(`global overlay Esc removes listener and restores only connected trigger (${connected})`, async () => {
    let definition;
    new Script(await readFile(new URL('../../src/client/index.js', import.meta.url), 'utf8'))
      .runInContext(createContext({ window: { __ModuleLoader__: { load: value => { definition = value; } } } }));
    const effects = [];
    const refs = [];
    const views = new Map();
    const disposers = [];
    const React = {
      createElement: (type, props, ...children) => ({ type, props, children }),
      useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
      useRef: () => { const ref = { current: null }; refs.push(ref); return ref; },
      useEffect: setup => effects.push(setup),
      useState: initial => [initial, () => {}],
    };
    definition.factory(() => React).apply({
      effect: setup => { disposers.push(setup()); },
      locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({ revision: 1 }) },
      slots: {
        inject: (_key, setup) => { disposers.push(setup()); },
        register: (options, view) => { views.set(options.id, view); return () => views.delete(options.id); },
      },
    });
    const component = views.get('dsh-session-notebook.global-entry')({ wide: true });
    const trigger = component.type({ ...component.props, nativeOnly: false });
    let restored = 0;
    refs[0].current = { isConnected: connected, focus: () => restored++ };
    const entryCleanup = effects.shift()();
    trigger.props.onClick();
    const overlay = views.get('dsh-session-notebook.overlay');
    const rendered = overlay();
    const handlers = new Map();
    let focused = 0;
    const element = {
      querySelector: selector => { assert.equal(selector, 'button'); return { focus: () => focused++ }; },
      addEventListener: (name, handler) => handlers.set(name, handler),
      removeEventListener: (name, handler) => { assert.equal(handlers.get(name), handler); handlers.delete(name); },
    };
    rendered.props.ref.current = element;
    const dialogCleanup = effects.shift()();
    assert.equal(focused, 1);
    let prevented = 0;
    handlers.get('keydown')({ key: 'Tab', preventDefault: () => prevented++ });
    assert.equal(prevented, 0, 'nonmodal overlay must not intercept Tab');
    assert.equal(overlay().type, 'div');
    handlers.get('keydown')({ key: 'Escape', preventDefault: () => prevented++ });
    assert.equal(prevented, 1);
    assert.equal(overlay(), null);
    rendered.props.ref.current = null;
    dialogCleanup();
    assert.equal(handlers.size, 0, 'cleanup uses captured DOM element even after React clears ref');
    assert.equal(restored, connected ? 1 : 0);
    entryCleanup();
    for (const dispose of disposers.reverse()) dispose();
    assert.equal(views.size, 0);
  });
}
