async page => {
  const check = (value, message) => { if (!value) throw Error(message); };
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('http://127.0.0.1:43187');
  await page.evaluate(() => { document.querySelector('#root').style.cssText = 'width:380px;margin-left:auto;margin-right:0'; });
  await page.locator('[data-notebook-library]').waitFor();
  const panel = page.locator('[data-notebook-panel]');
  const row = page.locator('[data-notebook-library] li').first();
  await row.waitFor();
  const nav = page.getByRole('navigation', { name: '笔记导航' });
  for (const [label, selector] of [['笔记库', '[data-notebook-library]'],
    ['回收站', '[data-notebook-library]'], ['标签', '[data-notebook-tags]'],
    ['数据备份', '[data-notebook-backup]']]) {
    const current = nav.getByRole('button', { name: label, exact: true });
    await current.click();
    await page.locator(selector).waitFor();
    check(await current.getAttribute('aria-pressed') === 'true', `${label} is active`);
    check(await current.evaluate(el => getComputedStyle(el).backgroundColor !==
      getComputedStyle(el.parentElement.querySelector('button[aria-pressed=false]')).backgroundColor),
    `${label} has a distinct active background`);
    check(await page.locator(`${selector} > h3, ${selector} > [data-notebook-tag-heading] h4`).count() === 0,
      `${label} has no duplicate page heading`);
  }
  await nav.getByRole('button', { name: '笔记库', exact: true }).click();
  await row.waitFor();
  check(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'narrow right panel horizontal overflow');
  const primary = page.locator('[data-notebook-primary]').first();
  await primary.hover();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-notebook-primary]')).backgroundColor ===
    'rgb(29, 78, 216)');
  check(await primary.evaluate(el => getComputedStyle(el).color === 'rgb(255, 255, 255)'), 'primary hover contrast');
  check(await page.locator('.notebook-basic-filters>select').count() === 2 &&
    await page.locator('.notebook-basic-filters>[data-notebook-tag-filter]').count() === 1,
  'session, type and tag chips are basic filters');
  const filters = page.locator('[data-notebook-filters]');
  check(!(await filters.evaluate(el => el.open)), 'advanced filters default collapsed');
  await filters.locator('summary').click();
  check(await filters.locator('input[type=search]').isVisible(), 'advanced keyword available');
  check(await filters.locator('input[type=datetime-local]').count() === 2, 'advanced time range available');
  check(await filters.locator('select[multiple]').count() === 0, 'tag filter is not duplicated');
  await filters.locator('summary').click();
  const visibleDialog = async selector => {
    const dialog = page.locator(selector); await dialog.waitFor({ state: 'visible' });
    check(await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return r.width >= 300 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }), 'dialog clipped in narrow right pane');
    check(await dialog.getByRole('button').last().isVisible(), 'dialog action visible');
    return dialog;
  };
  check(await page.locator('[data-notebook-tags]').count() === 0, 'notes navigation initially selected');
  await row.getByRole('button', { name: '详情', exact: true }).click();
  let dialog = await visibleDialog('[data-note-detail]');
  check(await dialog.locator('.notebook-detail-meta small').count() >= 2, 'detail metadata is secondary quote');
  check(await dialog.locator('.notebook-detail-meta').first().evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize) <= 12), 'detail metadata smaller than body');
  await dialog.getByRole('button', { name: '返回列表', exact: true }).click();
  const highlight = page.locator('[data-notebook-library] li[data-note-kind=highlight]').first();
  check(await highlight.locator('.notebook-card-title').textContent() === '划线', 'untitled highlight uses kind instead of duplicate quote');
  check(!(await highlight.locator('.notebook-card-footer>small').first().textContent()).includes('更新时间'), 'date omits redundant prefix');
  await row.locator('[data-note-more] summary').click();
  check(await row.locator('.notebook-card-menu').isVisible(), 'more menu opens');
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-note-more][open] .notebook-card-menu');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return getComputedStyle(el).position === 'fixed' && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
  });
  await nav.getByRole('button', { name: '笔记库', exact: true }).click();
  check(!(await row.locator('[data-note-more]').evaluate(el => el.open)), 'clicking blank area closes more menu');
  await row.locator('[data-note-more] summary').click();
  await row.getByRole('button', { name: /编辑笔记|补充笔记 \/ 标签/ }).click();
  check(!(await row.locator('[data-note-more]').evaluate(el => el.open)), 'more menu closes after action');
  dialog = await visibleDialog('[data-note-edit]');
  await dialog.locator('[data-note-edit-actions] button').first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-note-edit-actions] button').length === 2);
  check(await dialog.locator('[data-note-edit-actions] button').count() === 2, 'save and close share editor action row');
  check(await dialog.locator('[data-note-edit-actions]').evaluate(el => { const [save, close] = el.querySelectorAll('button'); return Math.abs(save.getBoundingClientRect().top - close.getBoundingClientRect().top) < 2; }), 'editor buttons align on one line');
  await page.screenshot({ path: '/private/tmp/notebook-edit-0.0.21.png' });
  await dialog.getByRole('button', { name: '关闭编辑器', exact: true }).click();
  await row.locator('[data-note-more] summary').click();
  await row.getByRole('button', { name: '写入当前输入框', exact: true }).click();
  dialog = await visibleDialog('[data-input-confirm]');
  await dialog.getByRole('button', { name: '保持输入框不变', exact: true }).click();
  await page.getByRole('navigation', { name: '笔记导航' }).getByRole('button', { name: '标签', exact: true }).click();
  const tagField = page.locator('[data-notebook-tags]>label input[type=text]');
  await tagField.waitFor();
  check(await tagField.evaluate(el => el.getBoundingClientRect().width <= 220 && el.getBoundingClientRect().height <= 36), 'tag name control stays compact');
  const tagMenu = page.locator('.notebook-tag-actions').first();
  await tagMenu.locator('summary').click();
  await nav.getByRole('button', { name: '标签', exact: true }).click();
  check(!(await tagMenu.evaluate(el => el.open)), 'tag action menu closes on outside click');
  await nav.getByRole('button', { name: '笔记库', exact: true }).click();
  await panel.evaluate(el => { el.scrollTop = 0; });
  await panel.screenshot({ path: '/private/tmp/notebook-light-0.0.21.png', animations: 'disabled' });
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = ':root{--dsw-alias-bg-base:#1b1f28;--dsw-alias-bg-layer-2:#242b37;--dsw-alias-label-primary:#e6eaf1;--dsw-alias-label-secondary:#a1aaba;--dsw-alias-border-l1:#394253}#root{background:#1b1f28}';
    document.head.append(style);
  });
  await panel.screenshot({ path: '/private/tmp/notebook-dark-0.0.21.png', animations: 'disabled' });
  check(await panel.getByRole('button', { name: '关闭', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor === 'rgb(36, 43, 55)'), 'dark theme button background');
  console.log('PASS narrow native pane, expanded filters, visible detail/edit/input dialogs and light/dark themes');
}
