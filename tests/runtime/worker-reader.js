// TEST ONLY: read-side correlation for one owned worker. Not a Host service.
// A timed-out ID is never reused. No timeout path terminates or unlocks the writer.
export function workerReader(worker, { timeoutMs = 5000, maxPending = 16 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || !Number.isSafeInteger(maxPending) || maxPending < 1 || maxPending > 64) throw new Error('INVALID_TEST_OPTIONS');
  const pending = new Map(); let nextId = 1; let closed = false;
  const settleAll = code => {
    closed = true;
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error(code)); }
    pending.clear(); detach();
  };
  const onMessage = message => {
    if (!message || !Number.isSafeInteger(message.id)) return;
    const entry = pending.get(message.id);
    if (!entry) return; // timeout, duplicate or unsolicited response: never assign to another request.
    pending.delete(message.id); clearTimeout(entry.timer); entry.resolve(message);
  };
  const onError = () => settleAll('WORKER_FAILED');
  const onExit = () => settleAll('WORKER_EXITED');
  const detach = () => { worker.off('message', onMessage); worker.off('error', onError); worker.off('exit', onExit); };
  worker.on('message', onMessage); worker.on('error', onError); worker.on('exit', onExit);
  return {
    list(limit) {
      if (closed) return Promise.reject(new Error('WORKER_CLOSED'));
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) return Promise.reject(new Error('VALIDATION_FAILED'));
      if (pending.size >= maxPending) return Promise.reject(new Error('WORKER_BUSY'));
      if (!Number.isSafeInteger(nextId)) return Promise.reject(new Error('ID_EXHAUSTED'));
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('WORKER_TIMEOUT')); }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        try { worker.postMessage({ id, op: 'list', limit }); }
        catch { clearTimeout(timer); pending.delete(id); reject(new Error('WORKER_FAILED')); }
      });
    },
    close() { settleAll('WORKER_CLOSED'); }, // Detach only: does not command worker, kill, or release any lock.
  };
}
