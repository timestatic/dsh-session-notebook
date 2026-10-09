import { clientUiSource } from '../fixtures/client-ui-source.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { Script, createContext } from 'node:vm';
import { backupJson, previewBackupReplacement } from '../../src/json-backup.js';
import { notebookFixture } from '../fixtures/notebook-snapshot.js';
import { restoreUpload } from '../../src/restore-upload.js';

const rows = Array.from({ length: 60 }, (_, index) => ({
  id: `n${index}`, kind: index % 2 ? 'manual' : 'note', title: `标题 ${index}`,
  excerpt: `正文 ${index}`, tagIds: index % 2 ? [] : ['t1'],
  source: index % 2 ? null : { sessionId: 'fixture', workspacePath: '/work' },
  createdAt: '2026-10-05T00:00:00Z', updatedAt: '2026-10-05T01:00:00Z',
  deletedAt: null, version: 1,
}));
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

// Keep field tests independent of the advanced-filter disclosure wrapper.
function filterForm(library) {
  return library.children[1];
}
const filterSelect = (library, label) => descendants(filterForm(library)).find(node =>
  node.type === 'select' && node.props?.['aria-label'] === label);
const tagFilter = (library, id) => descendants(filterForm(library)).find(node =>
  node.type === 'button' && node.props?.['data-tag-id'] === id);
const untaggedFilter = library => descendants(filterForm(library)).find(node =>
  node.type === 'button' && node.children[0] === 'libraryUntagged');
const filterSearch = library => descendants(filterForm(library)).find(node =>
  node.type === 'input' && node.props?.type === 'search');
const filterTime = (library, key) => descendants(filterForm(library)).find(node =>
  node.type === 'label' && node.children?.[0] === key)?.children[1];

async function harness(ready = true, { loseFirstTagReply = false, loseFirstNoteReply = false,
  loseFirstConvertReply = false, loseFirstEditReply = false,
  invalidFirstEditReply = false, firstNoteHighlight = false,
  advanceBeforePreview = false, advanceBeforeEdit = false,
  advanceBeforeConvert = false, archivedSource = false, unavailableSource = false,
  clipboardFails = false, unavailableInput = false, inputHasChip = false,
  holdDetail = false, trashMode = false, sessionCatalog = { phase: 'ready', ids: ['fixture'],
    byId: { fixture: { id: 'fixture', updatedAt: 100 } } } } = {}) {
  let definition;
  const copied = [];
  const downloaded = [], revoked = [];
  const context = createContext({ window: { crypto: webcrypto,
    document: { createElement: () => ({ click() { downloaded.push({ filename: this.download,
      href: this.href }); } }) },
    URL: { createObjectURL: () => 'blob:notebook-export',
      revokeObjectURL: href => revoked.push(href) },
    __ModuleLoader__: { load: value => { definition = value; } } },
  AbortController, Blob, btoa: globalThis.btoa, setTimeout, clearTimeout, TextEncoder,
  navigator: { clipboard: { writeText: async value => {
    if (clipboardFails) throw new Error('private clipboard detail');
    copied.push(value);
  } } } });
  new Script('globalThis.structuredClone = value => JSON.parse(JSON.stringify(value))').runInContext(context);
  new Script(await clientUiSource()).runInContext(context);
  const views = new Map(), state = new Map(), effects = new Map(), cleanups = [], calls = [];
  const tags = [{ id: 't1', name: 'TODO', version: 1 }, { id: 't2', name: '重要', version: 1 }];
  const uploads = restoreUpload();
  let backupCurrent = notebookFixture();
  let failBackupPreview = false;
  const noteRows = rows.map(row => ({ ...structuredClone(row),
    ...(row.kind === 'note' ? { bodyMarkdown: `正文 ${row.id}`,
      quote: { format: 'plain_text', content: `原文 ${row.id}` } }
      : { bodyMarkdown: `手工正文 ${row.id}` }) }));
  if (firstNoteHighlight) { noteRows[0].kind = 'highlight'; delete noteRows[0].bodyMarkdown; }
  let tagRevision = 0, tagWrites = 0, firstReplyLost = loseFirstTagReply;
  let noteRevision = 0, noteWrites = 0, firstNoteReplyLost = loseFirstNoteReply;
  let convertWrites = 0, firstConvertReplyLost = loseFirstConvertReply;
  let convertAdvanced = false;
  let editWrites = 0, firstEditReplyLost = loseFirstEditReply;
  let firstEditReceiptInvalid = invalidFirstEditReply, editAdvanced = false;
  const editReceipts = new Map();
  let previewAdvanced = false;
  const receipts = new Map();
  const noteReceipts = new Map();
  const convertReceipts = new Map();
  const sourceCalls = [];
  const inputWrites = [];
  let releaseDetail;
  let inputDraft = inputHasChip ? 'ask /file' : 'existing draft';
  let inputRevision = 1;
  const inputState = () => ({ draft: inputDraft, draftRev: inputRevision, phase: 'plain',
    occurrences: inputHasChip ? [{ offset: 4, length: 5, clipboardText: '/file' }] : [],
    attachmentIds: [] });
  let archived = archivedSource;
  let component, hook = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useState(initial) { const key = `${component}:${hook++}`;
      if (!state.has(key)) state.set(key, initial);
      return [state.get(key), value => state.set(key,
        typeof value === 'function' ? value(state.get(key)) : value)]; },
    useRef(initial) { const key = `${component}:${hook++}`;
      if (!state.has(key)) state.set(key, { current: initial }); return state.get(key); },
    useEffect(setup) { const key = `${component}:${hook++}`;
      if (!effects.has(key)) effects.set(key, setup()); },
  };
  const rpc = async (channel, method, payload) => {
    assert.equal(channel, '/api'); calls.push({ method, payload: structuredClone(payload) });
    if (method === 'dsh-session-notebook/health') return { ok: true,
      value: { status: 'ok', phase: ready ? 1 : 0, storageReady: ready } };
    if (method === 'dsh-session-notebook/list') return { ok: true,
      value: { phase: 0, storageReady: false, items: [] } };
    if (method === 'dsh-session-notebook/manual/list') return { ok: true,
      value: { epoch: 'e', revision: 0, total: 0, ids: [], items: [] } };
    if (method === 'dsh-session-notebook/manual/backup') return { ok: true,
      value: backupJson(notebookFixture()) };
    if (method === 'dsh-session-notebook/backups/begin') return { ok: true,
      value: uploads.begin({ actor: 'ui-operator', ...payload }) };
    if (method === 'dsh-session-notebook/backups/chunk') return { ok: true,
      value: uploads.append({ actor: 'ui-operator', ...payload }) };
    if (method === 'dsh-session-notebook/backups/finish') return { ok: true,
      value: uploads.finish({ actor: 'ui-operator', ...payload }) };
    if (method === 'dsh-session-notebook/backups/preview') {
      if (failBackupPreview) { failBackupPreview = false;
        return { ok: false, error: { code: 'READ_UNAVAILABLE' } }; }
      const imported = uploads.candidate({ actor: 'ui-operator', ...payload });
      const estimatedBytes = Buffer.byteLength(JSON.stringify({ ...imported.snapshot,
        epoch: '0'.repeat(128), revision: backupCurrent.revision + 1, operationReceipts: {} }));
      return { ok: true, value: { token: payload.token, ...previewBackupReplacement(backupCurrent,
        imported), capacity: { estimatedBytes, limitBytes: 1024 * 1024,
        fits: estimatedBytes <= 1024 * 1024 } } };
    }
    if (method === 'dsh-session-notebook/backups/cancel') {
      try {
        uploads.cancel({ actor: 'ui-operator', ...payload });
        return { ok: true, value: { cancelled: true } };
      } catch (error) { return { ok: false, error: { code: error.code } }; }
    }
    if (method === 'dsh-session-notebook/tags/list') return { ok: true,
      value: { epoch: 'e', revision: tagRevision, items: tags.map(tag => ({ ...tag,
        isBuiltin: false, isQuickTag: false, color: null, active: tag.id === 't1' ? 30 : 0,
        trashed: 0 })) } };
    if (method === 'dsh-session-notebook/tags/preview') {
      if (advanceBeforePreview && !previewAdvanced) { tagRevision++; previewAdvanced = true; }
      return { ok: true,
      value: { ...payload, epoch: 'e', revision: tagRevision, sourceVersion: 1,
        ...(payload.action === 'merge' ? { targetVersion: 1 } : {}),
        activeAffected: payload.sourceId === 't1' ? 30 : 0, trashedAffected: 0,
        quickTagAffected: false } };
    }
    if (method.startsWith('dsh-session-notebook/tags/') && !['list', 'preview'].includes(method.split('/').at(-1))) {
      if (!receipts.has(payload.requestId)) {
        assert.equal(payload.expectedRevision, tagRevision);
        tagWrites++; tagRevision++;
        if (method.endsWith('/create')) tags.push({ id: `new${tagWrites}`, name: payload.name, version: 1 });
        if (method.endsWith('/rename')) {
          const tag = tags.find(item => item.id === payload.tagId);
          tag.name = payload.name; tag.version++;
        }
        if (method.endsWith('/merge') || method.endsWith('/delete')) {
          assert.equal(payload.preview.revision, tagRevision - 1);
          tags.splice(tags.findIndex(item => item.id === payload.sourceId), 1);
        }
        receipts.set(payload.requestId, { epoch: 'e', revision: tagRevision });
        if (firstReplyLost) { firstReplyLost = false; throw new Error('reply lost'); }
      }
      return { ok: true, value: receipts.get(payload.requestId) };
    }
    if (method === 'dsh-session-notebook/notes/preview') {
      const entries = payload.ids.map(id => {
        const row = noteRows.find(item => item.id === id);
        assert.ok(row);
        assert.equal(!!row.deletedAt, payload.action !== 'trash');
        return { id, title: row.title, kind: row.kind, version: row.version };
      });
      return { ok: true, value: { action: payload.action, epoch: 'e', revision: noteRevision,
        count: entries.length, entries } };
    }
    if (method === 'dsh-session-notebook/notes/apply') {
      if (!noteReceipts.has(payload.requestId)) {
        assert.equal(payload.confirmed, true);
        assert.equal(payload.expectedRevision, noteRevision);
        noteWrites++; noteRevision++;
        for (const entry of payload.preview.entries) {
          const row = noteRows.find(item => item.id === entry.id);
          assert.ok(row);
          if (payload.action === 'purge') noteRows.splice(noteRows.indexOf(row), 1);
          else { row.deletedAt = payload.action === 'trash' ? '2026-10-05T02:00:00Z' : null; row.version++; }
        }
        noteReceipts.set(payload.requestId, { epoch: 'e', revision: noteRevision });
        if (firstNoteReplyLost) { firstNoteReplyLost = false; throw new Error('reply lost'); }
      }
      return { ok: true, value: noteReceipts.get(payload.requestId) };
    }
    if (method === 'dsh-session-notebook/notes/get') {
      if (holdDetail) await new Promise(resolve => { releaseDetail = resolve; });
      const row = noteRows.find(item => item.id === payload.id);
      return { ok: true, value: row ? { epoch: 'e', revision: noteRevision, note: row } : null };
    }
    if (method === 'dsh-session-notebook/notes/edit') {
      if (advanceBeforeEdit && !editAdvanced) {
        editAdvanced = true; noteRevision++;
        const row = noteRows.find(item => item.id === payload.id);
        row.version++; row.bodyMarkdown = '服务器新正文';
        return { ok: false, error: { code: 'VERSION_CONFLICT' } };
      }
      if (!editReceipts.has(payload.requestId)) {
        const row = noteRows.find(item => item.id === payload.id);
        assert.ok(row); assert.equal(payload.expectedRevision, noteRevision);
        assert.equal(payload.expectedVersion, row.version);
        editWrites++; noteRevision++;
        row.title = payload.title; row.tagIds = [...payload.tagIds];
        if (payload.bodyMarkdown !== undefined) row.bodyMarkdown = payload.bodyMarkdown;
        row.version++;
        editReceipts.set(payload.requestId, { epoch: 'e', revision: noteRevision, noteId: row.id });
        if (firstEditReplyLost) { firstEditReplyLost = false; throw new Error('lost edit reply'); }
        if (firstEditReceiptInvalid) {
          firstEditReceiptInvalid = false;
          return { ok: true, value: { epoch: 'e', revision: noteRevision } };
        }
      }
      return { ok: true, value: editReceipts.get(payload.requestId) };
    }
    if (method === 'dsh-session-notebook/notes/convert') {
      if (advanceBeforeConvert && !convertAdvanced) {
        convertAdvanced = true; noteRevision++;
        const changed = noteRows.find(item => item.id === payload.id);
        changed.version++; changed.bodyMarkdown = '服务端新正文';
        return { ok: false, error: { code: 'VERSION_CONFLICT' } };
      }
      if (!convertReceipts.has(payload.requestId)) {
        const row = noteRows.find(item => item.id === payload.id);
        assert.ok(row);
        assert.equal(payload.expectedRevision, noteRevision);
        assert.equal(payload.expectedVersion, row.version);
        convertWrites++; noteRevision++;
        row.kind = payload.kind; row.version++;
        if (payload.kind === 'highlight') {
          assert.equal(payload.confirmRemoveBody, true);
          delete row.bodyMarkdown;
        } else row.bodyMarkdown = payload.bodyMarkdown;
        convertReceipts.set(payload.requestId, { epoch: 'e', revision: noteRevision, noteId: row.id });
        if (firstConvertReplyLost) { firstConvertReplyLost = false; throw new Error('reply lost'); }
      }
      return { ok: true, value: convertReceipts.get(payload.requestId) };
    }
    if (method === 'dsh-session-notebook/library/query') {
      const filtered = noteRows.filter(item => (!payload.kind || item.kind === payload.kind)
        && (payload.scope !== 'session' || item.source?.sessionId === payload.sessionId)
        && (payload.scope !== 'workspace' || item.source?.workspacePath === payload.workspacePath)
        && (!payload.search || `${item.title}\n${item.excerpt}`.includes(payload.search))
        && (!payload.tagIds?.length || payload.tagIds.every(id => item.tagIds.includes(id)))
        && (!payload.untagged || !item.tagIds.length) && (!!item.deletedAt === !!payload.trashOnly));
      const page = filtered.slice(payload.offset, payload.offset + payload.limit);
      return { ok: true, value: { epoch: 'e', revision: noteRevision, ids: filtered.map(item => item.id),
        pageIds: page.map(item => item.id), total: filtered.length,
        items: page.map(item => ({ ...item, quoteFormat: item.quote?.format ?? null,
          quoteExcerpt: item.quote?.content ?? '' })),
        selectedVisibleIds: [], hiddenSelectedCount: 0,
        tags: tags.map(tag => ({ id: tag.id, name: tag.name, active: tag.id === 't1' ? 30 : 0, trashed: 0 })) } };
    }
    if (method === 'dsh-session-notebook/markdown/export') {
      const picked = payload.ids.map(id => noteRows.find(item => item.id === id));
      assert.ok(picked.every(row => row && !row.deletedAt));
      assert.equal(payload.epoch, 'e');
      assert.equal(payload.expectedRevision, noteRevision);
      const content = `# 导出\n\n${picked.map(row => `${row.bodyMarkdown}\n${row.quote?.content ?? ''}`).join('\n---\n')}`;
      return { ok: true, value: { epoch: 'e', revision: noteRevision, count: picked.length,
        content, bytes: new TextEncoder().encode(content).byteLength } };
    }
    assert.fail(`unexpected RPC ${method}`);
  };
  definition.factory(() => React).apply({
    effect: setup => cleanups.push(setup()),
    get: key => key === 'sidebarRightTabs' ? { register: () => () => {} }
      : key === 'sidebarRight' ? { openTab() {} } : undefined,
    connection: { rpc: { call: rpc } },
    sessions: { list: { getSnapshot: () => unavailableSource
      ? { phase: 'ready', ids: [], byId: {} } : sessionCatalog } },
    workspaces: { list: { getSnapshot: () => ({ phase: 'ready', archivedSessionIds: archived ? ['fixture'] : [] }) } },
    uiWorkspace: { openSession: id => sourceCalls.push(`open:${id}`),
      unarchiveSession: async id => { sourceCalls.push(`restore:${id}`); archived = false; } },
    uiSession: { adapter: { current: { subscribe: () => () => {}, getSnapshot: () => ({
      key: unavailableInput ? 'other-session' : 'fixture',
      hooks: { input: { subscribe: () => () => {}, getSnapshot: inputState } },
      props: { inputActions: { insertText(text, span) {
        assert.equal(span.draftRev, inputRevision);
        inputWrites.push({ text, span });
        if (span.start === 0 && span.end === inputDraft.length) inputDraft = text;
        else inputDraft += text;
        inputRevision++;
        return true;
      } } },
    }) } } },
    locale: { register: () => () => {}, bind: () => key => key, getSnapshot: () => ({}) },
    slots: { inject: (_key, setup) => cleanups.push(setup()),
      register: (options, view) => { views.set(options.key ?? options.id, view); return () => {}; } },
  });
  const render = (name, view, props = {}) => { component = name; hook = 0; return view(props); };
  const panel = () => render('panel', views.get('dsh-session-notebook'), {
    sessionId: 'fixture', useTabInfo: () => ({ tab: { actions: { close() {} } } }),
    useWorkspaces: selector => selector({ phase: 'ready', items: [{ path: '/work', sessionIds: ['fixture'] }] }),
  });
  const child = name => panel().children.find(item => item?.type?.name === name);
  const status = () => { const item = child('ConnectionStatus'); return render('status', item.type, item.props); };
  const draft = () => { const item = child('NotebookHome'); return render('draft', views.get('notebook-test-draft'), { ...item.props, unified: false }); };
  const launcher = () => { const item = draft().children[1]; return render('launcher', item.type, item.props); };
  const library = () => {
    const item = launcher().children[1];
    const session = render('sessionLibrary', item.type, item.props);
    return render('library', session.type, { ...session.props, trashMode });
  };
  const manager = () => {
    const item = library().children.at(-1);
    return render('tagManager', item.type, item.props);
  };
  const restorePreview = () => {
    const item = library().children.find(child => child?.type?.name === 'RestorePreview');
    return render('restorePreview', item.type, item.props);
  };
  const conversion = () => {
    const item = library().children.find(child => child?.type?.name === 'NoteConversion');
    return render('conversion', item.type, item.props);
  };
  const edit = () => {
    const item = library().children.find(child => child?.type?.name === 'NoteEdit');
    return render('edit', item.type, item.props);
  };
  const dispose = () => { for (const cleanup of effects.values()) cleanup?.();
    for (const cleanup of cleanups.reverse()) cleanup?.(); uploads.close(); };
  return { status, draft, launcher, library, manager, restorePreview, conversion, edit, calls, noteRows,
    setBackupCurrent: value => { backupCurrent = value; },
    failBackupPreviewOnce: () => { failBackupPreview = true; },
    tagWrites: () => tagWrites, noteWrites: () => noteWrites,
    convertWrites: () => convertWrites, editWrites: () => editWrites,
    sourceCalls, copied, downloaded, revoked, inputWrites,
    releaseDetail: () => releaseDetail?.(),
    inputDraft: () => inputDraft, setInputDraft: value => { inputDraft = value; inputRevision++; }, dispose };
}

const descendants = node => node && typeof node === 'object'
  ? [node, ...(node.children ?? []).flatMap(descendants)] : [];
const button = (view, label) => descendants(view).find(node => node.type === 'button'
  && node.children[0] === label);
const input = view => descendants(view).find(node => node.type === 'input' && node.props.type === 'text');

test('Phase 0 has no library launcher or full-library RPC', async () => {
  const ui = await harness(false);
  ui.status(); await flush();
  assert.equal(ui.draft().type, 'button');
  assert.equal(ui.calls.some(call => call.method === 'dsh-session-notebook/library/query'), false);
  ui.dispose();
});

test('basic filters wait for Search and do not require session activity metadata', async () => {
  const ui = await harness(true, { sessionCatalog: { phase: 'pending' } });
  ui.status(); await flush(); ui.launcher().children[0].props.onClick(); ui.library(); await flush();
  const before = ui.calls.filter(call => call.method === 'dsh-session-notebook/library/query').length;
  filterSelect(ui.library(), 'libraryScope').props.onChange({ target: { value: 'session' } });
  assert.equal(ui.calls.filter(call => call.method === 'dsh-session-notebook/library/query').length, before);
  filterForm(ui.library()).props.onSubmit({ preventDefault() {} }); await flush();
  assert.equal(ui.calls.at(-1).payload.sessionId, 'fixture');
  assert.equal(ui.calls.at(-1).payload.sort, 'updated');
  ui.dispose();
});

test('ready library filters by current project, session, kind, tag and time through carrier', async () => {
  const ui = await harness();
  ui.status(); await flush();
  ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  assert.equal(ui.calls.filter(call => call.method === 'dsh-session-notebook/library/query').length, 1);
  const form = () => filterForm(ui.library());
  const result = () => ui.library().children[4];
  assert.equal(result().children[3].children.length, 50);
  result().children[5].props.onClick(); await flush();
  assert.equal(ui.calls.at(-1).payload.offset, 50);
  assert.equal(result().children[3].children.length, 10);
  assert.deepEqual(filterSelect(ui.library(), 'libraryScope').children.map(option => option.props.value),
    ['all', 'workspace', 'session']);
  filterSelect(ui.library(), 'libraryScope').props.onChange({ target: { value: 'workspace' } });
  form().props.onSubmit({ preventDefault() {} }); await flush();
  assert.equal(ui.calls.at(-1).payload.scope, 'workspace');
  assert.equal(ui.calls.at(-1).payload.workspacePath, '/work');
  assert.equal(result().children[3].children.length, 30);
  filterSelect(ui.library(), 'libraryScope').props.onChange({ target: { value: 'session' } });
  form().props.onSubmit({ preventDefault() {} }); await flush();
  assert.equal(ui.calls.at(-1).payload.sessionId, 'fixture');
  assert.equal(result().children[3].children.length, 30);
  filterSelect(ui.library(), 'libraryKindLabel').props.onChange({ target: { value: 'note' } });
  tagFilter(ui.library(), 't1').props.onClick(); await flush();
  form().props.onSubmit({ preventDefault() {} }); await flush();
  assert.deepEqual([ui.calls.at(-1).payload.scope, ui.calls.at(-1).payload.kind,
    ui.calls.at(-1).payload.tagIds], ['session', 'note', ['t1']]);
  assert.equal(result().children[3].children.length, 30);
  result().children[1].props.onClick();
  assert.match(result().children[0].children[0], /librarySelected: 30/);
  filterSelect(ui.library(), 'libraryKindLabel').props.onChange({ target: { value: 'manual' } });
  form().props.onSubmit({ preventDefault() {} }); await flush();
  assert.match(result().children[0].children[0], /libraryHiddenSelected: 30/);
  untaggedFilter(ui.library()).props.onClick(); await flush();
  filterSelect(ui.library(), 'libraryTimeField').props.onChange({ target: { value: 'created' } });
  filterTime(ui.library(), 'libraryFrom').props.onChange({ target: { value: '2026-10-05T00:00:00+08:00' } });
  filterTime(ui.library(), 'libraryTo').props.onChange({ target: { value: '2026-10-06T00:00:00+08:00' } });
  form().props.onSubmit({ preventDefault() {} }); await flush();
  assert.deepEqual([ui.calls.at(-1).payload.untagged, ui.calls.at(-1).payload.trashOnly,
    ui.calls.at(-1).payload.timeField, ui.calls.at(-1).payload.from, ui.calls.at(-1).payload.to,
    ui.calls.at(-1).payload.tagIds],
  [true, false, 'created', '2026-10-04T16:00:00.000Z', '2026-10-05T16:00:00.000Z', undefined]);
  ui.dispose();
});

test('note card and detail show the saved quote, tags, source and times', async () => {
  const ui = await harness();
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  const card = ui.library().children[4].children[3].children[0];
  assert.match(JSON.stringify(card), /原文 n0/);
  assert.match(JSON.stringify(card), /TODO/);
  assert.match(JSON.stringify(card), /2026-10-05T01:00:00Z/);
  button(card, 'libraryDetail').props.onClick(); await flush();
  const detail = descendants(ui.library()).find(node => node.props?.['data-note-detail']);
  assert.ok(detail);
  assert.match(JSON.stringify(detail), /原文 n0/);
  assert.match(JSON.stringify(detail), /正文 n0/);
  assert.match(JSON.stringify(detail), /\/work/);
  assert.equal(ui.calls.at(-1).method, 'dsh-session-notebook/notes/get');
  button(detail, 'libraryCloseDetail').props.onClick();
  assert.equal(descendants(ui.library()).find(node => node.props?.['data-note-detail']), undefined);
  ui.dispose();
});

test('trash detail remains readable while edit and export actions stay hidden', async () => {
  const ui = await harness(true, { trashMode: true });
  ui.noteRows[0].deletedAt = '2026-10-05T02:00:00Z';
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  const card = ui.library().children[4].children[3].children[0];
  assert.ok(button(card, 'libraryDetail'));
  assert.equal(button(card, 'editOpen'), undefined);
  assert.equal(button(card, 'exportOneMarkdown'), undefined);
  button(card, 'libraryDetail').props.onClick(); await flush();
  const detail = descendants(ui.library()).find(node => node.props?.['data-note-detail']);
  assert.ok(detail);
  assert.match(JSON.stringify(detail), /libraryDeletedAt: /);
  assert.match(JSON.stringify(detail), /原文 n0/);
  ui.dispose();
});

test('closing a pending detail ignores a late Host response', async () => {
  const ui = await harness(true, { holdDetail: true });
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  button(ui.library(), 'libraryDetail').props.onClick(); await flush();
  assert.match(JSON.stringify(ui.library()), /libraryDetailLoading/);
  filterSelect(ui.library(), 'libraryScope').props.onChange({ target: { value: 'session' } });
  ui.library().children[1].props.onSubmit({ preventDefault() {} }); await flush();
  ui.releaseDetail(); await flush();
  assert.equal(descendants(ui.library()).find(node => node.props?.['data-note-detail']), undefined);
  ui.dispose();
});

test('generic editor keeps the quote read-only and retries a lost reply with one intent', async () => {
  const ui = await harness(true, { loseFirstEditReply: true });
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  button(ui.library(), 'editOpen').props.onClick(); ui.edit(); await flush();
  assert.match(JSON.stringify(ui.edit()), /原文 n0/);
  input(ui.edit()).props.onChange({ target: { value: '新标题' } });
  descendants(ui.edit()).find(node => node.type === 'textarea').props.onChange({
    target: { value: '我的正文 **修改**' },
  });
  const checkbox = name => descendants(ui.edit()).find(node => node.type === 'label' && node.children[1] === name).children[0];
  checkbox('TODO').props.onChange({ target: { checked: false } });
  checkbox('重要').props.onChange({ target: { checked: true } });
  button(ui.edit(), 'editClose').props.onClick();
  assert.ok(button(ui.edit(), 'editCloseKeep'));
  button(ui.edit(), 'editKeepEditing').props.onClick();
  assert.equal(button(ui.edit(), 'editCloseKeep'), undefined);
  button(ui.edit(), 'editClose').props.onClick();
  button(ui.edit(), 'editCloseKeep').props.onClick();
  assert.equal(ui.library().children.find(child => child?.type?.name === 'NoteEdit'), undefined);
  button(ui.library(), 'editOpen').props.onClick();
  assert.equal(descendants(ui.edit()).find(node => node.type === 'textarea').props.value, '我的正文 **修改**');
  button(ui.edit(), 'editSave').props.onClick(); await flush();
  assert.equal(ui.editWrites(), 1);
  assert.equal(descendants(ui.edit()).find(node => node.type === 'textarea').props.value, '我的正文 **修改**');
  button(ui.edit(), 'editRetry').props.onClick(); await flush();
  const calls = ui.calls.filter(call => call.method === 'dsh-session-notebook/notes/edit');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].payload, calls[1].payload);
  assert.equal(ui.editWrites(), 1);
  assert.equal(ui.noteRows[0].quote.content, '原文 n0');
  assert.equal(ui.noteRows[0].source.sessionId, 'fixture');
  assert.equal(ui.noteRows[0].title, '新标题');
  assert.deepEqual(ui.noteRows[0].tagIds, ['t2']);
  assert.equal(ui.library().children.find(child => child?.type?.name === 'NoteEdit'), undefined);
  ui.dispose();
});

test('generic edit conflict keeps local text until latest version is explicitly accepted', async () => {
  const ui = await harness(true, { advanceBeforeEdit: true });
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  button(ui.library(), 'editOpen').props.onClick(); ui.edit(); await flush();
  descendants(ui.edit()).find(node => node.type === 'textarea').props.onChange({
    target: { value: '我保留的草稿' },
  });
  button(ui.edit(), 'editSave').props.onClick(); await flush();
  assert.equal(ui.editWrites(), 0);
  assert.equal(descendants(ui.edit()).find(node => node.type === 'textarea').props.value, '我保留的草稿');
  button(ui.edit(), 'editReload').props.onClick(); await flush();
  assert.match(JSON.stringify(ui.edit()), /服务器新正文/);
  button(ui.edit(), 'editUseLatest').props.onClick();
  button(ui.edit(), 'editSave').props.onClick(); await flush();
  assert.equal(ui.editWrites(), 1);
  const calls = ui.calls.filter(call => call.method === 'dsh-session-notebook/notes/edit');
  assert.equal(calls[1].payload.expectedRevision, 1);
  assert.equal(calls[1].payload.bodyMarkdown, '我保留的草稿');
  ui.dispose();
});

test('malformed success after an edit commit keeps the same request for receipt recovery', async () => {
  const ui = await harness(true, { invalidFirstEditReply: true });
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  button(ui.library(), 'editOpen').props.onClick(); ui.edit(); await flush();
  input(ui.edit()).props.onChange({ target: { value: '已提交但收据畸形' } });
  button(ui.edit(), 'editSave').props.onClick(); await flush();
  assert.equal(ui.editWrites(), 1);
  assert.match(JSON.stringify(ui.edit()), /INVALID_RESPONSE/);
  button(ui.edit(), 'editRetry').props.onClick(); await flush();
  const calls = ui.calls.filter(call => call.method === 'dsh-session-notebook/notes/edit');
  assert.deepEqual(calls[0].payload, calls[1].payload);
  assert.equal(ui.editWrites(), 1);
  ui.dispose();
});

test('generic editor rejects oversized Unicode input without locking or truncating it', async () => {
  const ui = await harness();
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  button(ui.library(), 'editOpen').props.onClick(); ui.edit(); await flush();
  const title = '😀'.repeat(501);
  input(ui.edit()).props.onChange({ target: { value: title } });
  button(ui.edit(), 'editSave').props.onClick();
  assert.equal(input(ui.edit()).props.value, title);
  assert.match(JSON.stringify(ui.edit()), /TITLE_LIMIT/);
  input(ui.edit()).props.onChange({ target: { value: '短标题' } });
  const body = '字'.repeat(90000);
  descendants(ui.edit()).find(node => node.type === 'textarea').props.onChange({
    target: { value: body },
  });
  button(ui.edit(), 'editSave').props.onClick();
  assert.equal(descendants(ui.edit()).find(node => node.type === 'code'
    && node.props.role === 'status')?.children[0], 'REQUEST_LIMIT');
  assert.equal(descendants(ui.edit()).find(node => node.type === 'textarea').props.value, body);
  assert.equal(ui.calls.some(call => call.method === 'dsh-session-notebook/notes/edit'), false);
  ui.dispose();
});

test('tag create trims name and lost reply retries the same durable request', async () => {
  const ui = await harness(true, { loseFirstTagReply: true });
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.manager(); await flush();
  input(ui.manager()).props.onChange({ target: { value: '  新标签  ' } });
  button(ui.manager(), 'tagCreate').props.onClick(); await flush();
  assert.equal(ui.tagWrites(), 1);
  assert.equal(ui.calls.at(-1).payload.name, '新标签');
  assert.equal(button(ui.manager(), 'tagRetry')?.type, 'button');
  button(ui.manager(), 'tagRetry').props.onClick(); await flush();
  const writes = ui.calls.filter(call => call.method === 'dsh-session-notebook/tags/create');
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].payload, writes[1].payload);
  assert.equal(ui.tagWrites(), 1);
  assert.equal(button(ui.manager(), 'tagRetry'), undefined);
  ui.dispose();
});

test('over-limit library search and tag name retain input without RPC writes', async () => {
  const ui = await harness();
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  const search = '😀'.repeat(1001);
  filterSearch(ui.library()).props.onChange({ target: { value: search } });
  const calls = ui.calls.length;
  ui.library().children[1].props.onSubmit({ preventDefault() {} });
  assert.equal(ui.calls.length, calls);
  assert.equal(filterSearch(ui.library()).props.value, search);
  assert.deepEqual(ui.library().children[3].children, ['SEARCH_LIMIT', ' — ', 'searchLimit']);
  ui.manager(); await flush();
  const name = '😀'.repeat(33);
  input(ui.manager()).props.onChange({ target: { value: name } });
  button(ui.manager(), 'tagCreate').props.onClick();
  assert.equal(ui.tagWrites(), 0);
  assert.equal(input(ui.manager()).props.value, name);
  assert.deepEqual(ui.manager().children.at(-1).children, ['TAG_NAME_LIMIT', ' — ', 'tagNameLimit']);
  ui.dispose();
});

test('tag merge uses the confirmed preview revision and shows active and trash impact', async () => {
  const ui = await harness(true, { advanceBeforePreview: true });
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.manager(); await flush();
  const action = ui.manager().children.find(node => node?.type === 'select');
  action.props.onChange({ target: { value: 'merge' } });
  let selects = descendants(ui.manager()).filter(node => node.type === 'select');
  selects[1].props.onChange({ target: { value: 't1' } });
  selects = descendants(ui.manager()).filter(node => node.type === 'select');
  selects[2].props.onChange({ target: { value: 't2' } });
  assert.equal(ui.calls.some(call => call.method === 'dsh-session-notebook/tags/merge'), false);
  button(ui.manager(), 'tagPreview').props.onClick(); await flush();
  assert.match(JSON.stringify(ui.manager()), /tagActive: 30; tagTrashed: 0/);
  button(ui.manager(), 'tagConfirm').props.onClick(); await flush();
  assert.equal(ui.tagWrites(), 1);
  const merge = ui.calls.find(call => call.method === 'dsh-session-notebook/tags/merge');
  assert.equal(merge.payload.expectedRevision, 1);
  assert.equal(merge.payload.preview.activeAffected, 30);
  assert.equal(merge.payload.preview.trashedAffected, 0);
  ui.dispose();
});

test('trash confirmation shows selected title and lost reply retries one durable write', async () => {
  const ui = await harness(true, { loseFirstNoteReply: true });
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  const first = () => ui.library().children[4].children[3].children[0];
  first().children[0].children[0].props.onChange();
  button(ui.library(), 'noteTrash').props.onClick(); await flush();
  assert.equal(ui.noteWrites(), 0);
  assert.match(JSON.stringify(ui.library()), /标题 0/);
  button(ui.library(), 'noteCancel').props.onClick();
  assert.equal(button(ui.library(), 'noteConfirm'), undefined);
  button(ui.library(), 'noteTrash').props.onClick(); await flush();
  button(ui.library(), 'noteConfirm').props.onClick(); await flush();
  assert.equal(ui.noteWrites(), 1);
  assert.equal(button(ui.library(), 'noteRetry')?.type, 'button');
  button(ui.library(), 'noteRetry').props.onClick(); await flush();
  const writes = ui.calls.filter(call => call.method === 'dsh-session-notebook/notes/apply');
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].payload, writes[1].payload);
  assert.equal(ui.noteWrites(), 1);
  assert.equal(button(ui.library(), 'noteRetry'), undefined);
  ui.dispose();
});

test('trash view restores and permanently removes only confirmed selected notes', async () => {
  const ui = await harness(true, { trashMode: true });
  ui.noteRows[0].deletedAt = '2026-10-05T02:00:00Z';
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  const selectFirst = () => ui.library().children[4].children[3].children[0]
    .children[0].children[0].props.onChange();
  assert.equal(ui.library().children[4].children[3].children.length, 1);
  selectFirst(); button(ui.library(), 'noteRestore').props.onClick(); await flush();
  button(ui.library(), 'noteConfirm').props.onClick(); await flush();
  assert.equal(ui.noteWrites(), 1);
  assert.equal(ui.library().children[4].children[3].type, 'p');
  ui.dispose();

  const purge = await harness(true, { trashMode: true });
  purge.noteRows[0].deletedAt = '2026-10-05T02:00:00Z';
  purge.status(); await flush(); purge.launcher().children[0].props.onClick();
  purge.library(); await flush();
  purge.library().children[4].children[3].children[0].children[0].children[0].props.onChange();
  button(purge.library(), 'notePurge').props.onClick(); await flush();
  assert.match(JSON.stringify(purge.library()), /永久删除 · 1 条/);
  button(purge.library(), 'noteConfirm').props.onClick(); await flush();
  assert.equal(purge.noteWrites(), 1);
  assert.equal(purge.library().children[4].children[3].type, 'p');
  purge.dispose();
});

test('source opening uses workspace navigation; archived source requires restore confirmation', async () => {
  const ready = await harness();
  ready.status(); await flush(); ready.launcher().children[0].props.onClick();
  ready.library(); await flush();
  button(ready.library(), 'sourceOpen').props.onClick();
  assert.deepEqual(ready.sourceCalls, ['open:fixture']);
  ready.dispose();

  const fallbackOnly = await harness(true, { sessionCatalog: { phase: 'ready', ids: [],
    byId: { fixture: { id: 'fixture' } } } });
  fallbackOnly.status(); await flush(); fallbackOnly.launcher().children[0].props.onClick();
  fallbackOnly.library(); await flush();
  button(fallbackOnly.library(), 'sourceOpen').props.onClick();
  assert.deepEqual(fallbackOnly.sourceCalls, []);
  fallbackOnly.dispose();

  const archived = await harness(true, { archivedSource: true });
  archived.status(); await flush(); archived.launcher().children[0].props.onClick();
  archived.library(); await flush();
  button(archived.library(), 'sourceOpen').props.onClick();
  assert.deepEqual(archived.sourceCalls, []);
  button(archived.library(), 'sourceCancel').props.onClick();
  assert.deepEqual(archived.sourceCalls, []);
  button(archived.library(), 'sourceOpen').props.onClick();
  button(archived.library(), 'sourceRestore').props.onClick(); await flush();
  assert.deepEqual(archived.sourceCalls, ['restore:fixture', 'open:fixture']);
  archived.dispose();

  const missing = await harness(true, { unavailableSource: true });
  missing.status(); await flush(); missing.launcher().children[0].props.onClick();
  missing.library(); await flush();
  button(missing.library(), 'sourceOpen').props.onClick();
  assert.deepEqual(missing.sourceCalls, []);
  assert.match(JSON.stringify(missing.library()), /sourceUnavailable/);
  missing.dispose();
});

test('card copies complete Markdown through the Host snapshot and keeps failures private', async () => {
  const ui = await harness();
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  button(ui.library(), 'copyMarkdown').props.onClick(); await flush();
  assert.equal(ui.copied.length, 1);
  assert.match(ui.copied[0], /正文 n0/);
  assert.match(ui.copied[0], /原文 n0/);
  assert.match(JSON.stringify(ui.library()), /copyMarkdownDone/);
  ui.dispose();

  const failed = await harness(true, { clipboardFails: true });
  failed.status(); await flush(); failed.launcher().children[0].props.onClick();
  failed.library(); await flush();
  button(failed.library(), 'copyMarkdown').props.onClick(); await flush();
  assert.deepEqual(failed.copied, []);
  assert.match(JSON.stringify(failed.library()), /copyMarkdownFailed/);
  assert.doesNotMatch(JSON.stringify(failed.library()), /private clipboard detail/);
  failed.dispose();
});

test('selected Markdown downloads one UTF-8 file in list order with explicit options', async () => {
  const ui = await harness();
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  const first = () => ui.library().children[4].children[3].children[0];
  first().children[0].children[0].props.onChange();
  const second = () => ui.library().children[4].children[3].children[2];
  second().children[0].children[0].props.onChange();
  button(ui.library(), '导出 Markdown').props.onClick();
  const controls = () => descendants(ui.library()).find(node => node.props?.['data-markdown-export']);
  assert.equal(controls().props.role, 'dialog');
  controls().children.find(node => node.props?.key === 'includeQuote').children[0].props.onChange({ target: { checked: false } });
  button(ui.library(), '确认下载 Markdown').props.onClick(); await flush();
  const call = ui.calls.find(item => item.method === 'dsh-session-notebook/markdown/export');
  assert.deepEqual(call.payload.ids, ['n0', 'n2']);
  assert.equal(call.payload.options.includeQuote, false);
  assert.equal(ui.downloaded.length, 1);
  assert.match(ui.downloaded[0].filename, /^dsh-session-notebook-rev-0-\d{14}\.md$/);
  assert.deepEqual(ui.revoked, ['blob:notebook-export']);
  assert.match(JSON.stringify(ui.library()), /exportStarted/);
  ui.dispose();
});

test('Markdown export retains the active basic filter', async () => {
  const ui = await harness(true, { sessionCatalog: { phase: 'ready', ids: ['fixture'],
    byId: { fixture: { id: 'fixture', updatedAt: 1234 }, retained: { id: 'retained', updatedAt: 9999 } } } });
  try {
    ui.status(); await flush(); ui.launcher().children[0].props.onClick();
    ui.library(); await flush();
    const form = () => filterForm(ui.library());
    filterSelect(ui.library(), 'libraryScope').props.onChange({ target: { value: 'session' } });
    form().props.onSubmit({ preventDefault() {} }); await flush();
    ui.library().children[4].children[3].children[0].children[0].children[0].props.onChange();
    const before = ui.calls.filter(call => call.method === 'dsh-session-notebook/library/query').length;
    button(ui.library(), '导出 Markdown').props.onClick();
    button(ui.library(), '确认下载 Markdown').props.onClick(); await flush();
    const queries = ui.calls.filter(call => call.method === 'dsh-session-notebook/library/query');
    assert.equal(queries.length, before + 1);
    assert.equal(queries.at(-1).payload.scope, 'all');
    assert.equal(queries.at(-1).payload.sort, 'updated');
    assert.deepEqual(ui.calls.find(call => call.method === 'dsh-session-notebook/markdown/export').payload.ids, ['n0']);
    assert.equal(ui.downloaded.length, 1);
  } finally { ui.dispose(); }
});

test('Markdown export includes selected notes hidden by the current filter', async () => {
  const ui = await harness();
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  ui.library().children[4].children[3].children[0].children[0].children[0].props.onChange();
  const form = () => filterForm(ui.library());
  filterSelect(ui.library(), 'libraryKindLabel').props.onChange({ target: { value: 'manual' } });
  form().props.onSubmit({ preventDefault() {} }); await flush();
  ui.library().children[4].children[3].children[0].children[0].children[0].props.onChange();
  button(ui.library(), '导出 Markdown').props.onClick();
  button(ui.library(), '确认下载 Markdown').props.onClick(); await flush();
  const call = ui.calls.find(item => item.method === 'dsh-session-notebook/markdown/export');
  assert.deepEqual(call.payload.ids, ['n0', 'n1']);
  assert.equal(ui.downloaded.length, 1);
  ui.dispose();
});

test('input write asks before append or replace and never calls submit', async () => {
  const ui = await harness();
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  button(ui.library(), 'inputInsert').props.onClick(); await flush();
  assert.deepEqual(ui.inputWrites, []);
  assert.match(JSON.stringify(ui.library()), /existing draft/);
  button(ui.library(), 'inputAppend').props.onClick();
  assert.equal(ui.inputWrites.length, 1);
  assert.equal(ui.inputDraft(), 'existing draft\n\n原文 n0\n\n正文 n0');
  assert.doesNotMatch(ui.inputDraft(), /导出时间|会话标题|工作区|来源会话/);
  assert.match(JSON.stringify(ui.library()), /inputApplied/);
  ui.dispose();

  const noInput = await harness(true, { unavailableInput: true });
  noInput.status(); await flush(); noInput.launcher().children[0].props.onClick();
  noInput.library(); await flush();
  assert.equal(button(noInput.library(), 'inputInsert').props.disabled, true);
  assert.equal(button(noInput.library(), 'copyMarkdown').props.disabled, false);
  noInput.dispose();
});

test('changed input requires another confirmation and complex draft cannot be replaced', async () => {
  const ui = await harness();
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush();
  button(ui.library(), 'inputInsert').props.onClick(); await flush();
  ui.setInputDraft('newer');
  button(ui.library(), 'inputReplace').props.onClick();
  assert.deepEqual(ui.inputWrites, []);
  assert.match(JSON.stringify(ui.library()), /inputChanged/);
  button(ui.library(), 'inputReplace').props.onClick();
  assert.equal(ui.inputWrites.length, 1);
  assert.equal(ui.inputDraft(), '原文 n0\n\n正文 n0');
  assert.doesNotMatch(ui.inputDraft(), /newer/);
  ui.dispose();

  const chips = await harness(true, { inputHasChip: true });
  chips.status(); await flush(); chips.launcher().children[0].props.onClick();
  chips.library(); await flush();
  button(chips.library(), 'inputInsert').props.onClick(); await flush();
  assert.equal(button(chips.library(), 'inputReplace').props.disabled, true);
  button(chips.library(), 'inputAppend').props.onClick();
  assert.equal(chips.inputWrites.length, 1);
  assert.equal(chips.inputWrites[0].span.start, 5);
  chips.dispose();
});

test('cards have no type conversion action and library exposes no incomplete backup import', async () => {
 const ui=await harness();ui.status();await flush();ui.launcher().children[0].props.onClick();ui.library();await flush();
 assert.equal(descendants(ui.library()).some(node=>node.type==='button'&&node.children.includes('convertOpen')),false);
 assert.equal(descendants(ui.library()).some(node=>node.props?.['data-restore-preview']),false);ui.dispose();
});

test('tag chips apply immediately, support multiple tags and clear the untagged constraint', async () => {
  const ui = await harness(); ui.status(); await flush();
  ui.launcher().children[0].props.onClick(); ui.library(); await flush();
  const before = ui.calls.length;
  untaggedFilter(ui.library()).props.onClick(); await flush();
  assert.equal(ui.calls.length, before + 1);
  assert.equal(ui.calls.at(-1).payload.untagged, true);
  tagFilter(ui.library(), 't1').props.onClick(); await flush();
  assert.deepEqual(ui.calls.at(-1).payload.tagIds, ['t1']);
  assert.equal(ui.calls.at(-1).payload.untagged, undefined);
  tagFilter(ui.library(), 't2').props.onClick(); await flush();
  assert.deepEqual(ui.calls.at(-1).payload.tagIds, ['t1', 't2']);
  tagFilter(ui.library(), 't1').props.onClick(); await flush();
  assert.deepEqual(ui.calls.at(-1).payload.tagIds, ['t2']);
  assert.equal(tagFilter(ui.library(), 't2').props['aria-pressed'], true);
  descendants(filterForm(ui.library())).find(node => node.type === 'button' &&
    node.children[0] === '全部').props.onClick(); await flush();
  assert.equal(ui.calls.at(-1).payload.tagIds, undefined);
  assert.equal(ui.calls.at(-1).payload.untagged, undefined);
  ui.dispose();
});

test('edit tag checkboxes accumulate selections without a modifier key and remove only the unchecked tag', async () => {
  const ui = await harness(true);
  ui.status(); await flush(); ui.launcher().children[0].props.onClick();
  ui.library(); await flush(); button(ui.library(), 'editOpen').props.onClick(); ui.edit(); await flush();
  const checkbox = name => descendants(ui.edit()).find(node => node.type === 'label' && node.children[1] === name).children[0];
  assert.equal(checkbox('TODO').props.checked, true);
  checkbox('重要').props.onChange({ target: { checked: true } });
  assert.equal(checkbox('TODO').props.checked, true); assert.equal(checkbox('重要').props.checked, true);
  checkbox('TODO').props.onChange({ target: { checked: false } });
  assert.equal(checkbox('重要').props.checked, true);
  checkbox('TODO').props.onChange({ target: { checked: true } });
  button(ui.edit(), 'editSave').props.onClick(); await flush();
  assert.deepEqual(ui.noteRows[0].tagIds, ['t2', 't1']); ui.dispose();
});
