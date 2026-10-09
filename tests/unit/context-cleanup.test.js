import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';

test('client overlay subscribers stop receiving updates after plugin disposal and two reloads', async () => {
  let definition;
  new Script(await readFile(new URL('../../src/client/index.js', import.meta.url), 'utf8'))
    .runInContext(createContext({ window: { __ModuleLoader__: { load: value => { definition = value; } } } }));
  const subscriptions = [];
  const views = new Map();
  const effects = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore(subscribe, snapshot) { subscriptions.push(subscribe); return snapshot(); },
    useRef: () => ({ current: null }),
    useEffect: setup => effects.push(setup),
    useState: initial => [initial, () => {}],
  };
  for (let cycle = 0; cycle < 2; cycle++) {
    const disposers = [];
    definition.factory(() => React).apply({
      effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose; },
      locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({ revision: 1 }) },
      slots: {
        inject: (_key, setup) => { disposers.push(setup()); },
        register: (options, view) => { views.set(options.id, view); return () => views.delete(options.id); },
      },
    });
    const entry = views.get('dsh-session-notebook.global-entry')({ wide: true }).type({ sessionId: 'test-session' });
    const overlay = views.get('dsh-session-notebook.overlay');
    assert.equal(overlay(), null);
    const subscribe = subscriptions.at(-2); // Overlay's subscription, followed by locale subscription.
    let calls = 0;
    const unsubscribe = subscribe(() => { calls++; });
    entry.props.onClick();
    assert.equal(calls, 1);
    assert.equal(overlay().type, 'div');
    for (const dispose of disposers.reverse()) dispose();
    entry.props.onClick();
    assert.equal(calls, 1, 'old subscriber is cleared even before React calls unsubscribe');
    unsubscribe();
    for (const release of effects.splice(0)) release()?.();
    subscriptions.length = 0;
    assert.equal(views.size, 0);
  }
});

test('entry teardown closes its overlay even after React clears the DOM ref', async () => {
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
    effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose; },
    locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({ revision: 1 }) },
    slots: {
      inject: (_key, setup) => { const dispose = setup(); disposers.push(dispose); return dispose; },
      register: (options, view) => { views.set(options.id, view); return () => views.delete(options.id); },
    },
  });
  const entry = views.get('dsh-session-notebook.global-entry')({ wide: true }).type;
  const overlay = views.get('dsh-session-notebook.overlay');
  const first = entry({ sessionId: 'synthetic-session-a' });
  const firstRef = refs[0];
  firstRef.current = { isConnected: true };
  const firstTeardown = effects.shift()();
  const second = entry({ sessionId: 'synthetic-session-a' });
  const secondRef = refs[1];
  secondRef.current = { isConnected: true };
  const secondTeardown = effects.shift()();
  first.props.onClick();
  assert.equal(overlay().type, 'div');
  second.props.onClick();
  firstRef.current = null;
  firstTeardown();
  assert.equal(overlay().type, 'div', 'unmounting another entry must not close the owning entry');
  secondRef.current = null;
  secondTeardown();
  assert.equal(overlay(), null, 'unmounting the owner closes its overlay even with a cleared ref');
  for (const dispose of disposers.reverse()) dispose();
});
