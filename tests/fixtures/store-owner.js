import { openJsonStore } from '../../src/host/json-store.js';

const store = await openJsonStore({ file: process.argv[2] });
process.stdout.write('ready\n');
process.stdin.resume();
process.stdin.once('end', async () => {
  try { await store.close(); process.exitCode = 0; }
  catch { process.exitCode = 1; }
});
