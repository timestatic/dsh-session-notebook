async page => {
  const check = (value, message) => { if (!value) throw Error(message); };
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.goto('http://127.0.0.1:43187/?selection=1');
  await page.locator('[data-notebook-library]').waitFor();
  const menu = page.getByRole('button', { name: '打开 AI 笔记', exact: true });
  check(await menu.evaluate(el => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(el).borderWidth === '0px'), 'menu transparent without box');
  const chips = page.locator('[data-notebook-tag-filter]');
  await chips.waitFor();
  await page.evaluate(() => {
    const node = document.querySelector('#fixture-chat .gKv1-q_body').firstChild;
    const range = document.createRange(); range.selectNodeContents(node);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  const toolbar = page.getByRole('dialog', { name: '选区操作', exact: true });
  await toolbar.getByRole('button', { name: '添加标签', exact: true }).click();
  const newTag = `Flow-${Date.now()}`;
  await toolbar.getByRole('textbox', { name: '新标签名称', exact: true }).fill(newTag);
  await toolbar.getByRole('button', { name: '保存划线', exact: true }).click();
  await toolbar.waitFor({ state: 'detached' });
  const newTagChip = chips.locator('button[data-tag-id]').filter({ hasText: newTag });
  await newTagChip.waitFor();
  await chips.getByRole('button', { name: '无标签' }).click();
  await newTagChip.click();
  await page.waitForFunction(name => {
    const call = window.fixtureCalls.filter(x => x.method.endsWith('/library/query')).at(-1);
    return call?.payload.tagIds?.length === 1 && !call.payload.untagged && document.querySelector('[data-notebook-library] li')?.textContent.includes(name);
  }, newTag);
  check(await page.locator('[data-notebook-library] li').count() === 1, 'newly tagged excerpt immediately filters to one note');
  check(await newTagChip.getAttribute('aria-pressed') === 'true' &&
    await chips.getByRole('button', { name: '无标签' }).getAttribute('aria-pressed') === 'false',
  'selected tag visible and untagged cleared');
  await page.screenshot({ path: '/private/tmp/notebook-tags-0.0.21.png', animations: 'disabled' });
  console.log('PASS tagged excerpt refreshes open library and tag chips filter immediately; menu has no white box');
}
