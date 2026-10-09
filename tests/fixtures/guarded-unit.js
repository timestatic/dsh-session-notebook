import { acquireMedium } from './medium-guard.js';

// Test-only lifecycle adapter, NOT registered with storage hub or shipped.
// SDK writes, protection and shutdown share one queue; ambiguous failures stop writes.
// A prewrite ownership check catches prior loss only: it cannot fence a competing rename after the check.
export async function openGuardedUnit(root, openUnit, hooks = {}) {
  const guard = await acquireMedium(root, hooks.guardHooks);
  let unit;
  try { unit = await openUnit(); }
  catch (error) {
    if (['malformed-medium', 'version-mismatch', 'invalid-record'].includes(error.code)) {
      try { await guard.protect(); }
      catch { throw Object.assign(new Error('PROTECTION_FAILED'), { code: 'PROTECTION_FAILED' }); }
      // No automatic lock release after damaged/future media discovery.
      throw Object.assign(new Error('MEDIUM_PROTECTED'), { code: 'MEDIUM_PROTECTED', originalCode: error.code });
    }
    // Unknown open errors also retain exclusion; safe quiescence is not proven.
    throw Object.assign(new Error('OPEN_FAILED'), { code: 'OPEN_FAILED' });
  }
  let tail = Promise.resolve(); let closing = false; let unknown = false; let protectionFailed = false; let disposal;
  const enqueue = operation => {
    if (closing) return Promise.reject(Object.assign(new Error('CLOSED'), { code: 'CLOSED' }));
    const result = tail.then(async () => {
      if (unknown) throw Object.assign(new Error('COMMIT_UNKNOWN'), { code: 'COMMIT_UNKNOWN' });
      if (protectionFailed) throw Object.assign(new Error('PROTECTION_FAILED'), { code: 'PROTECTION_FAILED' });
      return operation();
    });
    tail = result.then(() => {}, () => {}); return result;
  };
  return {
    loadAll: () => enqueue(() => unit.loadAll()),
    setGlobal: value => {
      const candidate = structuredClone(value);
      return enqueue(async () => {
        try { await guard.assertOwner(); }
        catch { unknown = true; throw Object.assign(new Error('OWNERSHIP_UNKNOWN'), { code: 'OWNERSHIP_UNKNOWN' }); }
        try { await unit.setGlobal(candidate); }
        catch { unknown = true; throw Object.assign(new Error('COMMIT_UNKNOWN'), { code: 'COMMIT_UNKNOWN' }); }
      });
    },
    protect: () => enqueue(async () => {
      try { return await guard.protect(); }
      catch { protectionFailed = true; throw Object.assign(new Error('PROTECTION_FAILED'), { code: 'PROTECTION_FAILED' }); }
    }),
    close() {
      if (disposal) return disposal;
      closing = true;
      disposal = (async () => {
        await tail;
        await hooks.beforeClose?.(); // Failure must leave exclusion intact.
        await unit.close();
        if (unknown) throw Object.assign(new Error('COMMIT_UNKNOWN'), { code: 'COMMIT_UNKNOWN' });
        if (protectionFailed) throw Object.assign(new Error('PROTECTION_FAILED'), { code: 'PROTECTION_FAILED' });
        await guard.release();
      })();
      return disposal;
    },
  };
}
