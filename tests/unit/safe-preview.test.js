import { clientUiSource } from '../fixtures/client-ui-source.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Script, createContext } from 'node:vm';

async function preview(body) {
  let definition, draft;
  const views = new Map();
  new Script(await clientUiSource())
    .runInContext(createContext({ URL, window: { __ModuleLoader__: { load: value => { definition = value; } } } }));
  const React = { createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useRef: current => ({ current }), useEffect() {},
    useState: initial => { draft ??= initial; return [draft, next => { draft = next; }]; } };
  definition.factory(() => React).apply({ effect: setup => setup(),
    get: key => key === 'sidebarRightTabs' ? { register: () => () => {} }
      : key === 'sidebarRight' ? { openTab() {} } : undefined,
    locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({}) },
    slots: { inject: (_key, setup) => setup(), register: (options, view) => {
      views.set(options.key ?? options.id, view); return () => {};
    } } });
  const editor = () => {
    const panel = views.get('dsh-session-notebook')({ sessionId: 'test',
      useTabInfo: () => ({ tab: { actions: { close() {} } } }) });
    const item = panel.children.at(-3); return views.get('notebook-test-draft')({ ...item.props, unified: false });
  };
  editor().props.onClick();
  editor().children[1].children[1].props.onChange({ target: { value: body } });
  const component = editor().children.find(child => child?.props?.['data-notebook-draft-preview'])?.children.at(-1);
  return component.type(component.props);
}
function elements(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...node.children.flatMap(elements)];
}
test('draft preview renders code, links, heading, bold, tasks and emoji without altering source', async () => {
  const tree = await preview('# 标题😀\n**重点** `x()`\n- [x] 已完成\n[文档](https://example.com/a)\n```js\n<script>literal</script>\n```');
  const nodes = elements(tree);
  assert.ok(nodes.some(n => n.type === 'h1'));
  assert.ok(nodes.some(n => n.type === 'strong'));
  assert.ok(nodes.some(n => n.type === 'pre' && n.children[0].children[0] === '<script>literal</script>'));
  assert.ok(nodes.some(n => n.type === 'input' && n.props.checked && n.props.disabled));
  const link = nodes.find(n => n.type === 'a');
  assert.equal(link.props.href, 'https://example.com/a');
  assert.equal(link.props.rel, 'noopener noreferrer');
});
test('unsafe links, images and HTML never become active elements or HTML sinks', async () => {
  const tree = await preview('<img src=x onerror=alert(1)>\n[x](javascript:alert)\n[x](data:text/html,test)\n[x](//evil.test)\n[x](https://user:pass@example.com)\n![track](https://example.com/pixel)');
  for (const node of elements(tree)) {
    assert.ok(!['img', 'script', 'iframe', 'a'].includes(node.type));
    assert.equal(node.props?.dangerouslySetInnerHTML, undefined);
    assert.equal(node.props?.onError, undefined);
  }
});
