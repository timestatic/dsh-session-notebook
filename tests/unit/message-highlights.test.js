import test from 'node:test';
import assert from 'node:assert/strict';
import { messageHighlights } from '../../src/client/message-highlights.js';

function fixture() {
  const node = { nodeType: 3, data: '原文甲乙，重复重复', childNodes: [] };
  const root = { nodeType: 1, tagName: 'P', childNodes: [node], ownerDocument: {
    createRange: () => ({ setStart(node, offset) { this.startContainer = node; this.startOffset = offset; },
      setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; },
      getClientRects: () => [{ left: 1, top: 1, right: 10, bottom: 10, width: 9, height: 9 }] }),
  } };
  class Highlight { constructor(...ranges) { this.ranges = ranges; } }
  const registry = new Map();
  return { root, node, Highlight, registry, name: 'dsh-notebook-test' };
}
const records = [{ id: 'a', anchor: { exact: '原文甲乙' } },
  { id: 'b', anchor: { exact: '甲乙' } }, { id: 'c', anchor: { exact: '重复' } }];

test('only unique anchors draw; overlapping hits return every candidate and dispose preserves foreign ownership', () => {
  const options = fixture(), layer = messageHighlights(options);
  assert.deepEqual(layer.sync(records).items.map(item => item.status), ['found', 'found', 'ambiguous']);
  assert.equal(options.registry.get(options.name).ranges.length, 2);
  assert.deepEqual(layer.hit(5, 5), ['a', 'b']);
  assert.deepEqual(layer.hit(20, 20), []);
  const foreign = {}; options.registry.set(options.name, foreign);
  layer.dispose(); layer.dispose();
  assert.equal(options.registry.get(options.name), foreign);
  assert.equal(layer.sync(records).status, 'closed');
});

test('no CSS Highlight support uses no wrapper; empty libraries avoid reading a body', () => {
  const unavailable = messageHighlights({ name: 'dsh-notebook-test' });
  assert.equal(unavailable.sync(records).status, 'unavailable');
  const empty = messageHighlights({ ...fixture(), root: null });
  assert.deepEqual(empty.sync([]), { status: 'ready', items: [] });
  empty.dispose(); unavailable.dispose();
});

test('changed source drops stale hits and owned highlight instead of displaying a shifted record', () => {
  const options = fixture(), layer = messageHighlights(options);
  layer.sync(records); options.node.data = '变化后甲乙';
  assert.deepEqual(layer.hit(5, 5), []);
  assert.equal(options.registry.has(options.name), false);
  layer.dispose();
});

test('click interaction rejects selection, covering UI, controls and foreign targets', () => {
  const options = fixture(); const target = { tagName: 'SPAN', parentNode: options.root };
  let selected = false, top = target;
  options.root.contains = node => node === target || node === options.root;
  options.root.ownerDocument.getSelection = () => ({ isCollapsed: !selected });
  options.root.ownerDocument.elementsFromPoint = () => [top];
  const layer = messageHighlights(options); layer.sync(records);
  const event = { target, button: 0, clientX: 5, clientY: 5 };
  assert.deepEqual(layer.hitEvent(event), ['a', 'b']);
  selected = true; assert.deepEqual(layer.hitEvent(event), []);
  selected = false; top = {}; assert.deepEqual(layer.hitEvent(event), []);
  top = target; target.tagName = 'A'; assert.deepEqual(layer.hitEvent(event), []);
  target.tagName = 'SPAN'; assert.deepEqual(layer.hitEvent({ ...event, target: {} }), []);
  assert.deepEqual(layer.hitEvent({ ...event, defaultPrevented: true }), []);
  layer.dispose();
});

test('observers coalesce source changes and late work cannot resurrect highlights after two unload cycles', () => {
  const options = fixture(), jobs = [], observations = [];
  let callback, disconnects = 0;
  class MutationObserver {
    constructor(listener) { callback = listener; }
    observe(root, config) { observations.push({ root, config }); }
    disconnect() { disconnects++; }
  }
  for (let cycle = 0; cycle < 2; cycle++) {
    const reports = [];
    const layer = messageHighlights({ ...options, MutationObserver, schedule: job => jobs.push(job) });
    layer.sync(records);
    assert.equal(layer.watch(() => records, report => reports.push(report)), true);
    assert.equal(layer.watch(() => records), false);
    callback(); callback();
    assert.equal(jobs.length, 1); assert.equal(options.registry.has(options.name), false);
    layer.sync(records); assert.equal(options.registry.has(options.name), true);
    callback(); assert.equal(options.registry.has(options.name), false);
    assert.equal(jobs.length, 1);
    jobs.shift()(); assert.equal(reports.length, 1);
    callback(); layer.dispose(); jobs.shift()();
    assert.equal(options.registry.has(options.name), false);
    assert.equal(reports.length, 1);
  }
  assert.equal(disconnects, 2); assert.equal(observations.length, 2);
});
