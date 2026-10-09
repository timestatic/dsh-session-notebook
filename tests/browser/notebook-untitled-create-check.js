async page => {
  const check = (value, message) => { if (!value) throw Error(message); };
  await page.setViewportSize({ width: 1180, height: 850 });
  const tags = await (await page.request.post('http://127.0.0.1:43187/rpc', {
    data: { method: 'dsh-session-notebook/tags/list', payload: {} },
  })).json();
  if (!tags.value.items.length) await page.request.post('http://127.0.0.1:43187/rpc', {
    data: { method: 'dsh-session-notebook/tags/create', payload: {
      requestId: 'untitled_fixture_tag', epoch: tags.value.epoch,
      expectedRevision: tags.value.revision, name: '测试标签',
    } },
  });
  await page.goto('http://127.0.0.1:43187/');
  const library = page.locator('[data-notebook-library]');
  await library.locator('li').first().waitFor();
  const sourceCard = library.locator('li').filter({ has: page.locator('.notebook-card-source') }).first();
  const fontSizes = await sourceCard.evaluate(card => ({
    title: getComputedStyle(card.querySelector('.notebook-card-title')).fontSize,
    body: getComputedStyle(card.querySelector('p')).fontSize,
    detail: getComputedStyle(card.querySelector('.notebook-card-actions>button')).fontSize,
    source: getComputedStyle(card.querySelector('.notebook-card-actions>button:nth-child(2)')).fontSize,
    more: getComputedStyle(card.querySelector('[data-note-more]>summary')).fontSize,
  }));
  check(JSON.stringify(fontSizes) === JSON.stringify({ title: '14px', body: '14px',
    detail: '11px', source: '11px', more: '11px' }), `font sizes: ${JSON.stringify(fontSizes)}`);
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  const editor = page.locator('[data-notebook-editor]');
  await editor.locator('.notebook-compose-tags label').first().waitFor();
  await editor.locator('.notebook-compose-tags label').first().locator('input').check();
  const body = `无标题保存测试 ${Date.now()}`;
  check(await editor.locator('input[type=text]').inputValue() === '', 'title stays empty');
  await editor.locator('textarea').fill(body);
  await editor.getByRole('button', { name: '保存笔记', exact: true }).click();
  await editor.waitFor({ state: 'detached' });
  const row = library.locator('li').filter({ hasText: body });
  await row.waitFor();
  const noteId = await row.locator('[data-note-more]').getAttribute('data-note-more');
  const response = await (await page.request.post('http://127.0.0.1:43187/rpc', {
    data: { method: 'dsh-session-notebook/notes/get', payload: { id: noteId } },
  })).json();
  const catalog = await (await page.request.post('http://127.0.0.1:43187/rpc', {
    data: { method: 'dsh-session-notebook/tags/list', payload: {} },
  })).json();
  const tagColor = catalog.value.items.find(tag => tag.id === response.value.note.tagIds[0])?.color;
  check(await row.locator('.notebook-card-tags>span').first().evaluate((el, color) =>
    el.style.getPropertyValue('--tag-color') === color, tagColor),
  'card tag uses its saved palette color');
  check(response.ok && response.value.note.title === undefined, 'untitled note saved without a title field');
  check(response.value.note.bodyMarkdown === body && response.value.note.tagIds.length === 1
    && tagColor?.startsWith('#'),
    'body and selected tag persisted');
  console.log(JSON.stringify({ result: 'PASS', fontSizes, noteId }));
}
