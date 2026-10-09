import { clientUiSource } from '../fixtures/client-ui-source.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { Script, createContext } from 'node:vm';
import { backupJson } from '../../src/json-backup.js';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';

async function harness(storageReady = true, { loseFirstReply = false,
  holdSaveList = false, holdSearch = false, holdBackup = false, invalidBackup = false,
  conflictOnce = false, invalidReadyList = false } = {}) {
  let definition;
  const downloads = [], revoked = [];
  let currentBlob;
  const context = createContext({
      window: { crypto: webcrypto, __ModuleLoader__: { load: value => { definition = value; } },
        document: { createElement: tag => { assert.equal(tag, 'a'); return {
          click() { downloads.push({ filename: this.download, href: this.href, blob: currentBlob }); },
        }; } },
        URL: { createObjectURL(blob) { currentBlob = blob; return 'blob:fixture'; },
          revokeObjectURL(href) { revoked.push(href); } } },
      AbortController, Blob, setTimeout, clearTimeout, URL, TextEncoder,
    });
  // Backup validation compares plain-object prototypes; clone into the same
  // browser realm that parses the backup instead of Node's outer test realm.
  new Script('globalThis.structuredClone = value => JSON.parse(JSON.stringify(value))').runInContext(context);
  new Script(await clientUiSource())
    .runInContext(context);
  const views = new Map(), cleanups = [], calls = [], state = new Map(), effects = new Map();
  let component, hook = 0, revision = 0;
  let listCalls = 0, releaseList, releaseSearch, releaseBackup;
  let conflicted = false;
  const notes = new Map();
  const receipts = new Map();
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useState(initial) {
      const key = `${component}:${hook++}`;
      if (!state.has(key)) state.set(key, initial);
      return [state.get(key), value => state.set(key, typeof value === 'function' ? value(state.get(key)) : value)];
    },
    useRef(initial) { const key = `${component}:${hook++}`;
      if (!state.has(key)) state.set(key, { current: initial }); return state.get(key); },
    useEffect(setup) { const key = `${component}:${hook++}`;
      if (!effects.has(key)) effects.set(key, setup()); },
  };
  const list = (search = '') => { const matching = [...notes.values()].filter(note =>
    `${note.title}\n${note.bodyMarkdown}`.includes(search)); return { epoch: 'e', revision,
    total: matching.length, ids: matching.map(note => note.id),
    items: matching.map(note => ({ id: note.id, title: note.title, excerpt: note.bodyMarkdown,
      version: note.version, updatedAt: note.updatedAt })) };
  };
  const rpc = async (channel, method, payload) => {
    assert.equal(channel, '/api'); calls.push({ method, payload: structuredClone(payload) });
    if (method === 'dsh-session-notebook/health') return { ok: true,
      value: { status: 'ok', phase: storageReady ? 1 : 0, storageReady } };
    if (method === 'dsh-session-notebook/list') return { ok: true,
      value: { items: [], phase: 0, storageReady: false } };
    if (method === 'dsh-session-notebook/manual/list') {
      listCalls++;
      if (invalidReadyList) return { ok: true, value: { items: [] } };
      if (holdSaveList && listCalls === 3) await new Promise(resolve => { releaseList = resolve; });
      if (holdSearch && payload.search === 'stale') await new Promise(resolve => { releaseSearch = resolve; });
      return { ok: true, value: list(payload.search) };
    }
    if (method === 'dsh-session-notebook/manual/create') {
      if (!receipts.has(payload.requestId)) {
        assert.equal(payload.expectedRevision, revision);
        const note = { id: 'manual_1', kind: 'manual', title: payload.title ?? '',
          bodyMarkdown: payload.bodyMarkdown, version: 1, updatedAt: '2026-10-05T00:00:00Z' };
        notes.set(note.id, note); revision++;
        receipts.set(payload.requestId, { epoch: 'e', revision, noteId: note.id });
        if (loseFirstReply) throw new Error('reply lost after commit');
      }
      return { ok: true, value: receipts.get(payload.requestId) };
    }
    if (method === 'dsh-session-notebook/manual/update') {
      if (conflictOnce && !conflicted) {
        conflicted = true;
        const old = notes.get(payload.id);
        notes.set(old.id, { ...old, bodyMarkdown: '服务器修改', version: old.version + 1 });
        revision++;
        return { ok: false, error: { code: 'VERSION_CONFLICT' } };
      }
      assert.equal(payload.expectedRevision, revision);
      const old = notes.get(payload.id);
      assert.equal(payload.expectedVersion, old.version);
      notes.set(old.id, { ...old, title: payload.title, bodyMarkdown: payload.bodyMarkdown,
        version: old.version + 1, updatedAt: '2026-10-05T00:01:00Z' });
      revision++;
      return { ok: true, value: { epoch: 'e', revision, noteId: old.id } };
    }
    if (method === 'dsh-session-notebook/manual/get') return { ok: true,
      value: { epoch: 'e', revision, note: notes.get(payload.id) } };
    if (method === 'dsh-session-notebook/manual/backup') {
      if (holdBackup) await new Promise(resolve => { releaseBackup = resolve; });
      return { ok: true, value: invalidBackup ? { content: '{}', bytes: 2, revision: 0 }
        : backupJson(notebookFixture()) };
    }
    assert.fail(`unexpected RPC ${method}`);
  };
  definition.factory(() => React).apply({
    effect: setup => { cleanups.push(setup()); },
    get: key => key === 'sidebarRightTabs' ? { register: () => () => {} }
      : key === 'sidebarRight' ? { openTab() {} } : undefined,
    connection: { rpc: { call: rpc } },
    locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({}) },
    slots: { inject: (_key, setup) => { cleanups.push(setup()); },
      register: (options, view) => { views.set(options.key ?? options.id, view); return () => {}; } },
  });
  const render = (name, view, props = {}) => {
    component = name; hook = 0; return view(props);
  };
  const panel = () => render('panel', views.get('dsh-session-notebook'), {
    sessionId: 'fixture', useTabInfo: () => ({ tab: { actions: { close() {} } } }),
    useWorkspaces: () => ({ phase: 'ready', items: [] }),
  });
  const status = () => { const item = panel().children.at(-1); return render('status', item.type, item.props); };
  const draft = () => { const item = panel().children.at(-3); return render('draft', views.get('notebook-test-draft'), { ...item.props, unified: false }); };
  const openDraft = () => { const view = draft();
    (view.type === 'button' ? view : view.children[0]).props.onClick(); };
  const library = () => { const item = draft().children.at(-1); return render('library', item.type, item.props); };
  const dispose = () => { for (const cleanup of effects.values()) cleanup?.();
    for (const cleanup of cleanups.reverse()) cleanup?.(); };
  return { status, draft, openDraft, library, calls, notes, downloads, revoked, dispose,
    releaseList: () => releaseList?.(), releaseSearch: () => releaseSearch?.(),
    releaseBackup: () => releaseBackup?.() };
}

const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

test('Phase 0 never requests the manual API or offers save controls', async () => {
  const ui = await harness(false);
  ui.status(); await flush();
  ui.openDraft();
  const editor = ui.draft();
  assert.equal(editor.children.some(child => child?.props?.['data-notebook-manual-library']), false);
  assert.deepEqual(ui.calls.map(call => call.method),
    ['dsh-session-notebook/health', 'dsh-session-notebook/list']);
  ui.dispose();
});

test('a ready health claim without a valid manual list never enables saving', async () => {
  const ui = await harness(true, { invalidReadyList: true });
  ui.status(); await flush(); ui.openDraft();
  assert.equal(ui.status().children[0].children[0], 'failed');
  assert.equal(ui.draft().children.some(child => child?.type?.name === 'ManualNotebook'), false);
  assert.equal(ui.calls.some(call => call.method === 'dsh-session-notebook/manual/create'), false);
  ui.dispose();
});

test('ready Host enables one manual create through the bundled controller and refreshes detail', async () => {
  const ui = await harness();
  ui.status(); await flush();
  assert.equal(ui.status().children[0].children[0], 'ready');
  assert.equal(ui.draft().type, 'div', 'the library is visible before opening the editor');
  ui.library(); await flush();
  assert.equal(ui.library().children.at(-2).children[0], 'noNotes');
  ui.openDraft();
  ui.draft().children[0].children[1].props.onChange({ target: { value: '标题' } });
  ui.draft().children[1].children[1].props.onChange({ target: { value: '**正文**😀' } });
  const page = ui.library(); await flush();
  page.children[0].props.onClick(); await new Promise(resolve => setImmediate(resolve)); await flush();
  assert.equal(ui.notes.size, 1);
  assert.equal(ui.notes.get('manual_1').bodyMarkdown, '**正文**😀');
  assert.equal(ui.calls.filter(call => call.method === 'dsh-session-notebook/manual/create').length, 1);
  assert.equal(ui.calls.filter(call => call.method === 'dsh-session-notebook/manual/get').length, 1);
  assert.equal(ui.draft().children[1].children[1].props.value, '');
  assert.equal(ui.library().children.at(-1).children[0].children[0], '标题');
  ui.library().children.at(-1).children.at(-2).props.onClick();
  assert.equal(ui.library().children.at(-1), null);
  assert.equal(ui.library().children.at(-2).type, 'ul');
  ui.dispose();
});

test('over-limit pasted title and search stay editable and do not reach the Host', async () => {
  const ui = await harness();
  ui.status(); await flush(); ui.openDraft(); ui.library(); await flush();
  const title = '😀'.repeat(1001);
  ui.draft().children[0].children[1].props.onChange({ target: { value: title } });
  ui.draft().children[1].children[1].props.onChange({ target: { value: '正文' } });
  assert.equal(ui.draft().children[0].children[1].props.value, title);
  ui.library().children[0].props.onClick(); await flush();
  assert.equal(ui.calls.some(call => call.method === 'dsh-session-notebook/manual/create'), false);
  assert.deepEqual(ui.library().children[6].children, ['TITLE_LIMIT', ' — ', 'titleLimit']);
  ui.draft().children[0].children[1].props.onChange({ target: { value: '短标题' } });
  const search = '😀'.repeat(1001);
  ui.library().children[2].children[0].children[1].props.onChange({ target: { value: search } });
  const before = ui.calls.length;
  ui.library().children[2].props.onSubmit({ preventDefault() {} });
  assert.equal(ui.calls.length, before);
  assert.equal(ui.library().children[2].children[0].children[1].props.value, search);
  assert.deepEqual(ui.library().children[6].children, ['SEARCH_LIMIT', ' — ', 'searchLimit']);
  ui.dispose();
});

test('ready library searches through the manual RPC and clears the filter without global fetch', async () => {
  const ui = await harness(true, { holdSearch: true });
  ui.status(); await flush(); ui.openDraft();
  ui.draft().children[0].children[1].props.onChange({ target: { value: '目标标题' } });
  ui.draft().children[1].children[1].props.onChange({ target: { value: '正文内容' } });
  ui.library(); await flush();
  ui.library().children[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const searchInput = () => ui.library().children[2].children[0].children[1];
  searchInput().props.onChange({ target: { value: '找不到' } });
  ui.library().children[2].props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.library().children.at(-2).children[0], 'noNotes');
  assert.deepEqual(ui.calls.filter(call => call.method === 'dsh-session-notebook/manual/list').at(-1).payload,
    { search: '找不到' });
  searchInput().props.onChange({ target: { value: 'stale' } });
  ui.library().children[2].props.onSubmit({ preventDefault() {} });
  await flush();
  searchInput().props.onChange({ target: { value: '目标' } });
  ui.library().children[2].props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.library().children.at(-2).children[0].children[0].children[0], '目标标题');
  ui.releaseSearch(); await flush();
  assert.equal(ui.library().children.at(-2).children[0].children[0].children[0], '目标标题',
    'an older search response cannot overwrite newer results');
  ui.library().children[2].children[2].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(ui.calls.filter(call => call.method === 'dsh-session-notebook/manual/list').at(-1).payload, {});
  ui.dispose();
});

test('ready UI validates a complete backup and requests one JSON download', async () => {
  const ui = await harness();
  ui.status(); await flush(); ui.openDraft(); ui.library(); await flush();
  const button = ui.library().children[3];
  button.props.onClick(); button.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.calls.filter(call => call.method === 'dsh-session-notebook/manual/backup').length, 1);
  assert.equal(ui.downloads.length, 1);
  assert.match(ui.downloads[0].filename, /^dsh-session-notebook-rev-0-\d{14}\.json$/);
  assert.equal(ui.downloads[0].href, 'blob:fixture');
  assert.equal((await ui.downloads[0].blob.text()).includes('dsh-session-notebook-backup'), true);
  assert.deepEqual(ui.revoked, ['blob:fixture']);
  assert.equal(ui.library().children[4].children[0], 'backupStarted');
  ui.dispose();
});

test('invalid or late backup responses never start a download', async () => {
  const invalid = await harness(true, { invalidBackup: true });
  invalid.status(); await flush(); invalid.openDraft(); invalid.library(); await flush();
  invalid.library().children[3].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(invalid.downloads.length, 0);
  assert.equal(invalid.library().children[6].children[0], 'UNSUPPORTED_BACKUP');
  invalid.dispose();

  const late = await harness(true, { holdBackup: true });
  late.status(); await flush(); late.openDraft(); late.library(); await flush();
  late.library().children[3].props.onClick(); await flush();
  late.dispose(); late.releaseBackup(); await flush();
  assert.equal(late.downloads.length, 0);
});

test('lost create reply leaves the visible draft and UI retry reuses the original request ID', async () => {
  const ui = await harness(true, { loseFirstReply: true });
  ui.status(); await flush();
  ui.openDraft();
  ui.draft().children[1].children[1].props.onChange({ target: { value: '保留的正文' } });
  ui.library(); await flush();
  ui.library().children[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.notes.size, 1, 'Host committed before the reply was lost');
  assert.equal(ui.draft().children[1].children[1].props.value, '保留的正文');
  assert.equal(ui.library().children[0].children[0], 'retrySave');
  ui.library().children[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const creates = ui.calls.filter(call => call.method === 'dsh-session-notebook/manual/create');
  assert.equal(creates.length, 2);
  assert.deepEqual(creates[0].payload, creates[1].payload);
  assert.equal(ui.notes.size, 1);
  assert.equal(ui.draft().children[1].children[1].props.value, '');
  ui.dispose();
});

test('ready UI loads a saved detail, edits its Markdown and refreshes the shown version', async () => {
  const ui = await harness();
  ui.status(); await flush(); ui.openDraft();
  ui.draft().children[1].children[1].props.onChange({ target: { value: '旧正文' } });
  ui.library(); await flush(); ui.library().children[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  ui.library().children.at(-2).children[0].children[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  ui.library().children.at(-1).children.at(-1).props.onClick();
  assert.equal(ui.draft().children[1].children[1].props.value, '旧正文');
  ui.draft().children[1].children[1].props.onChange({ target: { value: '更新 **正文**' } });
  ui.library().children[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.notes.get('manual_1').version, 2);
  assert.equal(ui.notes.get('manual_1').bodyMarkdown, '更新 **正文**');
  assert.equal(ui.calls.filter(call => call.method === 'dsh-session-notebook/manual/update').length, 1);
  assert.equal(ui.draft().children[1].children[1].props.value, '');
  assert.equal(ui.library().children.at(-1).children[1].children[0], 'noteVersion: 2');
  ui.dispose();
});

test('a pending revision read locks the draft before save so a late edit cannot be cleared', async () => {
  const ui = await harness(true, { holdSaveList: true });
  ui.status(); await flush(); ui.openDraft();
  ui.draft().children[1].children[1].props.onChange({ target: { value: '提交前正文' } });
  ui.library(); await flush();
  const staleInput = ui.draft().children[1].children[1].props.onChange;
  ui.library().children[0].props.onClick(); await flush();
  assert.equal(ui.draft().children[1].children[1].props.disabled, true);
  staleInput({ target: { value: '迟到的修改' } });
  assert.equal(ui.draft().children[1].children[1].props.value, '提交前正文');
  ui.releaseList(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.notes.get('manual_1').bodyMarkdown, '提交前正文');
  ui.dispose();
});

test('edit conflict compares the latest Host detail and requires an explicit confirm before rebasing', async () => {
  const ui = await harness(true, { conflictOnce: true });
  ui.status(); await flush(); ui.openDraft();
  ui.draft().children[1].children[1].props.onChange({ target: { value: '原文' } });
  ui.library(); await flush(); ui.library().children[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  ui.library().children.at(-2).children[0].children[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  ui.library().children.at(-1).children.at(-1).props.onClick();
  ui.draft().children[1].children[1].props.onChange({ target: { value: '我的修改' } });
  ui.library().children[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.notes.get('manual_1').bodyMarkdown, '服务器修改');
  assert.equal(ui.draft().children[1].children[1].props.value, '我的修改');
  assert.equal(ui.library().children[0].props.disabled, true);
  ui.library().children[7].props.onClick(); await new Promise(resolve => setImmediate(resolve));
  const comparison = ui.library().children[8];
  assert.equal(comparison.children[1].children[0], '服务器修改');
  assert.equal(comparison.children[3].children[0], '我的修改');
  comparison.children[4].props.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.notes.get('manual_1').bodyMarkdown, '我的修改');
  assert.equal(ui.notes.get('manual_1').version, 3);
  ui.dispose();
});

test('a detached panel handler cannot start a new save after unmount', async () => {
  const ui = await harness();
  ui.status(); await flush(); ui.openDraft();
  ui.draft().children[1].children[1].props.onChange({ target: { value: '未提交' } });
  const page = ui.library(); await flush();
  ui.dispose();
  page.children[0].props.onClick(); await flush();
  assert.equal(ui.calls.some(call => call.method === 'dsh-session-notebook/manual/create'), false);
});
