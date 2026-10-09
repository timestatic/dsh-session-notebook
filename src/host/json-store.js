import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createInitialSnapshot } from '../initial-snapshot.js';
import { measureSnapshotBytes } from '../snapshot-budget.js';

// The in-process guards complement a fixed-path cross-process fail-fast sentinel.
// The manifest is the only commit point; immutable note files may outlive references.
const owners = new Set();
const dataOwners = new Set();
const marker = 'dsh-session-notebook-json';
// A persistent sentinel deliberately fails closed after an unclean process exit.
// Recovery requires an operator to verify that no owner is running.
const lockName = '.dsh-session-notebook.lock';
const failure = code => Object.assign(new Error(code), { code });
const fail = code => { throw failure(code); };
const noFollow = constants.O_NOFOLLOW;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const exactFields = (value, names) => record(value)
  && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const noteSummary = note => {
  const summary = { ...note };
  delete summary.bodyMarkdown;
  delete summary.quote;
  delete summary.anchor;
  return summary;
};
const validDataName = name => typeof name === 'string'
  && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.json$/.test(name);

export async function openJsonStore({ file, maxSnapshotBytes = 1024 * 1024,
  initial = createInitialSnapshot(), fsImpl = fs } = {}) {
  if (typeof file !== 'string' || !isAbsolute(file) || resolve(file) !== file
    || !Number.isSafeInteger(maxSnapshotBytes) || maxSnapshotBytes < 1) fail('INVALID_CONFIG');
  const parent = dirname(file);
  const dataDirectory = join(parent, 'data');
  if (owners.has(file) || dataOwners.has(dataDirectory)) fail('STORE_OWNED');
  owners.add(file);
  dataOwners.add(dataDirectory);
  let snapshot;
  let references = Object.create(null);
  let closed = false;
  let closePromise;
  let unknown = false;
  let tail = Promise.resolve();
  const lockPath = join(parent, lockName);
  let lockHandle, lockIdentity;
  const assertLock = async () => {
    if (!lockHandle) fail('STORE_OWNED');
    let current, held;
    try { [current, held] = await Promise.all([fsImpl.lstat(lockPath), lockHandle.stat()]); }
    catch { fail('STORE_OWNED'); }
    if (!current.isFile() || current.isSymbolicLink() || current.dev !== held.dev || current.ino !== held.ino
      || held.dev !== lockIdentity.dev || held.ino !== lockIdentity.ino) fail('STORE_OWNED');
  };
  const releaseLock = async () => {
    if (!lockHandle) return;
    // Never remove a sentinel that was replaced while this owner was active.
    try {
      await assertLock();
      // The final identity check narrows the cooperative replacement window;
      // same-UID adversarial unlink/recreate still requires an OS-level lock.
      await fsImpl.unlink(lockPath);
      await syncDirectory(parent);
    } finally {
      // The handle itself cannot authorize deletion of a replacement file.
      await lockHandle.close();
      lockHandle = undefined;
    }
  };
  const makeManifest = (value, refs) => {
    const { notes, ...metadata } = value;
    return { marker, formatVersion: 1, ...metadata, notes: refs };
  };
  const effectiveBytes = value => {
    const estimatedReferences = Object.create(null);
    let dataBytes = 0;
    for (const [id, note] of Object.entries(value.notes)) {
      dataBytes += Buffer.byteLength(JSON.stringify(note), 'utf8');
      estimatedReferences[id] = { file: '00000000-0000-4000-8000-000000000000.json',
        sha256: '0'.repeat(64), summary: noteSummary(note) };
    }
    // Admission counts the manifest and all currently referenced note files,
    // including repeated summary fields. Orphans are handled by separate GC.
    return dataBytes + Buffer.byteLength(JSON.stringify(makeManifest(value, estimatedReferences)), 'utf8');
  };
  const estimateBytes = input => effectiveBytes(measureSnapshotBytes(input, { maxBytes: Number.MAX_SAFE_INTEGER }).snapshot);
  const checked = input => {
    const value = measureSnapshotBytes(input, { maxBytes: maxSnapshotBytes }).snapshot;
    if (effectiveBytes(value) > maxSnapshotBytes) fail('SNAPSHOT_LIMIT');
    return value;
  };
  const regularFileExists = async path => {
    try {
      const entry = await fsImpl.lstat(path);
      if (!entry.isFile() || entry.isSymbolicLink()) fail('STORE_CORRUPT');
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  };
  const checkDirectory = async path => {
    const entry = await fsImpl.lstat(path);
    if (!entry.isDirectory() || entry.isSymbolicLink() || await fsImpl.realpath(path) !== path)
      fail('STORE_CORRUPT');
  };
  const syncDirectory = async path => {
    const handle = await fsImpl.open(path, constants.O_RDONLY | constants.O_DIRECTORY | noFollow);
    try { await handle.sync(); } finally { await handle.close(); }
  };
  const readBounded = async (path, budget) => {
    if (!await regularFileExists(path)) fail('STORE_CORRUPT');
    const handle = await fsImpl.open(path, constants.O_RDONLY | noFollow);
    try {
      const entry = await handle.stat();
      if (!entry.isFile() || entry.size > budget) fail('STORE_CORRUPT');
      // Size alone does not bound a file that grows during a read. Small files
      // get small buffers even when the whole-library budget is large.
      const buffer = Buffer.alloc(Math.min(budget + 1, entry.size + 1));
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > budget || length > entry.size) fail('STORE_CORRUPT');
      return buffer.subarray(0, length);
    } finally { await handle.close(); }
  };
  const parseJson = bytes => {
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { fail('STORE_CORRUPT'); }
  };
  const writeNote = async note => {
    const name = `${randomUUID()}.json`;
    const path = join(dataDirectory, name);
    const bytes = Buffer.from(JSON.stringify(note), 'utf8');
    let handle;
    let complete = false;
    let created = false;
    try {
      handle = await fsImpl.open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
      created = true;
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      handle = undefined;
      complete = true;
      return { file: name, sha256: hash(bytes), summary: noteSummary(note) };
    } finally {
      await handle?.close().catch(() => {});
      // A fully written immutable file becomes an orphan if a later manifest
      // commit fails. Never delete old references or successful note files here.
      if (created && !complete) await fsImpl.unlink(path).catch(() => {});
    }
  };
  const persistManifest = async manifest => {
    const temporary = `${file}.${randomUUID()}.tmp`;
    let handle;
    let created = false;
    try {
      handle = await fsImpl.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
      created = true;
      await handle.writeFile(JSON.stringify(manifest), 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await regularFileExists(file);
      await fsImpl.rename(temporary, file);
      await syncDirectory(parent);
    } finally {
      await handle?.close().catch(() => {});
      if (created) await fsImpl.unlink(temporary).catch(() => {});
    }
  };
  const collectGarbage = async (liveReferences, candidates) => {
    const live = new Set(Object.values(liveReferences).map(ref => ref.file));
    try {
      const names = candidates ?? await fsImpl.readdir(dataDirectory);
      for (const name of names) {
        if (!validDataName(name) || live.has(name)) continue;
        const path = join(dataDirectory, name);
        try {
          const entry = await fsImpl.lstat(path);
          if (entry.isFile() && !entry.isSymbolicLink()) await fsImpl.unlink(path);
        } catch { /* Cleanup cannot turn a durable commit into a failed one. */ }
      }
    } catch { /* A later validated open may retry orphan cleanup. */ }
  };
  const persist = async value => {
    try { await assertLock(); } catch { unknown = true; fail('STORE_OWNED'); }
    await checkDirectory(dataDirectory);
    const nextReferences = Object.create(null);
    let changed = false;
    for (const [id, note] of Object.entries(value.notes)) {
      if (snapshot && Object.hasOwn(references, id) && isDeepStrictEqual(snapshot.notes[id], note)) {
        nextReferences[id] = references[id];
      } else {
        nextReferences[id] = await writeNote(note);
        changed = true;
      }
    }
    // New data entries must be durable before a durable manifest can name them.
    if (changed) await syncDirectory(dataDirectory);
    const manifest = makeManifest(value, nextReferences);
    await persistManifest(manifest);
    return nextReferences;
  };
  try {
    await fsImpl.mkdir(parent, { recursive: true, mode: 0o700 });
    await checkDirectory(parent);
    try {
      lockHandle = await fsImpl.open(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
    } catch (error) {
      if (error?.code === 'EEXIST' || error?.code === 'ELOOP') fail('STORE_OWNED');
      throw error;
    }
    lockIdentity = await lockHandle.stat();
    await syncDirectory(parent);
    const exists = await regularFileExists(file);
    if (exists) {
      const manifestBytes = await readBounded(file, maxSnapshotBytes);
      const manifest = parseJson(manifestBytes);
      // Historical whole-Snapshot JSON requires an explicit migration step.
      if (manifest?.schemaVersion === 1 && !Object.hasOwn(manifest, 'marker')) fail('STORE_UNSUPPORTED');
      if (!exactFields(manifest, ['marker', 'formatVersion', 'schemaVersion', 'epoch', 'revision',
        'tags', 'settings', 'operationReceipts', 'notes'])
        || manifest.marker !== marker || manifest.formatVersion !== 1 || !record(manifest.notes)) fail('STORE_CORRUPT');
      await checkDirectory(dataDirectory);
      const notes = Object.create(null);
      let totalBytes = manifestBytes.length;
      for (const ref of Object.values(manifest.notes)) {
        if (!exactFields(ref, ['file', 'sha256', 'summary']) || !validDataName(ref.file)
          || typeof ref.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(ref.sha256) || !record(ref.summary)) fail('STORE_CORRUPT');
        const entry = await fsImpl.lstat(join(dataDirectory, ref.file));
        if (!entry.isFile() || entry.isSymbolicLink() || entry.size > maxSnapshotBytes - totalBytes) fail('STORE_CORRUPT');
        totalBytes += entry.size;
      }
      let remaining = maxSnapshotBytes - manifestBytes.length;
      for (const [id, ref] of Object.entries(manifest.notes)) {
        const bytes = await readBounded(join(dataDirectory, ref.file), remaining);
        remaining -= bytes.length;
        if (hash(bytes) !== ref.sha256) fail('STORE_CORRUPT');
        const note = parseJson(bytes);
        if (!record(note) || !isDeepStrictEqual(noteSummary(note), ref.summary)) fail('STORE_CORRUPT');
        notes[id] = note;
      }
      const { marker: storedMarker, formatVersion, ...metadata } = manifest;
      try { snapshot = checked({ ...metadata, notes }); }
      catch { fail('STORE_CORRUPT'); }
      // A prior process may have observed a rename whose directory sync failed.
      // Make the observed manifest and its data entries durable before GC can
      // remove references belonging to an older, still recoverable manifest.
      try {
        await syncDirectory(dataDirectory);
        await syncDirectory(parent);
      } catch { fail('STORE_UNAVAILABLE'); }
      references = manifest.notes;
      await assertLock();
      await collectGarbage(references);
    } else {
      await fsImpl.mkdir(dataDirectory, { mode: 0o700 }).catch(error => {
        if (error?.code !== 'EEXIST') throw error;
      });
      await checkDirectory(dataDirectory);
      if ((await fsImpl.readdir(dataDirectory)).length) fail('STORE_CORRUPT');
      const value = checked(initial);
      references = await persist(value);
      snapshot = value;
    }
  } catch (error) {
    owners.delete(file);
    dataOwners.delete(dataDirectory);
    try { await releaseLock(); } catch { throw failure('STORE_UNAVAILABLE'); }
    if (['STORE_OWNED', 'STORE_CORRUPT', 'STORE_UNSUPPORTED', 'VALIDATION_FAILED', 'SNAPSHOT_LIMIT'].includes(error?.code)) throw failure(error.code);
    if (error?.code === 'ENOENT' || error?.code === 'ELOOP') throw failure('STORE_CORRUPT');
    throw failure('STORE_UNAVAILABLE');
  }
  return {
    estimateBytes,
    global: {
      get() {
        if (closed) fail('STORE_CLOSED');
        return structuredClone(snapshot);
      },
      set(input) {
        if (closed) return Promise.reject(failure('STORE_CLOSED'));
        if (unknown) return Promise.reject(failure('COMMIT_UNKNOWN'));
        let value;
        try { value = checked(input); }
        catch (error) { return Promise.reject(failure(error?.code === 'SNAPSHOT_LIMIT' ? 'SNAPSHOT_LIMIT' : 'VALIDATION_FAILED')); }
        const result = tail.then(async () => {
          if (unknown) fail('COMMIT_UNKNOWN');
          let nextReferences;
          try { nextReferences = await persist(value); }
          catch (error) { unknown = true; fail(error?.code === 'STORE_OWNED' ? 'STORE_OWNED' : 'COMMIT_UNKNOWN'); }
          // Both authoritative views advance only after the manifest commits.
          const previousNames = Object.values(references).map(ref => ref.file);
          snapshot = value;
          references = nextReferences;
          await collectGarbage(references, previousNames);
        });
        tail = result.then(() => {}, () => {});
        return result;
      },
    },
    close() {
      if (!closePromise) {
        closed = true;
        closePromise = tail.then(async () => {
          try { await releaseLock(); }
          finally { owners.delete(file); dataOwners.delete(dataDirectory); }
        });
      }
      return closePromise;
    },
  };
}
