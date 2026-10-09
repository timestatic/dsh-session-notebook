import test from 'node:test';
import assert from 'node:assert/strict';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { notebookSchema } from '../../src/notebook-schema.js';

test('product-shaped Snapshot roundtrips validation without trimming Markdown or Unicode', () => {
  const value = notebookFixture();
  assert.deepEqual(notebookSchema.parse(value), value);
  const parsed = notebookSchema.parse(value); parsed.notes.n1.bodyMarkdown = 'outside';
  assert.notEqual(value.notes.n1.bodyMarkdown, parsed.notes.n1.bodyMarkdown);
});

for (const [name, mutate] of [
  ['unknown field', value => { value.notes.n1.scope = 'global'; }],
  ['removed recent-tag state', value => { value.settings.recentTagIds = ['t1']; }],
  ['removed quick-tag ordering', value => { value.tags.t1.quickTagOrder = 0; }],
  ['removed duplicate quick-tag flag', value => { value.tags.t1.isQuickTag = true; }],
  ['empty note', value => { value.notes.n1.bodyMarkdown = ' '; }],
  ['highlight body', value => { value.notes.n1.kind = 'highlight'; }],
  ['missing quote', value => { delete value.notes.n1.quote; }],
  ['overlong quote', value => { value.notes.n1.quote.content = '😀'.repeat(8001); }],
  ['duplicate tags', value => { value.notes.n1.tagIds.push('t1'); }],
  ['deleted tag association', value => { value.tags.t1.deletedAt = value.tags.t1.createdAt; }],
  ['wrong normalized name', value => { value.tags.t1.normalizedKey = 'TODO'; }],
  ['id mismatch', value => { value.notes.n1.id = 'other'; }],
  ['offset order', value => { value.notes.n1.anchor.startOffset = 100; }],
  ['empty visible span', value => { value.notes.n1.anchor.endOffset = 0; }],
  ['mismatched UTF-16 visible span', value => { value.notes.n1.anchor.endOffset = 10; }],
  ['single non-whitespace code point', value => { value.notes.n1.anchor.exact = '😀'; value.notes.n1.anchor.endOffset = 2; }],
  ['one glyph padded by whitespace', value => { value.notes.n1.anchor.exact = '字  \n'; value.notes.n1.anchor.endOffset = 4; }],

  ['empty Markdown span', value => { value.notes.n1.anchor.markdownStartOffset = 2; value.notes.n1.anchor.markdownEndOffset = 2; }],
  ['unsafe version', value => { value.notes.n1.version = NaN; }],
  ['receipt future revision', value => { value.operationReceipts.r1 = { payloadHash: 'a'.repeat(64), committedRevision: 1 }; }],
]) test(`Snapshot rejects ${name}`, () => {
  const value = notebookFixture(); mutate(value);
  assert.throws(() => notebookSchema.parse(value), error => error.code === 'VALIDATION_FAILED');
});

test('two non-whitespace code points in one glyph are accepted without changing exact text', () => {
  for (const exact of ['e\u0301', '🧑‍💻', '\u0301\u0301']) {
    const value = notebookFixture();
    value.notes.n1.anchor.exact = exact;
    value.notes.n1.anchor.endOffset = exact.length;
    assert.equal(notebookSchema.parse(value).notes.n1.anchor.exact, exact);
  }
});

test('two visible graphemes survive UTF-16 offset validation without trimming', () => {
  const value = notebookFixture();
  value.notes.n1.anchor.exact = '😀e\u0301';
  value.notes.n1.anchor.startOffset = 3;
  value.notes.n1.anchor.endOffset = 7;
  assert.deepEqual(notebookSchema.parse(value).notes.n1.anchor, value.notes.n1.anchor);
});

test('production schema rejects functions, invalid receipt hashes and oversized quote setting', () => {
  const badFunction = notebookFixture(); badFunction.notes.n1.bodyMarkdown = () => 'not serializable';
  assert.equal(notebookSchema.safeParse(badFunction).success, false);
  const badReceipt = notebookFixture(); badReceipt.operationReceipts.r1 = { payloadHash: 42, committedRevision: 0 };
  assert.throws(() => notebookSchema.parse(badReceipt), { code: 'VALIDATION_FAILED' });
  const badLimit = notebookFixture(); badLimit.settings.maxQuoteLength = 8001;
  assert.throws(() => notebookSchema.parse(badLimit), { code: 'VALIDATION_FAILED' });
});

test('Snapshot rejects values JSON would silently drop or transform', () => {
  for (const mutate of [
    value => { value.notes.n1.title = undefined; },
    value => { value.notes.n1.source = new Map([['sessionId', 'lost']]); },
    value => { value.notes.n1.bodyMarkdown = Infinity; },
    value => { value.notes.n1.tagIds.extra = 'lost'; },
    value => { value.notes.n1.extraSymbol = Symbol('lost'); },
  ]) {
    const value = notebookFixture(); mutate(value);
    assert.equal(notebookSchema.safeParse(value).success, false);
  }
  const cyclic = notebookFixture(); cyclic.notes.n1.source.loop = cyclic.notes.n1.source;
  assert.equal(notebookSchema.safeParse(cyclic).success, false);
});

test('Snapshot refuses array holes and object getters before cloning them', () => {
  const sparse = notebookFixture(); sparse.notes.n1.tagIds = new Array(1);
  assert.equal(notebookSchema.safeParse(sparse).success, false);
  const getter = notebookFixture(); let called = false;
  Object.defineProperty(getter.notes.n1, 'title', { enumerable: true,
    get() { called = true; return 'unsafe'; } });
  assert.equal(notebookSchema.safeParse(getter).success, false);
  assert.equal(called, false);
  const hidden = notebookFixture();
  Object.defineProperty(hidden.notes.n1, 'hiddenToken', { enumerable: false, value: 'secret' });
  assert.equal(notebookSchema.safeParse(hidden).success, false);
});

test('Snapshot bounds adversarial nesting before structured cloning', () => {
  const nested = notebookFixture();
  let deeper = nested.notes.n1.source;
  for (let i = 0; i < 30; i++) {
    deeper.extra = {};
    deeper = deeper.extra;
  }
  assert.throws(() => notebookSchema.parse(nested), { code: 'VALIDATION_FAILED' });
});

test('Snapshot requires explicit timezone and valid calendar date', () => {
  for (const timestamp of ['2026-10-04T12:00:00', '2026-13-04T12:00:00Z',
    '2026-10-04T12:00:00+25:00', '2026-02-31T12:00:00Z']) {
    const value = notebookFixture(); value.notes.n1.updatedAt = timestamp;
    assert.equal(notebookSchema.safeParse(value).success, false, timestamp);
  }
  const qualified = notebookFixture(); qualified.notes.n1.updatedAt = '2026-10-04T20:00:00+08:00';
  assert.equal(notebookSchema.safeParse(qualified).success, true);
});

test('manual without source or quote and deleted source snapshot remain valid', () => {
  const value = notebookFixture(); value.notes.n1.kind = 'manual';
  delete value.notes.n1.quote; delete value.notes.n1.anchor; delete value.notes.n1.source;
  assert.deepEqual(notebookSchema.parse(value), value);
  const sourced = notebookFixture(); sourced.notes.n1.source.sessionState = 'deleted';
  assert.deepEqual(notebookSchema.parse(sourced), sourced);
});
