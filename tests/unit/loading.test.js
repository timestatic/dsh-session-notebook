import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';

const root = new URL('../../', import.meta.url);

test('manifest ships all declared entry points and metadata', async () => {
  const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(manifest.name, '@timestatic/dsh-session-notebook');
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.dependencies, undefined);
  const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[''].version, manifest.version);
  for (const helper of ['selection-draft', 'quote', 'text-anchor', 'rewrite-draft']) {
    const path = `src/client/${helper}.js`;
    assert.ok(manifest.files.includes(path), `${helper} must ship with the bundle`);
    assert.ok((await readFile(new URL(path, root))).length > 0);
  }
  for (const path of ['src/host/preview-routes.js', 'src/client/preview-api.js', 'src/client/manual-save-controller.js', 'src/manual-notebook-service.js', 'src/query.js', 'src/markdown-export.js', 'src/tag-domain.js', 'src/note-domain.js', 'src/notebook-schema.js', 'src/json-backup.js', 'src/snapshot-budget.js', 'src/snapshot-coordinator.js']) {
    assert.ok(manifest.files.includes(path));
    assert.ok((await readFile(new URL(path, root))).length > 0);
  }
  for (const path of [manifest.exports['.'], manifest.exports['./client'], manifest.icon, manifest.dsh.bundle.patch]) {
    assert.ok((await readFile(new URL(path, root))).length > 0);
  }
  for (const language of ['en', 'zh']) {
    const dictionary = JSON.parse(await readFile(new URL(`locale/${language}.json`, root), 'utf8'));
    assert.ok(dictionary.meta.title && dictionary.meta.description);
  }
});

test('client factory is lazy and registers disposable independent slots', async () => {
  let definition;
  let imports = 0;
  const sandbox = createContext({ window: { __ModuleLoader__: { load: value => { definition = value; } } } });
  new Script(await readFile(new URL('src/client/index.js', root), 'utf8')).runInContext(sandbox);
  const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(definition.id, manifest.name, 'Host resolves the Client factory by the installed package name');
  assert.equal(imports, 0);
  const plugin = definition.factory(name => { assert.equal(name, 'react'); imports++; return {}; });
  assert.equal(imports, 1);
  const disposers = [];
  const active = new Map();
  const dictionaries = new Map();
  const ctx = {
    effect(setup) { const dispose = setup(); disposers.push(dispose); return dispose; },
    locale: {
      register(ns, language, dict) {
        assert.equal(ns, 'dsh-session-notebook');
        dictionaries.set(language, dict);
        return () => dictionaries.delete(language);
      },
      bind() { return key => key; },
    },
    slots: {
      inject(name, setup) { const dispose = setup(); disposers.push(dispose); return dispose; },
      register(options, component) {
        assert.equal(typeof component, 'function');
        assert.equal(active.has(options.id), false);
        assert.ok(options.id.startsWith('dsh-session-notebook.'));
        if (options.id === 'dsh-session-notebook.entry') {
          const effects = [];
          const react = {
            createElement: (type, props, ...children) => ({ type, props, children }),
            useSyncExternalStore() {},
            useRef: () => ({ current: null }),
            useEffect: effect => effects.push(effect),
          };
          const renderingPlugin = definition.factory(() => react);
          let entry;
          const renderingDisposers = [];
          renderingPlugin.apply({
            ...ctx,
            effect: setup => { const dispose = setup(); renderingDisposers.push(dispose); return dispose; },
            locale: { ...ctx.locale, register: () => () => {} },
            slots: {
              inject: (_name, setup) => { const dispose = setup(); renderingDisposers.push(dispose); return dispose; },
              register: (opts, view) => { if (opts.id === options.id) entry = view; return () => {}; },
            },
          });
          const rendered = entry({ sessionId: 'synthetic-test' });
          assert.equal(rendered.type, 'button');
          assert.equal(rendered.props.type, 'button');
          assert.equal(rendered.props.style.fontSize, '0.75rem');
          assert.equal(rendered.props.style.padding, '7px 10px');
          for (const dispose of renderingDisposers.reverse()) dispose();
        }
        active.set(options.id, options.name);
        return () => active.delete(options.id);
      },
    },
  };
  const activate = () => {
    plugin.apply(ctx);
    assert.equal(active.size, 3);
    assert.equal(active.get('dsh-session-notebook.global-entry'), 'sidebar.footer.action');
    assert.equal(active.has('dsh-session-notebook.entry'), false);
    assert.equal(active.get('dsh-session-notebook.overlay'), 'shell.overlay');
    assert.equal(dictionaries.size, 2);
    for (const dispose of disposers.splice(0).reverse()) dispose();
    assert.equal(active.size, 0);
    assert.equal(dictionaries.size, 0);
  };
  activate();
  activate();
});

test('global entry works without a session in wide and collapsed sidebar modes', async () => {
  let definition;
  new Script(await readFile(new URL('src/client/index.js', root), 'utf8')).runInContext(
    createContext({ window: { __ModuleLoader__: { load: value => { definition = value; } } } }));
  const views = new Map();
  const cleanups = []; let opened = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useRef: () => ({ current: null }),
    useEffect() {},
    useState: initial => [initial, () => {}],
  };
  definition.factory(() => React).apply({
    sidebarRightTabs: { register: () => () => {} }, sidebarRight: { openTab: () => { opened++; } },
    effect: setup => cleanups.push(setup()),
    locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({}) },
    slots: {
      inject: (_name, setup) => cleanups.push(setup()),
      register: (options, view) => {
        views.set(options.id, view);
        return () => views.delete(options.id);
      },
    },
  });
  const globalEntry = views.get('dsh-session-notebook.global-entry');
  const overlay = views.get('dsh-session-notebook.overlay');
  assert.equal(overlay(), null);
  for (const wide of [true, false]) {
    const entry = globalEntry({ wide });
    const button = entry.type(entry.props);
    assert.equal(button.type, 'button');
    assert.equal(button.props['aria-label'], 'open');
    assert.equal(button.children[0].children[0], '▤');
    assert.equal(button.children[1]?.children[0] ?? null, wide ? 'title' : null);
    assert.equal(button.props.style.background, 'transparent');
    assert.equal(button.props.style.border, 'none');
    button.props.onClick();
    assert.equal(overlay(), null);
  }
  assert.equal(opened, 2);
  for (const dispose of cleanups.reverse()) dispose();
  assert.equal(views.size, 0);
});
