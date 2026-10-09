import { openJsonStore } from '../../src/host/json-store.js';

const store = await openJsonStore({ file: process.argv[2] });
process.stdout.write('ready\n');
process.on('message', async message => {
  if (message?.action === 'get') {
    process.send({ action: 'get', snapshot: store.global.get() });
    return;
  }
  if (message?.action === 'reload') {
    try { process.send({ action: 'reload', snapshot: await store.reload() }); }
    catch (error) { process.send({ action: 'reload', error: error?.code }); }
    return;
  }
  if (message?.action === 'write') {
    try {
      const current = store.global.get();
      const next = { ...current, revision: current.revision + 1,
        notes: { ...current.notes, [message.key]: { id: message.key, schemaVersion: 1, kind: 'manual',
          bodyMarkdown: message.key, tagIds: [], createdBy: 'user',
          createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z', version: 1 } } };
      await store.global.set(next);
      process.send({ action: 'write', revision: next.revision });
    } catch (error) { process.send({ action: 'write', error: error?.code }); }
  }
});
process.stdin.resume();
process.stdin.once('end', async () => {
  try { await store.close(); process.exitCode = 0; }
  catch { process.exitCode = 1; }
});
