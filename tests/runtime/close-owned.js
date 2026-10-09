// Test-only shutdown coordinator. A failed step cannot skip later owned cleanup.
// A success response requires every step to resolve; no raw error crosses the worker boundary.
export async function closeOwned(steps) {
  let failed = false;
  for (const step of steps) {
    try { await step(); }
    catch { failed = true; }
  }
  return failed ? 'CLOSE_FAILED' : 'CLOSED_OK';
}
