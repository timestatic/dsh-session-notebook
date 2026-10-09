import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';

for (const filename of ['phase-0-browser-check.js', 'phase-0-negative-check.js', 'phase-0-viewport-check.js']) {
  test(`${filename} rejects a non-target origin before requests or UI changes`, async () => {
    const source = await readFile(new URL(`../e2e/${filename}`, import.meta.url), 'utf8');
    for (const origin of ['http://127.0.0.1:19387', 'https://example.invalid']) {
      let evaluated = 0;
      let uiChanges = 0;
      let requests = 0;
      const context = createContext({
        location: { origin },
        fetch: () => { requests++; throw new Error('UNEXPECTED_REQUEST'); },
        document: {}, innerWidth: 1512, innerHeight: 736,
      });
      const run = new Script(`(${source})`).runInContext(context);
      const page = {
        evaluate: async fn => { evaluated++; return fn(); },
        getByRole: () => new Proxy({}, {
          get: () => () => { uiChanges++; throw new Error('UNEXPECTED_UI_ACCESS'); },
        }),
      };
      await assert.rejects(run(page), /FAILED:targetWebOrigin/);
      assert.equal(evaluated, 1);
      assert.equal(requests, 0);
      assert.equal(uiChanges, 0);
    }
  });
}
