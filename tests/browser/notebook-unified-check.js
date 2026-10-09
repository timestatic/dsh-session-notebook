async page => {
  const check = (value, message) => { if (!value) throw Error(message); };
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1100, height: 820 });
  await page.goto('http://127.0.0.1:43187/?selection=1');
  const nav = page.getByRole('navigation', { name: '笔记导航' });
  const library = page.locator('[data-notebook-library]');
  await library.locator('li').first().waitFor();
  check(await page.getByRole('button', { name: '打开 AI 笔记', exact: true }).count() === 1, 'one outside entry');
  check(await page.getByRole('button', { name: /打开笔记库|关闭笔记库|刷新手工笔记/ }).count() === 0, 'no duplicate internal list or launcher');
  // Tag chips apply immediately; the advanced keyword waits for Search.
  await library.locator('[data-notebook-filters] summary').click();
  await library.locator('input[type=search]').fill('unsubmitted search');
  const beforeFilter = await page.evaluate(() => window.fixtureCalls.length);
  await library.locator('[data-notebook-tag-filter] button[data-tag-id]').filter({ hasText: 'TODO' }).click();
  check(await page.evaluate(() => window.fixtureCalls.length) === beforeFilter + 1, 'tag chip applies immediately');
  await library.getByRole('button', { name: '搜索', exact: true }).click();
  await page.waitForFunction(() => window.fixtureCalls.filter(x => x.method.endsWith('/library/query')).at(-1)?.payload.tagIds?.length === 1);
  check(await page.evaluate(() => window.fixtureCalls.filter(x => x.method.endsWith('/library/query')).at(-1).payload.search === 'unsubmitted search'), 'Search applies keyword and tag together');
  await library.getByRole('button', { name: '重置', exact: true }).click();
  await library.locator('[data-notebook-filters] summary').click();
  await library.locator('li').first().waitFor();
  // A new manual note refreshes the same list immediately.
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  const editor = page.locator('[data-notebook-editor]');
  check(await page.getByRole('button', { name: '继续草稿', exact: true }).count() === 0, 'no inert resume while editor open');
  check(await editor.locator('[data-notebook-preview-notice]').count() === 1, 'preview explanation is subdued quote');
  const title = `Unified-${Date.now()}`;
  await editor.locator('input[type=text]').fill(title);
  await editor.locator('textarea').fill('Manual note in unified library');
  await editor.getByRole('button', { name: '保存笔记', exact: true }).click();
  await editor.waitFor({ state: 'detached' });
  await library.locator('li').filter({ hasText: title }).waitFor();
  // Highlight -> add annotation is one edit; quote/source/ID remain unchanged.
  const row = library.locator('li[data-note-kind=highlight]').filter({ hasText: 'Synthetic source paragraph' }).first();
  const id = await row.locator('[data-note-more]').getAttribute('data-note-more');
  const getNote = id => page.evaluate(async id => (await (await fetch('/rpc', { method: 'POST', body: JSON.stringify({ method: 'dsh-session-notebook/notes/get', payload: { id } }) })).json()).value.note, id);
  const before = await getNote(id);
  await row.locator('summary').click();
  await row.getByRole('button', { name: '补充笔记 / 标签', exact: true }).click();
  const edit = page.locator('[data-note-edit]');
  check(await edit.locator('textarea').evaluate(el => {
    const style = getComputedStyle(el);
    return style.resize === 'vertical' && el.getBoundingClientRect().height >= 220;
  }), 'edit body starts larger and can be resized vertically');
  check(await edit.locator('[data-notebook-original]').evaluate(el => el.open), 'original quote opens by default');
  check(await edit.locator('[data-notebook-preview]').count() === 0, 'edit uses one body input without duplicate preview');
  await edit.locator('textarea').fill('Supplement without losing source');
  await edit.getByRole('button', { name: '保存修改', exact: true }).click();
  await edit.waitFor({ state: 'detached' });
  const after = await getNote(id);
  check(after.kind === 'note' && after.bodyMarkdown === 'Supplement without losing source' && after.id === before.id, 'add annotation uses original ID');
  for (const key of ['quote', 'anchor', 'source']) check(JSON.stringify(after[key]) === JSON.stringify(before[key]), `preserve ${key}`);
  // Host commits successfully, but the first reply is lost. Retry must be inside
  // the confirmation modal and reuse the request ID, never create a new intent.
  const loseCommittedReply = async endpoint => {
    let lost = false;
    await page.route('**/rpc', async route => {
      const body = route.request().postDataJSON();
      if (!lost && body?.method === `dsh-session-notebook/${endpoint}`) {
        lost = true; const response = await route.fetch();
        check((await response.json()).ok, `fixture commit ${endpoint}`);
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      } else await route.continue();
    });
  };
  let manual = library.locator('li').filter({ hasText: title });
  await manual.locator('summary').click();
  await manual.getByRole('button', { name: '移入回收站', exact: true }).click();
  const impact = page.locator('[data-note-impact]');
  await loseCommittedReply('notes/apply');
  await impact.getByRole('button', { name: '确认修改笔记', exact: true }).click();
  await impact.getByRole('button', { name: '按原请求重试笔记操作', exact: true }).click();
  await impact.waitFor({ state: 'detached' });
  const noteCalls = await page.evaluate(() => window.fixtureCalls.filter(x => x.method.endsWith('/notes/apply')).slice(-2));
  check(noteCalls.length === 2 && noteCalls[0].payload.requestId === noteCalls[1].payload.requestId, 'note retry keeps frozen intent');
  await page.unroute('**/rpc');
  await nav.getByRole('button', { name: '回收站', exact: true }).click();
  manual = library.locator('li').filter({ hasText: title }); await manual.waitFor();
  await manual.locator('summary').click(); await manual.getByRole('button', { name: '恢复', exact: true }).click();
  await impact.getByRole('button', { name: '确认修改笔记', exact: true }).click(); await impact.waitFor({ state: 'detached' });
  await nav.getByRole('button', { name: '笔记库', exact: true }).click();
  await library.locator('li').filter({ hasText: title }).waitFor();
  // Only the recycle view exposes permanent deletion, after explicit preview.
  manual = library.locator('li').filter({ hasText: title }); await manual.locator('summary').click();
  await manual.getByRole('button', { name: '移入回收站', exact: true }).click();
  await impact.getByRole('button', { name: '确认修改笔记', exact: true }).click(); await impact.waitFor({ state: 'detached' });
  await nav.getByRole('button', { name: '回收站', exact: true }).click();
  manual = library.locator('li').filter({ hasText: title }); await manual.waitFor(); await manual.locator('summary').click();
  await manual.getByRole('button', { name: '永久删除', exact: true }).click();
  await impact.getByText('永久删除后无法恢复。', { exact: true }).waitFor();
  await impact.getByRole('button', { name: '确认修改笔记', exact: true }).click(); await impact.waitFor({ state: 'detached' });
  check(await library.locator('li').filter({ hasText: title }).count() === 0, 'confirmed purge removes only targeted note');
  // Row actions replace the generic action selector in tag management.
  await nav.getByRole('button', { name: '标签', exact: true }).click();
  const manager = page.locator('[data-notebook-tags]');
  const tagName = `Delete-${Date.now()}`;
  await manager.getByRole('textbox', { name: '标签名称', exact: true }).fill(tagName);
  await manager.getByRole('button', { name: '新建标签', exact: true }).click();
  const tagRow = manager.locator('.notebook-tag-row').filter({ hasText: tagName }); await tagRow.waitFor();
  await tagRow.locator('.notebook-tag-actions summary').click();
  await tagRow.getByRole('button', { name: '删除', exact: true }).click();
  const tagImpact = page.locator('[data-tag-impact]');
  await loseCommittedReply('tags/delete');
  await tagImpact.getByRole('button', { name: '确认修改', exact: true }).click();
  await tagImpact.getByRole('button', { name: '按原请求重试', exact: true }).click();
  await tagImpact.waitFor({ state: 'detached' });
  const tagCalls = await page.evaluate(() => window.fixtureCalls.filter(x => x.method.endsWith('/tags/delete')).slice(-2));
  check(tagCalls.length === 2 && tagCalls[0].payload.requestId === tagCalls[1].payload.requestId, 'tag retry keeps frozen intent');
  await page.unroute('**/rpc');
  // Rename and merge are row actions; merging never deletes note content.
  const mergeName = 'Merge-' + Date.now();
  await manager.getByRole('textbox', { name: '标签名称', exact: true }).fill(mergeName);
  await manager.getByRole('button', { name: '新建标签', exact: true }).click();
  let mergeRow = manager.locator('.notebook-tag-row').filter({ hasText: mergeName }); await mergeRow.waitFor();
  await mergeRow.locator('.notebook-tag-actions summary').click();
  await mergeRow.getByRole('button', { name: '编辑标签', exact: true }).click();
  await manager.getByRole('textbox', { name: '标签名称', exact: true }).fill(mergeName + '-renamed');
  await manager.getByRole('button', { name: '保存标签', exact: true }).click();
  mergeRow = manager.locator('.notebook-tag-row').filter({ hasText: mergeName + '-renamed' }); await mergeRow.waitFor();
  await mergeRow.locator('.notebook-tag-actions summary').click();
  await mergeRow.getByRole('button', { name: '合并', exact: true }).click();
  await manager.getByRole('combobox', { name: '目标标签', exact: true }).selectOption({ label: 'TODO' });
  await manager.getByRole('button', { name: '预览影响', exact: true }).click();
  await tagImpact.getByRole('button', { name: '确认修改', exact: true }).click(); await tagImpact.waitFor({ state: 'detached' });
  check(await manager.locator('.notebook-tag-row').filter({ hasText: mergeName }).count() === 0, 'merged source tag removed');
  await nav.getByRole('button', { name: '数据备份', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载数据备份', exact: true }).click();
  check((await downloading).suggestedFilename().endsWith('.json'), 'backup download');
  // Typed annotation survives a quick tag and requires confirmation to discard.
  await page.evaluate(() => {
    const node = document.querySelector('#fixture-chat .gKv1-q_body').firstChild;
    const range = document.createRange(); range.selectNodeContents(node);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  const toolbar = page.getByRole('dialog', { name: '选区操作', exact: true });
  await toolbar.getByRole('button', { name: '记笔记', exact: true }).click();
  await toolbar.locator('textarea').fill('Do not lose typed annotation');
  await toolbar.getByRole('button', { name: '添加标签', exact: true }).click();
  await toolbar.getByRole('button', { name: 'TODO', exact: true }).click();
  check(await toolbar.locator('textarea').inputValue() === 'Do not lose typed annotation', 'quick tag retains body');
  await toolbar.getByRole('button', { name: '取消选区操作', exact: true }).click();
  await toolbar.getByRole('button', { name: '继续编辑', exact: true }).click();
  await toolbar.getByRole('button', { name: '保存笔记', exact: true }).click();
  await toolbar.waitFor({ state: 'detached' });
  check(await page.evaluate(() => { const p = window.fixtureCalls.filter(x => x.method.endsWith('/notes/excerpt')).at(-1).payload; return p.kind === 'note' && p.bodyMarkdown === 'Do not lose typed annotation' && p.tagIds.includes('builtin_todo'); }), 'combined body/tag save');
  await nav.getByRole('button', { name: '笔记库', exact: true }).click();
  await library.locator('li').first().waitFor();
  await library.locator('li').first().locator('input[type=checkbox]').check();
  await library.getByRole('button', { name: '导出 Markdown', exact: true }).click();
  const exportDialog = page.locator('[data-markdown-export]');
  await exportDialog.waitFor({ state: 'visible' });
  check(await exportDialog.getByRole('checkbox').count() === 5, 'bulk export choices in dialog');
  await exportDialog.getByRole('button', { name: '取消', exact: true }).click();
  await exportDialog.waitFor({ state: 'detached' });
  await page.locator('[data-notebook-panel]').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: '/private/tmp/notebook-unified-0.0.21.png', animations: 'disabled' });
  check(!errors.length, errors.join(';'));
  console.log('PASS unified library, manual refresh, supplement highlight, draft/filter isolation, trash/restore, lost note/tag replies with modal retry, backup and annotation preservation');
}
