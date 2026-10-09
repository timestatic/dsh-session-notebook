import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('temporary diagnostic patch uses Loader insert list and ships the writer but no evidence', async () => {
  const base = new URL('../../diagnostics/desktop-http-observer/', import.meta.url);
  const patch = await readFile(new URL('cordis.patch.yml', base), 'utf8');
  // Exact tiny patch fixture: npm dry-run does not validate the Loader dialect.
  assert.equal(patch, '- insert:\n    - id: session-notebook-http-observer\n      name: dsh-session-notebook-http-observer\n');
  const manifest = JSON.parse(await readFile(new URL('package.json', base), 'utf8'));
  assert.ok(manifest.files.includes('summary-writer.js'));
  assert.ok(!manifest.files.some(name => name.includes('result') || name.includes('*')));
});
