import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationAnnotations, renderedConversationBodies } from '../../src/client/conversation-annotations.js';

function fixture(texts = ['前文原文甲乙后文']) {
  const listeners = new Map(), registry = new Map();
  const document = { addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name), createRange: () => ({
      setStart(node, offset) { this.startContainer = node; this.startOffset = offset; },
      setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; },
      getClientRects: () => [{ left: 1, top: 1, right: 10, bottom: 10, width: 9, height: 9 }],
    }) };
  const bodies = texts.map(text => {
    const node = { nodeType: 3, data: text, childNodes: [] };
    const root = { nodeType: 1, tagName: 'DIV', childNodes: [node], ownerDocument: document,
      contains: target => target === node || target === root, querySelectorAll: () => [], closest: () => null };
    node.parentElement = root;
    return root;
  });
  const node = bodies[0].childNodes[0];
  const range = { startContainer: node, startOffset: 2, endContainer: node, endOffset: 6,
    getBoundingClientRect: () => ({ left: 10, bottom: 20 }), intersectsNode: () => false };
  document.getSelection = () => ({ isCollapsed: false, rangeCount: 1,
    getRangeAt: () => range, toString: () => '原文甲乙' });
  class Highlight { constructor(...ranges) { this.ranges = ranges; } }
  let count = 0, rows = [], writes = [], loseReply = false;
  const api = { anchors: async () => ({ epoch: 'e1', revision: writes.length, total: rows.length, items: rows }), library: async () => ({ epoch: 'e1', revision: writes.length, total: rows.length,
    items: rows.map(note => ({ id: note.id, kind: note.kind })) }),
    notesGet: async id => ({ note: rows.find(note => note.id === id) }),
    excerpt: async intent => { writes.push(intent); if (loseReply) { loseReply = false; throw Object.assign(new Error('lost'), { code: 'COMMIT_UNKNOWN' }); }
      rows = [{ id: 'n1', kind: intent.kind, source: intent.source, anchor: intent.anchor }];
      return { epoch: 'e1', revision: writes.length, noteId: 'n1' }; } };
  const adapter = conversationAnnotations({ document, sessionId: 's1', readBodies: () => bodies,
    api, createRequestId: () => `request${++count}`, registry, Highlight });
  return { api, adapter, bodies, range, node, document, listeners, registry, writes,
    setRows(value) { rows = value; }, loseReply() { loseReply = true; } };
}

test('real selection freezes plain text intent; only receipt and reload install highlight', async () => {
  const f = fixture(); f.adapter.capture();
  assert.equal(f.adapter.snapshot().draft.quote.content, '原文甲乙');
  assert.equal(f.registry.size, 0);
  await f.adapter.save('note', '我的批注');
  assert.equal(f.writes[0].kind, 'note'); assert.equal(f.writes[0].bodyMarkdown, '我的批注');
  assert.deepEqual(f.writes[0].source, { sessionId: 's1' });
  assert.equal(f.writes[0].anchor.prefix, '前文');
  assert.equal(f.registry.size, 1);
  f.adapter.dispose(); assert.equal(f.registry.size, 0); assert.equal(f.listeners.size, 0);
});

test('unknown commit retains draft and request; explicit retry uses exact same payload', async () => {
  const f = fixture(); f.adapter.capture(); f.loseReply();
  await f.adapter.save('highlight');
  assert.equal(f.adapter.snapshot().diagnostic, 'COMMIT_UNKNOWN');
  assert.ok(f.adapter.snapshot().draft); assert.ok(f.adapter.snapshot().pending);
  assert.equal(f.registry.size, 0);
  f.adapter.discard(); assert.ok(f.adapter.snapshot().pending);
  await f.adapter.retry(); assert.deepEqual(f.writes[0], f.writes[1]);
  assert.equal(f.adapter.snapshot().pending, null); f.adapter.dispose();
});

function selectOther(f) {
  const node = f.bodies[1].childNodes[0];
  f.range.startContainer = node; f.range.endContainer = node;
  f.range.getBoundingClientRect = () => ({ left: 50, bottom: 80 });
  f.document.getSelection = () => ({ isCollapsed: false, rangeCount: 1,
    getRangeAt: () => f.range, toString: () => '新的文字' });
}

test('unmodified selection follows a new selection and saves its quote and anchor', async () => {
  const f = fixture(['前文原文甲乙后文', '上文新的文字下文']);
  f.listeners.get('mouseup')(); selectOther(f); f.listeners.get('mouseup')();
  assert.equal(f.adapter.snapshot().draft.quote.content, '新的文字');
  assert.deepEqual(f.adapter.snapshot().draft.position, { left: 50, top: 80 });
  await f.adapter.save('highlight');
  assert.equal(f.writes[0].quote.content, '新的文字');
  assert.equal(f.writes[0].anchor.prefix, '上文');
  f.adapter.dispose();
});

test('keyboard reselection updates the position even for the same quote', () => {
  const f = fixture(); f.adapter.capture();
  f.range.getBoundingClientRect = () => ({ left: 90, bottom: 120 });
  f.listeners.get('keyup')();
  assert.deepEqual(f.adapter.snapshot().draft.position, { left: 90, top: 120 });
  f.adapter.dispose();
});

test('reselection preserves typed body, chosen tags, new tag and frozen pending request', async () => {
  for (const edit of [f => f.adapter.editBody('已有批注'), f => f.adapter.editTags(['todo']),
    f => f.adapter.editTags([], '新标签'), async f => { f.loseReply(); await f.adapter.save('highlight'); }]) {
    const f = fixture(['前文原文甲乙后文', '上文新的文字下文']);
    f.adapter.capture(); await edit(f);
    const before = f.adapter.snapshot(); selectOther(f); f.adapter.capture();
    assert.deepEqual(f.adapter.snapshot(), before);
    f.adapter.dispose();
  }
});

test('duplicate contexts across bodies and unloaded originals have visible states without first-match highlight', async () => {
  const f = fixture(['前文原文甲乙后文', '前文原文甲乙后文']);
  f.setRows([{ id: 'n1', kind: 'highlight', source: { sessionId: 's1' },
    anchor: { exact: '原文甲乙', prefix: '前文', suffix: '后文' } },
  { id: 'n2', kind: 'highlight', source: { sessionId: 's1' }, anchor: { exact: '未加载原文' } }]);
  await f.adapter.reload();
  assert.deepEqual(f.adapter.snapshot().items.map(item => item.status), ['ambiguous', 'unloaded-or-changed']);
  assert.equal(f.registry.size, 0); f.adapter.dispose();
});

test('cross-message endpoints and inputs are rejected', () => {
  const f = fixture(['前文原文甲乙后文', '第二条消息']);
  f.range.endContainer = f.bodies[1].childNodes[0]; f.adapter.capture();
  assert.equal(f.adapter.snapshot().draft, null);
  f.range.endContainer = f.node;
  f.bodies[0].closest = () => ({ tagName: 'TEXTAREA' }); f.adapter.capture();
  assert.equal(f.adapter.snapshot().draft, null); f.adapter.dispose();
});

test('verified renderer adapter is session scoped and excludes streaming and submission echoes', () => {
  const good = { closest: () => null }, streaming = { closest: () => ({}) };
  const regions = ['s1', 's2'].map(id => ({ getAttribute: () => id,
    querySelectorAll: () => [good, streaming] }));
  assert.deepEqual(renderedConversationBodies({ querySelectorAll: () => regions }, 's1'), [good]);
  assert.deepEqual(renderedConversationBodies({}, 's1'), []);
});

test('two load/unload rounds preserve foreign CSS Highlight registration', async () => {
  for (let i = 0; i < 2; i++) {
    const f = fixture(); f.adapter.capture(); await f.adapter.save('highlight');
    const foreign = {}; f.registry.set(f.adapter.name, foreign);
    f.adapter.dispose(); assert.equal(f.registry.get(f.adapter.name), foreign); assert.equal(f.listeners.size, 0);
  }
});


test('anchor pagination rejects revision drift without mixed highlights', async () => {
  const f = fixture(); let reads = 0;
  f.api.anchors = async () => ({ epoch: 'e1', revision: ++reads, total: 51,
    items: reads === 1 ? Array.from({ length: 50 }, (_, i) => ({ id: 'n'+i, kind: 'highlight',
      source: { sessionId: 's1' }, anchor: { exact: '原文甲乙' } })) : [] });
  await f.adapter.reload(); assert.equal(f.adapter.snapshot().diagnostic, 'VERSION_CONFLICT');
  assert.equal(f.registry.size, 0); f.adapter.dispose();
});

test('unmount aborts pending reads and ignores late responses', async () => {
  const f = fixture(); let resolve, signal;
  f.api.anchors = (_query, abort) => { signal = abort; return new Promise(done => { resolve = done; }); };
  const pending = f.adapter.reload(); f.adapter.dispose(); assert.equal(signal.aborted, true);
  resolve({ epoch: 'e1', revision: 0, total: 0, items: [] }); await pending;
  assert.equal(f.registry.size, 0); assert.equal(f.listeners.size, 0);
});

test('restored session draft retains the exact pending intent and body', async () => {
  const f = fixture(); f.adapter.capture(); f.adapter.editBody('待保存批注'); f.loseReply();
  await f.adapter.save('note', '待保存批注'); const retained = f.adapter.snapshot(); f.adapter.dispose();
  const second = conversationAnnotations({ document: f.document, sessionId: 's1', readBodies: () => f.bodies,
    api: f.api, createRequestId: () => 'newrequest', registry: f.registry, initialDraft: retained });
  assert.equal(second.snapshot().bodyMarkdown, '待保存批注');
  await second.retry(); assert.deepEqual(f.writes[0], f.writes[1]); second.dispose();
});

test('highlight click reads details; overlap requires explicit choice and never writes', async () => {
  const f = fixture(); const rows = ['n1', 'n2'].map(id => ({ id, kind: 'note', source: { sessionId: 's1' },
    anchor: { exact: '原文甲乙', prefix: '前文', suffix: '后文' }, bodyMarkdown: id }));
  f.setRows(rows); await f.adapter.reload();
  f.document.getSelection = () => ({ isCollapsed: true }); f.document.elementsFromPoint = () => [f.bodies[0]];
  f.listeners.get('click')({ target: f.bodies[0], button: 0, clientX: 5, clientY: 5 });
  assert.deepEqual(f.adapter.snapshot().candidates, ['n1', 'n2']); assert.equal(f.adapter.snapshot().detail, null);
  await f.adapter.openDetail('n2'); assert.equal(f.adapter.snapshot().detail.id, 'n2');
  assert.equal(f.writes.length, 0); f.adapter.dispose();
});

test('Desktop rc2 static contract contains the supported body classes', async () => {
  const { readFile } = await import('node:fs/promises');
  let source;
  try { source = await readFile(new URL('../../.desktop-reference/chat-client.js', import.meta.url), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  assert.match(source, /"bubble": "IzP3Va_bubble"/); assert.match(source, /"body": "gKv1-q_body"/);
});


test('observer disconnect and late callback cannot revive disposed highlights', async () => {
  const f = fixture(); let callback, disconnected = false;
  class Observer { constructor(fn) { callback = fn; } observe() {} disconnect() { disconnected = true; } }
  f.document.body = {};
  const adapter = conversationAnnotations({ document: f.document, sessionId: 's1', readBodies: () => f.bodies,
    api: f.api, createRequestId: () => 'observer', registry: f.registry, Highlight: class {}, MutationObserver: Observer });
  adapter.dispose(); assert.equal(disconnected, true);
  callback([{ target: { nodeType: 1, closest: selector => selector.includes('region') ? {} : null } }]);
  await Promise.resolve(); assert.equal(f.registry.size, 0); f.adapter.dispose();
});

test('whole chat occurrence replacement at an outer parent rematches current bodies and clears removed ranges', async () => {
  const f = fixture(); let callback;
  class Observer { constructor(fn) { callback = fn; } observe() {} disconnect() {} }
  f.document.body = {};
  f.setRows([{ id: 'n1', kind: 'highlight', source: { sessionId: 's1' },
    anchor: { exact: '原文甲乙', prefix: '前文', suffix: '后文' } }]);
  const adapter = conversationAnnotations({ document: f.document, sessionId: 's1', readBodies: () => f.bodies,
    api: f.api, createRequestId: () => 'replacement', registry: f.registry, Highlight: class {}, MutationObserver: Observer });
  await adapter.reload(); assert.equal(f.registry.size, 1);
  const region = { getAttribute: name => name === 'data-conversation-region' ? 'chat' : 's1' };
  const outer = { nodeType: 1, closest: () => null };
  const nested = { querySelectorAll: () => [region] };
  const newBody = fixture().bodies[0];
  f.bodies.splice(0, 1, newBody);
  callback([{ target: outer, addedNodes: [nested], removedNodes: [region] }]);
  assert.equal(f.registry.size, 0);
  await Promise.resolve(); assert.equal(f.registry.size, 1);
  assert.equal(adapter.snapshot().items[0].status, 'found');
  f.bodies.length = 0;
  callback([{ target: outer, addedNodes: [], removedNodes: [nested] }]);
  await Promise.resolve(); assert.equal(f.registry.size, 0);
  assert.equal(adapter.snapshot().items[0].status, 'unloaded-or-changed');
  adapter.dispose(); f.adapter.dispose();
});

test('selected tags and new tag name are frozen in the same excerpt retry intent', async () => {
  const f = fixture(); f.adapter.capture();
  f.adapter.editTags(['builtin_todo'], 'Research');
  f.loseReply(); await f.adapter.save('highlight');
  assert.deepEqual(f.writes[0].tagIds, ['builtin_todo']);
  assert.equal(f.writes[0].newTagName, 'Research');
  f.adapter.editTags([], 'Changed'); await f.adapter.retry();
  assert.deepEqual(f.writes[1], f.writes[0]);
  f.adapter.dispose();
});

test('tag shortcut and highlight save preserve an existing annotation body', async () => {
  const f = fixture(); f.adapter.capture();
  f.adapter.editBody('需要保留的批注'); f.adapter.editTags(['builtin_todo']);
  await f.adapter.save('highlight');
  assert.equal(f.writes[0].kind, 'note');
  assert.equal(f.writes[0].bodyMarkdown, '需要保留的批注');
  assert.deepEqual(f.writes[0].tagIds, ['builtin_todo']);
});

test('annotation discard requires explicit confirmation when body exists', () => {
  const f = fixture(); f.adapter.capture(); f.adapter.editBody('保留我');
  f.adapter.discard(); assert.ok(f.adapter.snapshot().draft);
  f.adapter.discard(true); assert.equal(f.adapter.snapshot().draft, null);
  assert.equal(f.adapter.snapshot().bodyMarkdown, '');
});
