import test from 'node:test';
import assert from 'node:assert/strict';
import { workerRestartGate } from './worker-restart-gate.js';

test('restart requires both exact successful close reply and exit zero', () => {
  const gate = workerRestartGate();
  assert.equal(gate.mayRestart(), false);
  gate.closeReply({ code: 'CLOSED_OK' });
  assert.equal(gate.mayRestart(), false);
  gate.exited(0);
  assert.equal(gate.mayRestart(), true);
  gate.closeReply({ code: 'CLOSE_FAILED' });
  assert.equal(gate.mayRestart(), true); // settled; late replies cannot revoke or grant
  assert.equal(gate.consumeRestart(), true);
  assert.equal(gate.consumeRestart(), false);
  assert.equal(gate.mayRestart(), false);
});

test('unknown, malformed, absent, abnormal and out-of-order shutdowns permanently refuse restart', () => {
  for (const scenario of [
    gate => { gate.closeReply({ code: 'CLOSE_FAILED' }); gate.exited(0); },
    gate => { gate.exited(0); gate.closeReply({ code: 'CLOSED_OK' }); },
    gate => { gate.closeReply({ code: 'CLOSED_OK' }); gate.exited(1); },
    gate => { gate.closeReply({ code: 'CLOSED_OK', root: '/private' }); gate.exited(0); },
    gate => { gate.closeReply(null); gate.exited(0); },
  ]) {
    const gate = workerRestartGate(); scenario(gate);
    assert.equal(gate.mayRestart(), false);
    assert.equal(gate.consumeRestart(), false);
    gate.closeReply({ code: 'CLOSED_OK' }); gate.exited(0);
    assert.equal(gate.mayRestart(), false);
    assert.equal(gate.consumeRestart(), false);
  }
});
