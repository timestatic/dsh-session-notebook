import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve, join, dirname } from 'node:path';
import { openJsonStore } from '../../src/host/json-store.js';
import { createInitialSnapshot } from '../../src/initial-snapshot.js';
import { snapshotCoordinator } from '../../src/snapshot-coordinator.js';
import { checkedTestRoot } from '../fixtures/test-root.js';

const base = resolve('.storage-test-output');
const initial = () => createInitialSnapshot({ epoch: 'json_test', time: '2026-10-05T00:00:00.000Z' });
const code = expected => error => error.code === expected && error.message === expected;
const note = (id, bodyMarkdown = '保存正文') => ({ id, schemaVersion: 1, kind: 'manual', bodyMarkdown,
  tagIds: [], createdBy: 'user', createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z', version: 1 });
const nextSnapshot = (current, changes = {}) => ({ ...current, revision: current.revision + 1, ...changes });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(run) {
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const root = await fs.mkdtemp(join(base, 'json-store-'));
  await fs.chmod(root, 0o700);
  const handles = [];
  const file = join(root, 'private', 'manifest.json');
  const data = join(dirname(file), 'data');
  const manifest = async () => JSON.parse(await fs.readFile(file, 'utf8'));
  const open = async options => {
    const handle = await openJsonStore({ file, initial: initial(), ...options });
    handles.push(handle);
    return handle;
  };
  try { await run({ root, file, data, manifest, open, forget: handle => handles.splice(handles.indexOf(handle), 1) }); }
  finally {
    await Promise.all(handles.map(handle => handle.close()));
    await fs.rm(await checkedTestRoot(root), { recursive: true, force: true });
  }
}

test('creates private manifest/data and reopens assembled snapshot with defensive copies', async () => fixture(async ({ file, data, manifest, open }) => {
  const store = await open();
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(dirname(file))).mode & 0o777, 0o700);
  assert.equal((await fs.stat(data)).mode & 0o777, 0o700);
  const read = store.global.get(); read.revision = 99;
  assert.equal(store.global.get().revision, 0);
  const next = nextSnapshot(store.global.get(), { notes: { one: note('one') } });
  const write = store.global.set(next); next.notes.one.bodyMarkdown = 'caller changed';
  await write;
  const saved = await manifest();
  assert.equal(saved.marker, 'dsh-session-notebook-json');
  assert.equal(saved.formatVersion, 1);
  assert.equal(saved.notes.one.summary.bodyMarkdown, undefined);
  const bytes = await fs.readFile(join(data, saved.notes.one.file));
  assert.equal(saved.notes.one.sha256, sha256(bytes));
  assert.equal((await fs.stat(join(data, saved.notes.one.file))).mode & 0o777, 0o600);
  await store.close();
  const reopened = await open();
  assert.equal(reopened.global.get().notes.one.bodyMarkdown, '保存正文');
  assert.equal(reopened.global.get().revision, 1);
}));

test('one changed note writes one data file; unchanged references remain stable; old reference is reclaimed', async () => fixture(async ({ data, manifest, open }) => {
  const written = [];
  const fsImpl = { ...fs, async open(path, ...args) {
    if (dirname(path) === data && path.endsWith('.json')) written.push(path);
    return fs.open(path, ...args);
  } };
  const store = await open({ fsImpl });
  await store.global.set(nextSnapshot(store.global.get(), { notes: { one: note('one'), two: note('two') } }));
  const before = await manifest(); written.length = 0;
  const next = nextSnapshot(store.global.get());
  next.notes.one.bodyMarkdown = '只改这一条'; next.notes.one.version = 2;
  await store.global.set(next);
  const after = await manifest();
  assert.equal(written.length, 1);
  assert.deepEqual(after.notes.two, before.notes.two);
  assert.notEqual(after.notes.one.file, before.notes.one.file);
  assert.deepEqual((await fs.readdir(data)).sort(), [after.notes.one.file, after.notes.two.file].sort());
  await store.global.set(nextSnapshot(store.global.get(), { notes: { two: next.notes.two } }));
  assert.deepEqual(await fs.readdir(data), [after.notes.two.file]);
}));

test('trash note preserves its data and schema state on reopen', async () => fixture(async ({ open }) => {
  const store = await open();
  const value = note('one'); value.deletedAt = value.updatedAt; value.version = 2;
  await store.global.set(nextSnapshot(store.global.get(), { notes: { one: value } }));
  await store.close();
  assert.deepEqual((await open()).global.get().notes.one, value);
}));

test('duplicate ownership and idempotent close do not release a newer owner', async () => fixture(async ({ open }) => {
  const first = await open();
  await assert.rejects(open(), code('STORE_OWNED'));
  await first.close();
  await open();
  await first.close();
  await assert.rejects(open(), code('STORE_OWNED'));
  assert.throws(() => first.global.get(), code('STORE_CLOSED'));
  await assert.rejects(first.global.set(initial()), code('STORE_CLOSED'));
}));

test('another process owns the library until close; crash leaves a fail-closed sentinel', async () => fixture(async ({ file, open }) => {
  const child = spawn(process.execPath, [new URL('../fixtures/store-owner.js', import.meta.url).pathname, file],
    { stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    const ready = await Promise.race([
      once(child.stdout, 'data').then(([data]) => data.toString()),
      once(child, 'exit').then(([exitCode]) => { throw new Error(`owner exited: ${exitCode}`); }),
    ]);
    assert.equal(ready, 'ready\n');
    const before = await fs.readFile(file);
    await assert.rejects(open(), code('STORE_OWNED'));
    await assert.rejects(openJsonStore({ file: join(dirname(file), 'other-manifest.json') }), code('STORE_OWNED'));
    assert.deepEqual(await fs.readFile(file), before);
    child.stdin.end();
    assert.equal((await once(child, 'exit'))[0], 0);
    const store = await open(); await store.close();
    const crashed = spawn(process.execPath, [new URL('../fixtures/store-owner.js', import.meta.url).pathname, file],
      { stdio: ['pipe', 'pipe', 'pipe'] });
    try {
      assert.equal((await once(crashed.stdout, 'data'))[0].toString(), 'ready\n');
      crashed.kill('SIGKILL'); await once(crashed, 'exit');
      await assert.rejects(open(), code('STORE_OWNED'));
      assert.deepEqual(await fs.readFile(file), before);
    } finally { if (crashed.exitCode === null && crashed.signalCode === null) crashed.kill(); }
  } finally { if (child.exitCode === null && child.signalCode === null) { child.kill(); await once(child, 'exit'); } }
}));

test('replaced sentinel stops writes and close never unlinks the replacement', async () => fixture(async ({ file, open, forget }) => {
  const store = await open();
  const lock = join(dirname(file), '.dsh-session-notebook.lock');
  await fs.unlink(lock);
  await fs.writeFile(lock, 'replacement', { mode: 0o600 });
  await assert.rejects(store.global.set(nextSnapshot(store.global.get())), code('STORE_OWNED'));
  await assert.rejects(store.close(), code('STORE_OWNED'));
  forget(store);
  assert.equal(await fs.readFile(lock, 'utf8'), 'replacement');
  await assert.rejects(open(), code('STORE_OWNED'));
}));

test('malformed, invalid, oversized and invalid UTF-8 manifest stays untouched; failed ownership releases', async () => fixture(async ({ file, open }) => {
  await fs.mkdir(dirname(file), { mode: 0o700 });
  for (const bytes of [Buffer.from('{secret bad'), Buffer.from('{}'), Buffer.alloc(2048, 32), Buffer.from([0xff])]) {
    await fs.writeFile(file, bytes);
    await assert.rejects(open({ maxSnapshotBytes: 1024 }), code('STORE_CORRUPT'));
    assert.deepEqual(await fs.readFile(file), bytes);
  }
  await fs.unlink(file);
  await open();
}));

test('legacy whole-snapshot JSON is explicitly unsupported and is never migrated or overwritten', async () => fixture(async ({ file, data, open }) => {
  await fs.mkdir(dirname(file), { mode: 0o700 });
  const bytes = JSON.stringify(initial());
  await fs.writeFile(file, bytes);
  await assert.rejects(open(), code('STORE_UNSUPPORTED'));
  assert.equal(await fs.readFile(file, 'utf8'), bytes);
  await assert.rejects(fs.stat(data), { code: 'ENOENT' });
}));

test('missing manifest with any existing data rejects empty initialization', async () => fixture(async ({ file, data, open }) => {
  await fs.mkdir(data, { recursive: true, mode: 0o700 });
  await fs.writeFile(join(data, 'user-file.json'), 'preserve');
  await assert.rejects(open(), code('STORE_CORRUPT'));
  assert.equal(await fs.readFile(join(data, 'user-file.json'), 'utf8'), 'preserve');
  await assert.rejects(fs.stat(file), { code: 'ENOENT' });
}));

test('rejects relative/noncanonical paths, manifest symlinks, parent aliases and data symlinks', async () => fixture(async ({ root, file, data, open }) => {
  await assert.rejects(openJsonStore({ file: 'manifest.json' }), code('INVALID_CONFIG'));
  await assert.rejects(openJsonStore({ file: `${root}/../manifest.json` }), code('INVALID_CONFIG'));
  const store = await open(); await store.close();
  const bytes = await fs.readFile(file);
  const original = join(root, 'original'); await fs.writeFile(original, bytes);
  await fs.unlink(file); await fs.symlink(original, file);
  await assert.rejects(open(), code('STORE_CORRUPT'));
  assert.equal(await fs.readlink(file), original);
  await fs.unlink(file); await fs.writeFile(file, bytes);
  const alias = join(root, 'alias'); await fs.symlink(dirname(file), alias);
  await assert.rejects(openJsonStore({ file: join(alias, 'other.json') }), code('STORE_CORRUPT'));
  await fs.rmdir(data); await fs.symlink(root, data);
  await assert.rejects(open(), code('STORE_CORRUPT'));
}));

test('validation and snapshot limits reject without freezing later valid writes', async () => fixture(async ({ file, open }) => {
  const store = await open({ maxSnapshotBytes: 1024 });
  const before = await fs.readFile(file);
  await assert.rejects(store.global.set({}), code('VALIDATION_FAILED'));
  const large = nextSnapshot(store.global.get(), { notes: { one: note('one', 'x'.repeat(2000)) } });
  await assert.rejects(store.global.set(large), code('SNAPSHOT_LIMIT'));
  assert.deepEqual(await fs.readFile(file), before);
  await store.global.set(nextSnapshot(store.global.get()));
}));

for (const corruption of ['missing', 'content', 'schema', 'summary', 'traversal', 'symlink']) {
  test(`${corruption} data/reference corruption rejects open and preserves media without garbage collection`, async () => fixture(async ({ root, file, data, manifest, open }) => {
    const store = await open();
    await store.global.set(nextSnapshot(store.global.get(), { notes: { one: note('one') } }));
    await store.close();
    const metadata = await manifest();
    const path = join(data, metadata.notes.one.file);
    const orphan = `${randomUUID()}.json`; await fs.writeFile(join(data, orphan), 'orphan');
    if (corruption === 'missing') await fs.unlink(path);
    if (corruption === 'content') await fs.writeFile(path, '{changed');
    if (corruption === 'schema') {
      const invalid = note('one'); invalid.kind = 'wrong';
      const bytes = Buffer.from(JSON.stringify(invalid)); await fs.writeFile(path, bytes);
      metadata.notes.one.sha256 = sha256(bytes); metadata.notes.one.summary.kind = 'wrong';
    }
    if (corruption === 'summary') metadata.notes.one.summary.version = 99;
    if (corruption === 'traversal') metadata.notes.one.file = '../outside.json';
    if (corruption === 'symlink') { await fs.unlink(path); await fs.symlink(join(root, 'outside.json'), path); }
    await fs.writeFile(file, JSON.stringify(metadata));
    const before = await fs.readFile(file);
    await assert.rejects(open(), code('STORE_CORRUPT'));
    assert.deepEqual(await fs.readFile(file), before);
    assert.equal(await fs.readFile(join(data, orphan), 'utf8'), 'orphan');
  }));
}

for (const stage of ['write', 'file-sync', 'rename', 'directory-sync']) {
  test(`manifest ${stage} failure preserves old memory; reopening selects durable references and collects only orphans`, async () => fixture(async ({ file, data, manifest, open }) => {
    let enabled = false;
    const fsImpl = {
      ...fs,
      async rename(...args) {
        if (enabled && stage === 'rename') throw new Error('private path');
        return fs.rename(...args);
      },
      async open(path, ...args) {
        const handle = await fs.open(path, ...args);
        if (!enabled) return handle;
        const temporary = path.endsWith('.tmp');
        return {
          close: () => handle.close(),
          async writeFile(...writeArgs) {
            if (temporary && stage === 'write') throw new Error('private write');
            return handle.writeFile(...writeArgs);
          },
          async sync() {
            if ((temporary && stage === 'file-sync') || (path === dirname(file) && stage === 'directory-sync'))
              throw new Error('private sync');
            return handle.sync();
          },
        };
      },
    };
    const store = await open({ fsImpl });
    await store.global.set(nextSnapshot(store.global.get(), { notes: { one: note('one', 'old') } }));
    const old = await manifest();
    enabled = true;
    const next = nextSnapshot(store.global.get()); next.notes.one.bodyMarkdown = 'new'; next.notes.one.version = 2;
    await assert.rejects(store.global.set(next), code('COMMIT_UNKNOWN'));
    assert.equal(store.global.get().notes.one.bodyMarkdown, 'old');
    await assert.rejects(store.global.set(next), code('COMMIT_UNKNOWN'));
    assert.deepEqual((await fs.readdir(dirname(file))).sort(), ['.dsh-session-notebook.lock', 'data', 'manifest.json']);
    assert.equal((await fs.readdir(data)).length, 2);
    enabled = false;
    await store.close();
    const reopened = await open();
    assert.equal(reopened.global.get().notes.one.bodyMarkdown, stage === 'directory-sync' ? 'new' : 'old');
    const current = await manifest();
    assert.deepEqual(await fs.readdir(data), [current.notes.one.file]);
    if (stage !== 'directory-sync') assert.deepEqual(current, old);
  }));
}

test('data write failure never changes manifest, removes incomplete file and freezes queued writes', async () => fixture(async ({ data, file, open }) => {
  let enabled = false;
  const fsImpl = { ...fs, async open(path, ...args) {
    const handle = await fs.open(path, ...args);
    if (!enabled || dirname(path) !== data || !path.endsWith('.json')) return handle;
    return { close: () => handle.close(), writeFile: async () => { throw new Error('hidden'); } };
  } };
  const store = await open({ fsImpl }); const before = await fs.readFile(file); enabled = true;
  const next = nextSnapshot(store.global.get(), { notes: { one: note('one') } });
  await Promise.all([store.global.set(next), store.global.set(next)].map(write => assert.rejects(write, code('COMMIT_UNKNOWN'))));
  assert.deepEqual(await fs.readFile(file), before);
  assert.deepEqual(await fs.readdir(data), []);
}));

test('garbage collection failure cannot change successful commit; validated reopen retries cleanup', async () => fixture(async ({ data, manifest, open }) => {
  let blockCleanup = false;
  const fsImpl = { ...fs, unlink: path => blockCleanup && dirname(path) === data
    ? Promise.reject(new Error('cleanup unavailable')) : fs.unlink(path) };
  const store = await open({ fsImpl });
  await store.global.set(nextSnapshot(store.global.get(), { notes: { one: note('one', 'old') } }));
  blockCleanup = true;
  const next = nextSnapshot(store.global.get()); next.notes.one.bodyMarkdown = 'new';
  await store.global.set(next);
  assert.equal(store.global.get().notes.one.bodyMarkdown, 'new');
  assert.equal((await fs.readdir(data)).length, 2);
  await store.global.set(nextSnapshot(store.global.get()));
  await store.close();
  assert.equal((await open()).global.get().notes.one.bodyMarkdown, 'new');
  assert.deepEqual(await fs.readdir(data), [(await manifest()).notes.one.file]);
}));

test('valid open ignores and reclaims controlled orphans but preserves unknown names and symlinks', async () => fixture(async ({ root, data, open }) => {
  const store = await open(); await store.close();
  const orphan = `${randomUUID()}.json`; await fs.writeFile(join(data, orphan), 'uncommitted');
  await fs.writeFile(join(data, 'user-file.json'), 'user');
  const link = `${randomUUID()}.json`; await fs.symlink(join(root, 'missing'), join(data, link));
  const reopened = await open();
  assert.deepEqual(reopened.global.get().notes, {});
  assert.deepEqual((await fs.readdir(data)).sort(), [link, 'user-file.json'].sort());
}));

test('serializes direct sets and close drains accepted commits', async () => fixture(async ({ file, open }) => {
  const store = await open();
  const first = store.global.set(nextSnapshot(store.global.get()));
  const second = store.global.set({ ...initial(), revision: 2 });
  await Promise.all([first, second, store.close()]);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).revision, 2);
}));

test('coordinator commits receipt in manifest and freezes after an uncertain manifest commit', async () => fixture(async ({ manifest, open }) => {
  let failRename = false;
  const fsImpl = { ...fs, rename: (...args) => failRename ? Promise.reject(new Error('hidden')) : fs.rename(...args) };
  const domain = await open({ fsImpl }); const coordinator = snapshotCoordinator({ domain });
  const request = { requestId: 'request_one', epoch: 'json_test', expectedRevision: 0 };
  const candidate = value => nextSnapshot(value);
  await coordinator.mutate(request, candidate);
  assert.equal((await manifest()).operationReceipts.request_one.committedRevision, 1);
  failRename = true;
  await assert.rejects(coordinator.mutate({ ...request, requestId: 'request_two', expectedRevision: 1 }, candidate), code('COMMIT_UNKNOWN'));
  assert.throws(() => coordinator.read(), code('COMMIT_UNKNOWN'));
  await coordinator.close();
}));

test('failed initial manifest commit releases ownership and removes temporary file', async () => fixture(async ({ file, open }) => {
  const fsImpl = { ...fs, rename: async () => { throw new Error('hidden'); } };
  await assert.rejects(open({ fsImpl }), code('STORE_UNAVAILABLE'));
  assert.deepEqual(await fs.readdir(dirname(file)), ['data']);
  assert.equal((await open()).global.get().revision, 0);
}));

test('new data file and data directory sync precede the manifest commit', async () => fixture(async ({ file, data, open }) => {
  const events = [];
  const fsImpl = { ...fs, async open(path, ...args) {
    const handle = await fs.open(path, ...args);
    if (path === file || path.endsWith('.dsh-session-notebook.lock')) return handle;
    return {
      stat: () => handle.stat(),
      close: () => handle.close(),
      writeFile: (...values) => handle.writeFile(...values),
      async sync() { events.push(path === data ? 'data-directory' : path.endsWith('.tmp') ? 'manifest-file'
        : path === dirname(file) ? 'manifest-directory' : 'data-file'); await handle.sync(); },
    };
  }, async rename(...args) { events.push('manifest-rename'); return fs.rename(...args); } };
  const store = await open({ fsImpl }); events.length = 0;
  await store.global.set(nextSnapshot(store.global.get(), { notes: { one: note('one') } }));
  assert.deepEqual(events, ['data-file', 'data-directory', 'manifest-file', 'manifest-rename', 'manifest-directory']);
}));

test('data directory sync failure leaves old manifest authoritative and reopens without the orphan', async () => fixture(async ({ file, data, open }) => {
  let enabled = false;
  const fsImpl = { ...fs, async open(path, ...args) {
    const handle = await fs.open(path, ...args);
    if (!enabled || path !== data) return handle;
    return { close: () => handle.close(), sync: async () => { throw new Error('hidden'); } };
  } };
  const store = await open({ fsImpl }); const before = await fs.readFile(file); enabled = true;
  await assert.rejects(store.global.set(nextSnapshot(store.global.get(), { notes: { one: note('one') } })), code('COMMIT_UNKNOWN'));
  assert.deepEqual(await fs.readFile(file), before);
  assert.equal((await fs.readdir(data)).length, 1);
  await store.close();
  assert.deepEqual((await open()).global.get().notes, {});
  assert.deepEqual(await fs.readdir(data), []);
}));

test('effective library budget counts manifest plus data; refusal occurs before writing; exact limit reopens', async () => fixture(async ({ file, data, manifest, open }) => {
  const value = nextSnapshot(initial(), { notes: { one: note('one', 'x'.repeat(3000)) } });
  const snapshotBytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  const small = await open({ maxSnapshotBytes: snapshotBytes });
  const before = await fs.readFile(file);
  await assert.rejects(small.global.set(value), code('SNAPSHOT_LIMIT'));
  assert.deepEqual(await fs.readFile(file), before);
  assert.deepEqual(await fs.readdir(data), []);
  await small.close();
  const large = await open(); await large.global.set(value); await large.close();
  const referenced = join(data, (await manifest()).notes.one.file);
  const totalBytes = (await fs.stat(file)).size + (await fs.stat(referenced)).size;
  assert.ok(totalBytes > snapshotBytes);
  const exact = await open({ maxSnapshotBytes: totalBytes });
  assert.deepEqual(exact.global.get(), value); await exact.close();
  let dataRead = false;
  const fsImpl = { ...fs, async open(path, ...args) {
    if (path === referenced) dataRead = true;
    return fs.open(path, ...args);
  } };
  await assert.rejects(open({ maxSnapshotBytes: totalBytes - 1, fsImpl }), code('STORE_CORRUPT'));
  assert.equal(dataRead, false);
}));

test('a second manifest cannot share an actively owned data directory', async () => fixture(async ({ file, open }) => {
  await open();
  await assert.rejects(openJsonStore({ file: join(dirname(file), 'other-manifest.json') }), code('STORE_OWNED'));
}));

for (const collision of ['data', 'temporary']) {
  test(`${collision} exclusive-create collision preserves the pre-existing file`, async () => fixture(async ({ data, open }) => {
    let enabled = false;
    let collided;
    const fsImpl = { ...fs, async open(path, ...args) {
      if (enabled && ((collision === 'data' && dirname(path) === data && path.endsWith('.json'))
        || (collision === 'temporary' && path.endsWith('.tmp')))) {
        collided = path;
        await fs.writeFile(path, 'pre-existing');
        throw Object.assign(new Error('hidden'), { code: 'EEXIST' });
      }
      return fs.open(path, ...args);
    } };
    const store = await open({ fsImpl }); enabled = true;
    const changes = collision === 'data' ? { notes: { one: note('one') } } : {};
    await assert.rejects(store.global.set(nextSnapshot(store.global.get(), changes)), code('COMMIT_UNKNOWN'));
    assert.equal(await fs.readFile(collided, 'utf8'), 'pre-existing');
  }));
}

test('reopen must sync an uncertain renamed manifest before reclaiming old references', async () => fixture(async ({ file, data, manifest, open }) => {
  let failParentSync = false;
  const fsImpl = { ...fs, async open(path, ...args) {
    const handle = await fs.open(path, ...args);
    if (path !== dirname(file)) return handle;
    return { close: () => handle.close(), async sync() {
      if (failParentSync) throw new Error('hidden sync failure');
      await handle.sync();
    } };
  } };
  const store = await open({ fsImpl });
  await store.global.set(nextSnapshot(store.global.get(), { notes: { one: note('one', 'old') } }));
  failParentSync = true;
  const next = nextSnapshot(store.global.get()); next.notes.one.bodyMarkdown = 'new';
  await assert.rejects(store.global.set(next), code('COMMIT_UNKNOWN'));
  failParentSync = false;
  await store.close();
  const files = (await fs.readdir(data)).sort(); assert.equal(files.length, 2);
  failParentSync = true;
  await assert.rejects(open({ fsImpl }), code('STORE_UNAVAILABLE'));
  failParentSync = false;
  assert.deepEqual((await fs.readdir(data)).sort(), files);
  const recovered = await open();
  assert.equal(recovered.global.get().notes.one.bodyMarkdown, 'new');
  assert.deepEqual(await fs.readdir(data), [(await manifest()).notes.one.file]);
}));

test('physical estimate is pure, matches stored bytes, and can preview over-budget snapshots', async () => fixture(async ({ file, data, manifest, open }) => {
  const small = await open({ maxSnapshotBytes: 1024 });
  const value = nextSnapshot(initial(), { notes: { one: note('one', 'x'.repeat(3000)) } });
  const estimate = small.estimateBytes(value);
  assert.ok(estimate > 1024);
  assert.equal(small.global.get().revision, 0);
  assert.deepEqual(await fs.readdir(data), []);
  assert.throws(() => small.estimateBytes({}), { code: 'VALIDATION_FAILED' });
  await small.close();
  const large = await open(); await large.global.set(value);
  const metadata = await manifest();
  const actual = (await fs.stat(file)).size + (await fs.stat(join(data, metadata.notes.one.file))).size;
  assert.equal(estimate, actual);
}));

test('coordinator physical-budget refusal preserves revision and permits a later small commit', async () => fixture(async ({ open }) => {
  const estimator = await open();
  const large = nextSnapshot(initial(), { notes: { one: note('one', 'x'.repeat(2000)) } });
  large.operationReceipts.large_request = { payloadHash: '0'.repeat(64), committedRevision: 1 };
  const budget = estimator.estimateBytes(large) - 1;
  assert.ok(Buffer.byteLength(JSON.stringify(large)) < budget);
  await estimator.close();
  const domain = await open({ maxSnapshotBytes: budget });
  const coordinator = snapshotCoordinator({ domain, maxSnapshotBytes: budget });
  const request = { requestId: 'large_request', epoch: 'json_test', expectedRevision: 0 };
  const candidate = value => nextSnapshot(value, { notes: { one: note('one', 'x'.repeat(2000)) } });
  await assert.rejects(coordinator.mutate(request, candidate), code('SNAPSHOT_LIMIT'));
  assert.equal(coordinator.read().revision, 0);
  assert.equal(domain.global.get().revision, 0);
  await coordinator.mutate({ ...request, requestId: 'small_request' }, value => nextSnapshot(value));
  assert.equal(coordinator.read().revision, 1);
  await coordinator.close();
}));
