async page => {
  const check = (value, label) => { if (!value) throw Error(label); };
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('http://127.0.0.1:43187/?selection=1');
  await page.locator('[data-notebook-library] li').first().waitFor();
  await page.evaluate(() => {
    document.querySelector('#fixture-chat .gKv1-q_body').innerHTML =
      '<p>Earlier selection text.</p><p style="margin-top:150px">Later selection text.</p>';
  });
  const toolbar = page.getByRole('dialog', { name: '选区操作', exact: true });
  const select = index => page.evaluate(index => {
    const node = document.querySelectorAll('#fixture-chat p')[index].firstChild;
    const range = document.createRange(); range.selectNodeContents(node);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const rect = range.getBoundingClientRect(); return { left: rect.left, bottom: rect.bottom };
  }, index);
  await select(1); await toolbar.waitFor();
  const first = await toolbar.boundingBox();
  const selected = await select(0);
  await page.waitForFunction(bottom => {
    const dialog = document.querySelector('[data-notebook-annotations] [role=dialog]');
    return dialog && dialog.getBoundingClientRect().top < bottom + 40;
  }, selected.bottom);
  const second = await toolbar.boundingBox();
  check(second.y < first.y - 100, 'toolbar follows the new earlier selection');
  check(await toolbar.locator('textarea').count() === 0, 'reselection stays compact');
  await toolbar.getByRole('button', { name: '划线', exact: true }).click();
  await toolbar.waitFor({ state: 'detached' });
  check(await page.evaluate(() => {
    const intent = window.fixtureCalls.filter(call => call.method.endsWith('/notes/excerpt')).at(-1).payload;
    return intent.quote.content === 'Earlier selection text.' && intent.anchor.exact === intent.quote.content;
  }), 'save uses the new quote and anchor');
  await select(1); await toolbar.waitFor();
  await toolbar.getByRole('button', { name: '记笔记', exact: true }).click();
  await toolbar.getByRole('textbox', { name: '笔记内容', exact: true }).fill('Keep this annotation');
  const edited = await toolbar.boundingBox();
  await select(0);
  check(await toolbar.getByRole('textbox', { name: '笔记内容', exact: true }).inputValue() === 'Keep this annotation', 'reselection retains typed annotation');
  check(Math.abs((await toolbar.boundingBox()).y - edited.y) < 1, 'edited annotation stays at its source');
  await toolbar.getByRole('button', { name: '保存笔记', exact: true }).click();
  await toolbar.waitFor({ state: 'detached' });
  check(await page.evaluate(() => {
    const intent = window.fixtureCalls.filter(call => call.method.endsWith('/notes/excerpt')).at(-1).payload;
    return intent.quote.content === 'Later selection text.' && intent.bodyMarkdown === 'Keep this annotation';
  }), 'typed annotation stays bound to its original quote');
  check(errors.length === 0, errors.join(';'));
}
