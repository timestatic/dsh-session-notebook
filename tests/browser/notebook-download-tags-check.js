async page => {
  const check = (value, name) => { if (!value) throw Error(name); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:43187');
  const row = page.locator('[data-notebook-library] li').filter({ hasText: 'Synthetic source paragraph' }).first();
  await row.waitFor();
  const editButton = row.getByRole('button', { name: /编辑笔记|补充笔记 \/ 标签/ });
  const openMore = async () => {
    if (!(await row.locator('[data-note-more]').evaluate(el => el.open))) {
      await row.locator('[data-note-more] summary').click();
    }
  };
  const openEditor = async () => { await openMore(); await editButton.click();
    await page.locator('[data-note-edit-tags]').waitFor(); };
  await openEditor();
  const editor = page.locator('[data-note-edit]');
  const tags = editor.locator('[data-note-edit-tags]');
  await tags.getByRole('checkbox', { name: 'TODO', exact: true }).uncheck();
  await tags.getByRole('checkbox', { name: '重要', exact: true }).uncheck();
  await tags.getByRole('checkbox', { name: 'TODO', exact: true }).check();
  await tags.getByRole('checkbox', { name: '重要', exact: true }).check();
  check(await tags.getByRole('checkbox', { checked: true }).count() === 2, 'two tags without modifier keys');
  await editor.getByRole('button', { name: '保存修改', exact: true }).click();
  await editor.waitFor({ state: 'detached' });
  check(await page.evaluate(async () => {
    const call = window.fixtureCalls.filter(call => call.method.endsWith('/notes/edit')).at(-1);
    const result = await (await fetch('/rpc', { method: 'POST', body: JSON.stringify({
      method: 'dsh-session-notebook/notes/get', payload: { id: call.payload.id },
    }) })).json();
    return call.payload.tagIds.length === 2 && result.value.note.tagIds.length === 2;
  }), 'both tags committed and read back');
  await openEditor();
  check(await tags.getByRole('checkbox', { checked: true }).count() === 2, 'reopened editor retains both tags');
  await tags.getByRole('checkbox', { name: 'TODO', exact: true }).uncheck();
  check(await tags.getByRole('checkbox', { name: '重要', exact: true }).isChecked(), 'removing one keeps the other');
  await editor.getByRole('button', { name: '保存修改', exact: true }).click();
  await editor.waitFor({ state: 'detached' });
  await openEditor();
  check(await tags.getByRole('checkbox', { checked: true }).count() === 1, 'saved removal read back');
  await editor.getByRole('button', { name: '关闭编辑器', exact: true }).click();
  await openMore();
  const downloadMarkdown = async () => {
    await openMore();
    const ready = page.waitForEvent('download');
    await row.getByRole('button', { name: '下载此笔记 Markdown', exact: true }).click();
    return (await ready).suggestedFilename();
  };
  const first = await downloadMarkdown();
  await page.waitForTimeout(1100);
  const second = await downloadMarkdown();
  check(/^dsh-session-notebook-rev-\d+-\d{14}\.md$/.test(first), 'Markdown seconds suffix');
  check(first !== second, 'same revision gets a new time suffix');
  await page.getByRole('button', { name: '数据备份', exact: true }).click();
  const ready = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载数据备份', exact: true }).click();
  const backup = (await ready).suggestedFilename();
  check(/^dsh-session-notebook-rev-\d+-\d{14}\.json$/.test(backup), 'JSON seconds suffix');
  await page.evaluate(result => { window.downloadTagResult = result; }, { first, second, backup });
  check(errors.length === 0, errors.join(';'));
}
