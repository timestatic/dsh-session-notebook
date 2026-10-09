// Isolated browser fixture. Loads the production Client and real notebook service.
// The host shell, clipboard permission and input binding are explicit test doubles.
import http from 'node:http';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createInitialSnapshot } from '../../src/initial-snapshot.js';
import { manualNotebookService } from '../../src/manual-notebook-service.js';
const repo = fileURLToPath(new URL('../../', import.meta.url));
const sdk = process.env.NOTEBOOK_BROWSER_SDK || '/Users/didi_1/.dsh/profiles/node_modules';
let snapshot = createInitialSnapshot({ epoch: 'browser-fixture' });
const service = manualNotebookService({ domain: { global: {
  get: () => structuredClone(snapshot), set: async value => { snapshot = structuredClone(value); },
} } });
for (let i = 0; i < 12; i++) {
  await service.excerpt({ requestId: `fixture_${i}`, epoch: snapshot.epoch, expectedRevision: snapshot.revision,
    kind: 'highlight', quote: { format: 'plain_text', content: `Synthetic source paragraph ${i}. `.repeat(18) },
    anchor: { exact: `Synthetic source paragraph ${i}. `.repeat(18) }, source: { sessionId: 'fixture', workspacePath: '/synthetic' }, tagIds: [] });
}
const handlers = { 'notes/excerpt': 'excerpt', 'notes/anchors': 'anchors', 'manual/list': 'list', 'library/query': 'library', 'notes/get': 'noteGet',
  'markdown/export': 'exportMarkdown', 'tags/list': 'tagList', 'notes/edit': 'noteEdit', 'notes/convert': 'noteConvert', 'manual/create': 'create', 'manual/update': 'update', 'manual/backup': 'exportJson',
  'notes/preview': 'notePreview', 'notes/apply': 'noteApply', 'tags/create': 'tagCreate', 'tags/rename': 'tagRename', 'tags/preview': 'tagPreview', 'tags/merge': 'tagMerge', 'tags/delete': 'tagDelete' };
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/rpc') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const { method, payload } = JSON.parse(Buffer.concat(chunks));
      const endpoint = method.replace('dsh-session-notebook/', '');
      let value;
      if (endpoint === 'health') value = { status: 'ok', phase: 1, storageReady: true };
      else if (endpoint === 'tags/list') value = service.tagList();
      else if (endpoint === 'notes/get') value = service.noteGet(payload.id);
      else if (handlers[endpoint]) value = await service[handlers[endpoint]](payload);
      else throw Object.assign(new Error('unsupported fixture RPC'), { code: 'VALIDATION_FAILED' });
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, value })); return;
    }
    const paths = { '/': repo + 'tests/browser/notebook-ui.html', '/client.js': repo + 'src/client/index.js',
      '/react.js': sdk + '/react/umd/react.development.js', '/react-dom.js': sdk + '/react-dom/umd/react-dom.development.js' };
    const pathname = new URL(req.url, 'http://fixture').pathname;
    if (!paths[pathname]) { res.writeHead(404); res.end(); return; }
    res.setHeader('content-type', pathname === '/' ? 'text/html' : 'text/javascript'); res.end(await fs.readFile(paths[pathname]));
  } catch (error) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: false, error: { code: error.code || 'VALIDATION_FAILED' } })); }
});
server.listen(Number(process.env.NOTEBOOK_BROWSER_PORT || 43187), '127.0.0.1', () => console.log('Notebook fixture http://127.0.0.1:43187'));
for (const event of ['SIGINT', 'SIGTERM']) process.on(event, async () => { await service.close(); server.close(); });
