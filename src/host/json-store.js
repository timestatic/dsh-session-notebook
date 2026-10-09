import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createInitialSnapshot } from '../initial-snapshot.js';
import { measureSnapshotBytes } from '../snapshot-budget.js';

// The in-process guards complement the short-lived cross-process manifest lock.
// The manifest is the only commit point; immutable note files may outlive references.
const owners = new Set();
const dataOwners = new Set();
const marker = 'dsh-session-notebook-json';
// The sentinel is held only while reading or committing the manifest and data refs.
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
  const identityPath = join(parent, '.dsh-session-notebook.owner');
  const identity = `${marker}\n${file}\n`;
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
    let current;
    try { current = await fsImpl.lstat(lockPath); }
    catch { fail('STORE_OWNED'); }
    if (!current.isFile() || current.isSymbolicLink()
      || current.dev !== lockIdentity.dev || current.ino !== lockIdentity.ino) fail('STORE_OWNED');
  };
  const releaseLock = async () => {
    if (!lockHandle) return;
    // Never remove a sentinel that was replaced while this owner was active.
    try {
      await assertLock();
      // The final identity check narrows the cooperative replacement window;
      // same-UID adversarial unlink/recreate still requires an OS-level lock.
      await fsImpl.unlink(lockPath);
    } finally {
      // The handle itself cannot authorize deletion of a replacement file.
      await lockHandle.close();
      lockHandle = undefined;
    }
  };
  const assertStoreIdentity = async () => {
    let handle;
    try {
      handle = await fsImpl.open(identityPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
      await handle.writeFile(identity, 'utf8');
      await handle.sync();
      await handle.close(); handle = undefined;
      await syncDirectory(parent);
      return;
    } catch (error) {
      await handle?.close().catch(() => {});
      if (error?.code !== 'EEXIST') throw error;
    }
    let existing;
    try {
      const entry = await fsImpl.lstat(identityPath);
      if (!entry.isFile() || entry.isSymbolicLink() || entry.size > 4096) fail('STORE_OWNED');
      const readHandle = await fsImpl.open(identityPath, constants.O_RDONLY | noFollow);
      try { existing = await readHandle.readFile('utf8'); }
      finally { await readHandle.close(); }
    } catch (error) {
      if (error?.code === 'STORE_OWNED') throw error;
      fail('STORE_OWNED');
    }
    if (existing !== identity) fail('STORE_OWNED');
  };
  const withLock = async action => {
    if (lockHandle) fail('STORE_OWNED');
    const deadline = Date.now() + 5000;
    const startedAt = Date.now();
    while (!lockHandle) {
      try {
        lockHandle = await fsImpl.open(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
        lockIdentity = await fsImpl.lstat(lockPath);
        await lockHandle.writeFile(`${process.pid}\n`, 'utf8');
        await lockHandle.sync();
      } catch (error) {
        if (lockHandle) {
          try { await releaseLock(); } catch { throw failure('STORE_UNAVAILABLE'); }
        }
        if (error?.code !== 'EEXIST') {
          if (error?.code === 'ELOOP') fail('STORE_OWNED');
          throw error;
        }
        if (Date.now() >= deadline) fail('STORE_OWNED');
        let ownerPid;
        try {
          const entry = await fsImpl.lstat(lockPath);
          if (!entry.isFile() || entry.isSymbolicLink() || entry.size > 64) fail('STORE_OWNED');
          const ownerHandle = await fsImpl.open(lockPath, constants.O_RDONLY | noFollow);
          try { ownerPid = Number((await ownerHandle.readFile('utf8')).trim()); }
          finally { await ownerHandle.close(); }
        } catch (readError) {
          if (readError?.code === 'STORE_OWNED') throw readError;
          if (readError?.code !== 'ENOENT') fail('STORE_OWNED');
        }
        if (ownerPid) {
          try { process.kill(ownerPid, 0); }
          catch (processError) {
            if (processError?.code === 'ESRCH') fail('STORE_OWNED');
          }
        } else if (Date.now() - startedAt > 100) fail('STORE_OWNED');
        await new Promise(resolveDelay => setTimeout(resolveDelay, 10));
      }
    }
    try { return await action(); }
    finally { await releaseLock(); }
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
  const writeNote = async (note, directory) => {
    const name = `${randomUUID()}.json`;
    const path = join(directory, name);
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
  const collectStagingGarbage = async () => {
    let names;
    try { names = await fsImpl.readdir(dataDirectory); } catch { return; }
    for (const name of names) {
      const match = /^\.pending-(\d+)-[a-f0-9-]{36}$/.exec(name);
      if (!match) continue;
      const pid = Number(match[1]);
      if (!Number.isSafeInteger(pid) || pid < 1) continue;
      try { process.kill(pid, 0); continue; }
      catch (error) { if (error?.code !== 'ESRCH') continue; }
      const directory = join(dataDirectory, name);
      try {
        const entry = await fsImpl.lstat(directory);
        if (!entry.isDirectory() || entry.isSymbolicLink() || await fsImpl.realpath(directory) !== directory) continue;
        const files = await fsImpl.readdir(directory);
        let safe = true;
        for (const fileName of files) {
          if (!validDataName(fileName)) { safe = false; break; }
          const path = join(directory, fileName), fileEntry = await fsImpl.lstat(path);
          if (!fileEntry.isFile() || fileEntry.isSymbolicLink()) { safe = false; break; }
        }
        if (!safe) continue;
        for (const fileName of files) await fsImpl.unlink(join(directory, fileName));
        await fsImpl.rmdir(directory);
      } catch { /* Preserve staging data if ownership or contents are uncertain. */ }
    }
  };
  const prepareReferences = async (value, previousSnapshot, previousReferences) => {
    await checkDirectory(dataDirectory);
    const nextReferences = Object.create(null);
    let stagingDirectory;
    const stagedFiles = [];
    try {
      for (const [id, note] of Object.entries(value.notes)) {
        if (previousSnapshot && Object.hasOwn(previousReferences, id)
          && isDeepStrictEqual(previousSnapshot.notes[id], note)) {
          nextReferences[id] = previousReferences[id];
        } else {
          if (!stagingDirectory) {
            stagingDirectory = join(dataDirectory, `.pending-${process.pid}-${randomUUID()}`);
            await fsImpl.mkdir(stagingDirectory, { mode: 0o700 });
            await checkDirectory(stagingDirectory);
          }
          const reference = await writeNote(note, stagingDirectory);
          nextReferences[id] = reference;
          stagedFiles.push(reference.file);
        }
      }
      // The private staging directory keeps a concurrent GC from mistaking
      // uncommitted UUID files for garbage. They are promoted under the manifest lock.
      if (stagingDirectory) await syncDirectory(stagingDirectory);
      return { references: nextReferences, stagingDirectory, stagedFiles };
    } catch (error) {
      await discardStaging(stagingDirectory, stagedFiles);
      throw error;
    }
  };
  const discardStaging = async (directory, names) => {
    if (!directory) return;
    for (const name of names) await fsImpl.unlink(join(directory, name)).catch(() => {});
    await fsImpl.rmdir(directory).catch(() => {});
  };
  const promoteStagedFiles = async (directory, names) => {
    for (const name of names) {
      const source = join(directory, name), target = join(dataDirectory, name);
      await fsImpl.link(source, target);
      await fsImpl.unlink(source);
    }
    if (names.length) await syncDirectory(dataDirectory);
  };
  const loadSnapshot = async () => {
    const exists = await regularFileExists(file);
    if (!exists) return null;
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
    let nextSnapshot;
    try { nextSnapshot = checked({ ...metadata, notes }); }
    catch { fail('STORE_CORRUPT'); }
    return { snapshot: nextSnapshot, references: manifest.notes };
  };
  try {
    await fsImpl.mkdir(parent, { recursive: true, mode: 0o700 });
    await checkDirectory(parent);
    await withLock(async () => {
      await assertStoreIdentity();
      const loaded = await loadSnapshot();
      if (loaded) {
        snapshot = loaded.snapshot;
        references = loaded.references;
        // Make the observed manifest and data entries durable before GC.
        try {
          await syncDirectory(dataDirectory);
          await syncDirectory(parent);
        } catch { fail('STORE_UNAVAILABLE'); }
        await collectGarbage(references);
        await collectStagingGarbage();
        return;
      }
      await fsImpl.mkdir(dataDirectory, { mode: 0o700 }).catch(error => {
        if (error?.code !== 'EEXIST') throw error;
      });
      await checkDirectory(dataDirectory);
      if ((await fsImpl.readdir(dataDirectory)).length) fail('STORE_CORRUPT');
      snapshot = checked(initial);
      const prepared = await prepareReferences(snapshot, null, {});
      await promoteStagedFiles(prepared.stagingDirectory, prepared.stagedFiles);
      references = prepared.references;
      await persistManifest(makeManifest(snapshot, references));
      await discardStaging(prepared.stagingDirectory, prepared.stagedFiles);
    });
  } catch (error) {
    owners.delete(file);
    dataOwners.delete(dataDirectory);
    if (lockHandle) { try { await releaseLock(); } catch { throw failure('STORE_UNAVAILABLE'); } }
    if (['STORE_OWNED', 'STORE_CORRUPT', 'STORE_UNSUPPORTED', 'VALIDATION_FAILED', 'SNAPSHOT_LIMIT'].includes(error?.code)) throw failure(error.code);
    if (error?.code === 'ENOENT' || error?.code === 'ELOOP') throw failure('STORE_CORRUPT');
    throw failure('STORE_UNAVAILABLE');
  }
  return {
    estimateBytes,
    async reload() {
      if (closed) fail('STORE_CLOSED');
      const result = tail.then(() => withLock(async () => {
        const loaded = await loadSnapshot();
        if (!loaded) fail('STORE_CORRUPT');
        try {
          await syncDirectory(dataDirectory);
          await syncDirectory(parent);
        } catch { fail('STORE_UNAVAILABLE'); }
        snapshot = loaded.snapshot;
        references = loaded.references;
        return structuredClone(snapshot);
      }));
      tail = result.then(() => {}, () => {});
      return result;
    },
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
          const baseSnapshot = snapshot;
          const baseReferences = references;
          if (value.epoch !== baseSnapshot.epoch) fail('EPOCH_CONFLICT');
          if (value.revision !== baseSnapshot.revision + 1) fail('VERSION_CONFLICT');
          let commitStarted = false;
          let prepared;
          try {
            prepared = await prepareReferences(value, baseSnapshot, baseReferences);
            await withLock(async () => {
              const latest = await loadSnapshot();
              if (!latest) fail('STORE_CORRUPT');
              if (latest.snapshot.epoch !== baseSnapshot.epoch) {
                snapshot = latest.snapshot; references = latest.references;
                fail('EPOCH_CONFLICT');
              }
              if (latest.snapshot.revision !== baseSnapshot.revision) {
                snapshot = latest.snapshot; references = latest.references;
                fail('VERSION_CONFLICT');
              }
              await promoteStagedFiles(prepared.stagingDirectory, prepared.stagedFiles);
              commitStarted = true;
              await persistManifest(makeManifest(value, prepared.references));
              snapshot = value;
              references = prepared.references;
              await collectGarbage(references);
              await discardStaging(prepared.stagingDirectory, prepared.stagedFiles);
            });
          } catch (error) {
            if (['VERSION_CONFLICT', 'EPOCH_CONFLICT'].includes(error?.code)) {
              await discardStaging(prepared?.stagingDirectory, prepared?.stagedFiles ?? []);
              throw failure(error.code);
            }
            if (['STORE_OWNED', 'STORE_CORRUPT'].includes(error?.code)) {
              if (!commitStarted) await discardStaging(prepared?.stagingDirectory, prepared?.stagedFiles ?? []);
              throw failure(error.code);
            }
            if (commitStarted) {
              unknown = true;
              await fsImpl.rmdir(prepared?.stagingDirectory).catch(() => {});
              fail('COMMIT_UNKNOWN');
            }
            await discardStaging(prepared?.stagingDirectory, prepared?.stagedFiles ?? []);
            throw failure('STORE_UNAVAILABLE');
          }
        });
        tail = result.then(() => {}, () => {});
        return result;
      },
    },
    close() {
      if (!closePromise) {
        closed = true;
        closePromise = tail.then(() => {
          owners.delete(file); dataOwners.delete(dataDirectory);
        });
      }
      return closePromise;
    },
  };
}
