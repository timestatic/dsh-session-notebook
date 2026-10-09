import test from 'node:test';
import assert from 'node:assert/strict';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { queryNotes } from '../../src/query.js';

function fixture() {
  const snapshot = notebookFixture();
  const base = snapshot.notes.n1;
  snapshot.tags.t2 = { ...snapshot.tags.t1, id: 't2', name: '重要', normalizedKey: '重要' };
  snapshot.notes.n2 = { ...base, id: 'n2', updatedAt: '2026-10-05T00:00:00.000Z',
    tagIds: ['t1', 't2'], source: { sessionId: 'other', workspacePath: '/canonical/project', sessionState: 'archived' } };
  snapshot.notes.n3 = { ...base, id: 'n3', kind: 'manual', tagIds: [],
    bodyMarkdown: '独立手工草稿', source: undefined, quote: undefined, anchor: undefined };
  snapshot.notes.n4 = { ...base, id: 'n4', deletedAt: '2026-10-06T00:00:00.000Z', tagIds: ['t1'],
    source: { sessionId: 'gone', sessionState: 'deleted' } };
  return snapshot;
}

test('read-only global filtering distinguishes kind from missing session and stable pagination', () => {
  const snapshot = fixture();
  const before = structuredClone(snapshot);
  assert.deepEqual(queryNotes(snapshot, { limit: 2, selectedIds: ['n1', 'n3', 'n4', 'n4'] }), {
    ids: ['n2', 'n1', 'n3'], pageIds: ['n2', 'n1'], total: 3,
    selectedVisibleIds: ['n1', 'n3'], hiddenSelectedCount: 1,
  });
  assert.deepEqual(queryNotes(snapshot, { kind: 'manual' }).ids, ['n3']);
  assert.deepEqual(queryNotes(snapshot, { scope: 'manual' }).ids, ['n3']);
  assert.deepEqual(queryNotes(snapshot, { scope: 'session', sessionId: 'synthetic' }).ids, ['n1']);
  assert.deepEqual(queryNotes(snapshot, { scope: 'workspace', workspacePath: '/canonical/project' }).ids, ['n2']);
  assert.deepEqual(queryNotes(snapshot, { scope: 'archived' }).ids, ['n2']);
  assert.deepEqual(queryNotes(snapshot, { scope: 'unavailable', includeDeleted: true }).ids, ['n4']);
  assert.deepEqual(snapshot, before);
});

test('source constraints combine across scopes without silently broadening results', () => {
  const snapshot = fixture();
  assert.deepEqual(queryNotes(snapshot, { scope: 'workspace', workspacePath: '/canonical/project',
    sessionId: 'other', tagIds: ['t2'] }).ids, ['n2']);
  assert.deepEqual(queryNotes(snapshot, { scope: 'workspace', workspacePath: '/canonical/project',
    sessionId: 'synthetic' }).ids, []);
  assert.deepEqual(queryNotes(snapshot, { scope: 'session', sessionId: 'synthetic',
    workspacePath: '/canonical/project' }).ids, []);
  assert.deepEqual(queryNotes(snapshot, { scope: 'archived', workspacePath: '/canonical/project' }).ids, ['n2']);
  assert.deepEqual(queryNotes(snapshot, { scope: 'all', workspacePath: '/canonical/project' }).ids, ['n2']);
  assert.deepEqual(queryNotes(snapshot, { scope: 'manual', sessionId: 'other' }).ids, []);
});

test('tags, renamed display search, source text and untagged filters are derived', () => {
  const snapshot = fixture();
  assert.deepEqual(queryNotes(snapshot, { tagIds: ['t1', 't2'], tagMode: 'all' }).ids, ['n2']);
  assert.deepEqual(queryNotes(snapshot, { tagIds: ['t2'], search: '重要' }).ids, ['n2']);
  snapshot.tags.t2.name = '复核';
  assert.deepEqual(queryNotes(snapshot, { search: '复核' }).ids, ['n2']);
  assert.deepEqual(queryNotes(snapshot, { search: '/canonical/project' }).ids, ['n2']);
  assert.deepEqual(queryNotes(snapshot, { untagged: true }).ids, ['n3']);
  assert.deepEqual(queryNotes(snapshot, { search: '  独立手工  ' }).ids, ['n3']);
  assert.deepEqual(queryNotes(snapshot, { search: '引用😀' }).ids, ['n2', 'n1']);
});

test('sorting by real timestamps, workspace and tag keys is deterministic', () => {
  const snapshot = fixture();
  snapshot.notes.n1.updatedAt = '2026-10-05T09:00:00+08:00';
  snapshot.notes.n2.updatedAt = '2026-10-05T00:30:00Z';
  assert.deepEqual(queryNotes(snapshot).ids, ['n1', 'n2', 'n3']);
  snapshot.notes.n1.createdAt = '2026-10-05T01:00:00+08:00';
  snapshot.notes.n2.createdAt = '2026-10-05T00:00:00Z';
  assert.deepEqual(queryNotes(snapshot, { sort: 'created' }).ids[0], 'n2');
  assert.throws(() => queryNotes(snapshot, { sort: 'session' }), /INVALID_QUERY/,
    'session ID collation cannot stand in for the undefined product session order');
  assert.deepEqual(queryNotes(snapshot, { sort: 'workspace' }).ids, ['n1', 'n3', 'n2']);
  assert.deepEqual(queryNotes(snapshot, { sort: 'tag' }).ids, ['n3', 'n1', 'n2']);
  snapshot.tags.t1.name = 'Ｚ';
  snapshot.tags.t2.name = 'Ａ';
  assert.deepEqual(queryNotes(snapshot, { sort: 'tag' }).ids, ['n3', 'n2', 'n1'],
    'the smallest normalized tag name, not the smallest raw string, determines order');
});

test('confirmed session order uses activity, keeps each session together and sorts notes within it', () => {
  const snapshot = fixture();
  snapshot.notes.n5 = { ...snapshot.notes.n1, id: 'n5', updatedAt: '2026-10-06T00:00:00Z' };
  const before = structuredClone(snapshot);
  const activity = [{ sessionId: 'synthetic', updatedAt: 100 }, { sessionId: 'other', updatedAt: 200 }];
  assert.deepEqual(queryNotes(snapshot, { sort: 'session', kind: 'note', sessionActivity: activity }).ids,
    ['n2', 'n5', 'n1']);
  assert.deepEqual(queryNotes(snapshot, { sort: 'session', kind: 'note', sessionActivity: activity,
    offset: 1, limit: 1 }).pageIds, ['n5']);
  activity[0].updatedAt = 300;
  assert.deepEqual(queryNotes(snapshot, { sort: 'session', kind: 'note', sessionActivity: activity }).ids,
    ['n5', 'n1', 'n2']);
  assert.deepEqual(snapshot, before);
  assert.throws(() => queryNotes(snapshot, { sort: 'session', sessionActivity: activity }),
    /SESSION_ACTIVITY_UNAVAILABLE/);
  for (const rows of [[...activity, activity[0]], [{ sessionId: 's', updatedAt: NaN }],
    [{ sessionId: 's', updatedAt: '2026-10-06' }], [{ sessionId: 's', updatedAt: 1, extra: true }]])
    assert.throws(() => queryNotes(snapshot, { sort: 'session', kind: 'note', sessionActivity: rows }),
      /INVALID_QUERY/);
});

test('trash-only excludes active notes and time bounds compare instants inclusively', () => {
  const snapshot = fixture(); const before = structuredClone(snapshot);
  assert.deepEqual(queryNotes(snapshot, { trashOnly: true }).ids, ['n4']);
  assert.deepEqual(queryNotes(snapshot, { trashOnly: true, sessionId: 'synthetic' }).ids, []);
  assert.deepEqual(queryNotes(snapshot, { timeField: 'updated',
    from: '2026-10-05T08:00:00+08:00', to: '2026-10-05T00:00:00Z' }).ids, ['n2']);
  assert.deepEqual(queryNotes(snapshot, { timeField: 'updated',
    from: '2026-10-05T00:00:00.001Z' }).ids, []);
  assert.deepEqual(queryNotes(snapshot, { timeField: 'created',
    from: '2026-10-04T00:00:00Z', to: '2026-10-04T00:00:00Z' }).ids, ['n2', 'n1', 'n3']);
  assert.deepEqual(snapshot, before);
});

test('malformed filters fail closed without changing notes', () => {
  const snapshot = fixture();
  for (const filter of [{ scope: 'workspace' }, { scope: 'session' }, { tagMode: 'xor' },
    { tagIds: 't1' }, { tagIds: ['__proto__'] }, { selectedIds: [null] },
    { selectedIds: Array(10001).fill('n1') }, { limit: 0 }, { offset: -1 },
    { search: {} }, { search: 'a'.repeat(1001) }, { scope: 'all', workspacePath: 5 },
    { scope: 'all', workspacePath: '' }, { scope: 'all', sessionId: '' },
    { scope: 'all', workspacePath: 'x'.repeat(4097) }, { scope: 'all', sessionId: 'x'.repeat(4097) },
    { sort: 'random' }, { unexpectedFilter: true }, { trashOnly: 'yes' },
    { trashOnly: true, includeDeleted: true }, { timeField: 'deleted' },
    { from: 'invalid' }, { to: '2026-10-04T00:00:00' },
    { from: '2026-02-31T00:00:00Z' }, { from: '2026-10-06T00:00:00Z', to: '2026-10-05T00:00:00Z' }, []]) {
    assert.throws(() => queryNotes(snapshot, filter), { name: 'TypeError', message: 'INVALID_QUERY' });
  }
});
