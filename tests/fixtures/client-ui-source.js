import { readFile } from 'node:fs/promises';

// Component tests still exercise the production source. Only expose the reusable
// draft component to their virtual React harness; the shipped bundle has no hook.
export async function clientUiSource() {
  const source = await readFile(new URL('../../src/client/index.js', import.meta.url), 'utf8');
  return source.replace('function NotebookHome(',
    "ctx.slots.register({ key: 'notebook-test-draft' }, ManualDraft);\n        function NotebookHome(");
}
