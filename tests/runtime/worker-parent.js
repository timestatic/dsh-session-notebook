import { Worker } from 'node:worker_threads';
import { workerRestartGate } from './worker-restart-gate.js';

// Isolated synthetic-worker parent only. No Host service, dynamic root selection, or auto recovery.
// Holds a single Worker. A failed close/exit permanently refuses replacement in this parent.
export function workerParent(root, options = {}) {
  let worker;
  let gate;
  let closing = false;
  let nextId = 0;
  const fixedError = code => Object.assign(new Error(code), { code });
  function spawn() {
    const child = new Worker(new URL('./owned-worker.js', import.meta.url), { workerData: { root, testFailReleaseSync: options.testFailReleaseSync === true,
      testRetainLockOnClose: options.testRetainLockOnClose === true } });
    worker = child;
    closing = false;
    gate = workerRestartGate();
    return child;
  }
  return Object.freeze({
    start() {
      if (worker) throw fixedError('RESTART_DENIED');
      return spawn();
    },
    async close() {
      if (!worker) throw fixedError('NOT_RUNNING');
      if (closing) throw fixedError('CLOSE_IN_PROGRESS');
      closing = true;
      const child = worker;
      const current = gate;
      const id = ++nextId;
      // Attach before sending: a lost/error/abnormal exit cannot synthesize successful close.
      const code = await new Promise(resolve => {
        let reply;
        let settled = false;
        const done = value => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          child.off('message', onMessage); child.off('error', onError); child.off('exit', onExit);
          resolve(value);
        };
        const onMessage = message => {
          if (message && message.id === id && !reply) {
            reply = true;
            current.closeReply(message && Object.getPrototypeOf(message) === Object.prototype
              && Reflect.ownKeys(message).length === 2 && Reflect.ownKeys(message).includes('code')
              && Reflect.ownKeys(message).includes('id') ? { code: message.code } : null);
          }
        };
        const onError = () => { current.exited(-1); done('CLOSE_FAILED'); };
        const onExit = exitCode => {
          current.exited(exitCode);
          done(current.mayRestart() ? 'CLOSED_OK' : 'CLOSE_FAILED');
        };
        const timer = setTimeout(() => { current.exited(-1); done('CLOSE_FAILED'); }, 5000);
        child.on('message', onMessage); child.on('error', onError); child.on('exit', onExit);
        try { child.postMessage({ id, op: 'close' }); }
        catch { current.exited(-1); done('CLOSE_FAILED'); }
      });
      return code;
    },
    restart() {
      if (!gate?.consumeRestart()) throw fixedError('RESTART_DENIED');
      return spawn();
    },
    // Only test cleanup; termination is not proof of safe ownership transfer.
    async terminateForTest() { if (worker) await worker.terminate(); },
  });
}
