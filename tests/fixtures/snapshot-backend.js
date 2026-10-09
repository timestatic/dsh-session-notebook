import { openGuardedUnit } from './guarded-unit.js';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';

// TEST-ONLY global Snapshot KvFacet. No runtime registration, no official json override.
export function snapshotBackend(root, openSdk, schema, options = {}) {
  if (typeof schema?.parse !== 'function') throw new Error('SCHEMA_REQUIRED');
  if (Object.keys(options).some(key => key !== 'guardHooks') || (options.guardHooks !== undefined && (options.guardHooks === null || typeof options.guardHooks !== 'object' || Array.isArray(options.guardHooks)))) throw new Error('INVALID_TEST_OPTIONS');
  const validateOnly = value => {
    const parsed = schema.parse(structuredClone(value));
    if (JSON.stringify(parsed) !== JSON.stringify(value)) throw new Error('SCHEMA_TRANSFORM_UNSUPPORTED');
  };
  let closing = false; let disposal;
  const pending = new Set(); const units = new Set(); const openFailures = [];
  const openDescriptor = async descriptor => {
    if (descriptor.name !== 'notebook' || descriptor.version !== 1 || descriptor.layout !== 'single'
      || descriptor.hasGlobal !== true || !Array.isArray(descriptor.tables) || descriptor.tables.length
      || (descriptor.compatibleVersions?.length ?? 0) !== 0
      || Object.keys(descriptor).some(key => !['name', 'version', 'layout', 'hasGlobal', 'tables', 'compatibleVersions'].includes(key))) {
      throw Object.assign(new Error('DESCRIPTOR_REJECTED'), { code: 'DESCRIPTOR_REJECTED' });
    }
    const unit = await openGuardedUnit(root, async () => {
      let existed = true;
      try {
        const entry = await lstat(join(root, 'notebook.json'));
        if (!entry.isFile()) throw Object.assign(new Error('UNSAFE_MEDIUM'), { code: 'UNSAFE_MEDIUM' });
      }
      catch (error) { if (error.code === 'ENOENT') existed = false; else throw error; }
      const raw = await openSdk(structuredClone(descriptor));
      let loaded;
      try { loaded = await raw.loadAll(); }
      catch (error) { await raw.close(); throw error; }
      try {
        if (loaded.global === null && existed) throw new Error('EXISTING_EMPTY_GLOBAL');
        if (loaded.global !== null) validateOnly(loaded.global);
      } catch {
        await raw.close();
        throw Object.assign(new Error('invalid-record'), { code: 'invalid-record' });
      }
      return raw;
    }, { guardHooks: options.guardHooks });
    units.add(unit);
    const unsupported = async () => { throw Object.assign(new Error('GLOBAL_ONLY'), { code: 'GLOBAL_ONLY' }); };
    return { loadAll: unit.loadAll, setGlobal: async value => {
      const candidate = structuredClone(value);
      try { validateOnly(candidate); }
      catch { throw Object.assign(new Error('VALIDATION_FAILED'), { code: 'VALIDATION_FAILED' }); }
      await unit.setGlobal(candidate);
    }, close: unit.close,
      putRecord: unsupported, deleteRecord: unsupported };
  };
  return {
    kv: { open(descriptor) {
      if (closing) return Promise.reject(Object.assign(new Error('CLOSED'), { code: 'CLOSED' }));
      const result = openDescriptor(descriptor);
      pending.add(result);
      result.then(() => pending.delete(result), error => {
        pending.delete(result);
        if (['OPEN_FAILED', 'MEDIUM_PROTECTED', 'PROTECTION_FAILED', 'LOCK_FAILED'].includes(error.code)) openFailures.push(error);
      });
      return result;
    } },
    close() {
      if (disposal) return disposal;
      closing = true;
      disposal = (async () => {
        await Promise.allSettled([...pending]);
        const outcomes = await Promise.allSettled([...units].map(unit => unit.close()));
        const errors = [...openFailures, ...outcomes.filter(result => result.status === 'rejected').map(result => result.reason)];
        if (errors.length) throw new AggregateError(errors, 'BACKEND_CLOSE_FAILED');
      })();
      return disposal;
    },
  };
}
