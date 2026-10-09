// Parent-only test prototype. Never grants cross-process ownership or inspects/deletes a lock.
// A worker may not be replaced in this parent until its successful close reply AND exit 0.
export function workerRestartGate() {
  let state = 'running';
  let successReply = false;
  return Object.freeze({
    closeReply(reply) {
      if (state !== 'running') return;
      if (reply && Object.getPrototypeOf(reply) === Object.prototype
        && Reflect.ownKeys(reply).length === 1 && reply.code === 'CLOSED_OK') {
        successReply = true;
      } else state = 'blocked';
    },
    exited(code) {
      if (state !== 'running') return;
      state = successReply && code === 0 ? 'closed' : 'blocked';
    },
    mayRestart() { return state === 'closed'; },
    consumeRestart() {
      if (state !== 'closed') return false;
      state = 'consumed'; // One close permits only one replacement attempt, even if spawn fails.
      return true;
    },
  });
}
