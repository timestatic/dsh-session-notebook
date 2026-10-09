async page => {
  const check = (value, message) => { if (!value) throw Error(message); };
  await page.setViewportSize({ width: 1180, height: 850 });
  const rpc = async (method, payload) => (await (await page.request.post('http://127.0.0.1:43187/rpc', {
    data: { method: `dsh-session-notebook/${method}`, payload },
  })).json()).value;
  for (const [index, name] of ['界面标签一', '界面标签二'].entries()) {
    const latest = await rpc('tags/list', {});
    if (!latest.items.some(tag => tag.name === name)) await rpc('tags/create', {
      requestId: `requested_ui_tag_${index}`, epoch: latest.epoch,
      expectedRevision: latest.revision, name,
    });
  }
  const createdTags = (await rpc('tags/list', {})).items.filter(tag =>
    ['界面标签一', '界面标签二'].includes(tag.name));
  check(createdTags.length === 2 && createdTags[0].color !== createdTags[1].color,
    'automatic colors differ while palette has unused colors');
  await page.goto('http://127.0.0.1:43187/');
  const normalWorkspaceStyle = await page.locator('[data-notebook-context]').evaluate(el => {
    const style = getComputedStyle(el);
    return { fontSize: style.fontSize, color: style.color, marginBottom: style.marginBottom };
  });
  const library = page.locator('[data-notebook-library]');
  await library.locator('li').first().waitFor();
  const filters = library.locator('[data-notebook-search-form]');
  const basic = filters.locator('.notebook-basic-filters');
  check(await basic.locator('select').count() === 2 &&
    await basic.locator('[data-notebook-tag-filter]').count() === 1,
  'basic filters have session, type and multi-tag chips');
  check(await basic.locator('select').first().locator('option').allTextContents().then(values =>
    values.join('|') === '全部笔记|当前项目|当前会话'), 'three source scopes');
  await basic.locator('select').first().selectOption('workspace');
  await filters.getByRole('button', { name: '搜索', exact: true }).click();
  await page.waitForFunction(() => window.fixtureCalls.filter(call =>
    call.method.endsWith('/library/query')).at(-1)?.payload?.workspacePath === '/synthetic');
  check(await page.evaluate(() => window.fixtureCalls.filter(call =>
    call.method.endsWith('/library/query')).at(-1).payload.scope === 'workspace'), 'current project uses workspace scope');
  await filters.getByRole('button', { name: '重置', exact: true }).click();
  check(await filters.evaluate(el => el.querySelector('[data-notebook-filters]').getBoundingClientRect().top
    < el.querySelector('.notebook-filter-actions').getBoundingClientRect().top), 'advanced filters precede actions');
  check(await filters.getByRole('button', { name: '搜索', exact: true }).count() === 1, 'Search action');
  check(await filters.getByRole('button', { name: '重置', exact: true }).count() === 1, 'Reset action');
  await filters.locator('[data-notebook-filters] summary').click();
  check(await filters.locator('[data-notebook-filters] input[type=search]').count() === 1, 'advanced keyword');
  check(await filters.locator('[data-notebook-filters] input[type=datetime-local]').count() === 2, 'advanced time range');
  check(await filters.locator('[data-notebook-filters] select[multiple]').count() === 0, 'no duplicate tag picker');
  const before = await page.evaluate(() => window.fixtureCalls.length);
  await basic.locator('[data-notebook-tag-filter] button[data-tag-id]').filter({ hasText: '界面标签一' }).click();
  check(await page.evaluate(() => window.fixtureCalls.length) === before + 1, 'tag chip filters immediately');
  await page.waitForFunction(() => window.fixtureCalls.at(-1)?.payload?.tagIds?.length === 1);
  await basic.locator('[data-notebook-tag-filter] button[data-tag-id]').filter({ hasText: '界面标签二' }).click();
  await page.waitForFunction(() => window.fixtureCalls.at(-1)?.payload?.tagIds?.length === 2);
  check(await basic.locator('[data-notebook-tag-filter] button[data-tag-id][aria-pressed=true]').count() === 2,
    'two tag chips stay selected');
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => getComputedStyle(document.querySelector(
    '[data-notebook-tag-filter] button[data-tag-id][aria-pressed=true]')).backgroundColor ===
    'rgba(58, 134, 255, 0.14)');
  const palette = await page.evaluate(() => {
    document.documentElement.style.setProperty('--dsw-alias-brand-primary', '#0d0e12');
    const style = selector => getComputedStyle(document.querySelector(selector));
    const selected = style('[data-notebook-tag-filter] button[data-tag-id][aria-pressed=true]');
    const activeTab = style('[data-notebook-nav] button[aria-pressed=true]');
    const create = style('[data-notebook-toolbar] button[data-notebook-primary]');
    const search = style('.notebook-filter-actions button[data-notebook-primary]');
    const result = { fontSize: selected.fontSize, chip: selected.backgroundColor,
      tab: activeTab.backgroundColor, create: create.backgroundColor, search: search.backgroundColor };
    document.documentElement.style.removeProperty('--dsw-alias-brand-primary');
    return result;
  });
  check(JSON.stringify(palette) === JSON.stringify({ fontSize: '11px',
    chip: 'rgba(58, 134, 255, 0.14)', tab: 'rgba(58, 134, 255, 0.14)',
    create: 'rgb(37, 99, 235)', search: 'rgb(37, 99, 235)' }),
  `selected filters and tab stay light blue while primary actions stay blue under a black host theme: ${JSON.stringify(palette)}`);
  await filters.getByRole('button', { name: '重置', exact: true }).click();
  await library.locator('li').first().waitFor();
  const card = library.locator('li').filter({ has: page.locator('.notebook-card-source') }).first();
  check((await card.locator('.notebook-card-source').textContent()).includes('fixture'), 'session ID fallback visible');
  check(await card.locator('.notebook-card-source').evaluate(el => getComputedStyle(el).color === 'rgb(72, 105, 219)'), 'session info blue');
  const actions = card.locator('.notebook-card-actions');
  check(await actions.locator('button').count() >= 2, 'card actions present');
  check(await actions.evaluate(el => {
    const first = el.querySelector('button').getBoundingClientRect();
    const more = el.querySelector('[data-note-more] summary').getBoundingClientRect();
    return Math.abs(first.top - more.top) < 2 && more.left > first.left && first.left - el.getBoundingClientRect().left < 2;
  }), 'three actions align at left');
  await card.getByRole('button', { name: '详情', exact: true }).click();
  const detail = library.locator('[data-note-detail]');
  await detail.waitFor();
  check(await detail.locator('.notebook-detail-meta').first().evaluate(el => getComputedStyle(el).borderLeftColor === 'rgb(72, 105, 219)'), 'detail accent');
  await detail.getByRole('button', { name: '返回列表', exact: true }).click();
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  const editor = page.locator('[data-notebook-editor]');
  await editor.locator('.notebook-compose-tags label').first().waitFor();
  for (const tag of createdTags) {
    const choice = editor.locator('.notebook-compose-tags label').filter({ hasText: tag.name });
    check(await choice.locator('.notebook-tag-color').evaluate((el, color) =>
      el.style.getPropertyValue('--tag-color') === color &&
      getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)', tag.color),
    `new note tag color is visible: ${tag.name}`);
  }
  await editor.locator('.notebook-compose-tags label').filter({ hasText: '界面标签一' }).locator('input').check();
  await editor.locator('.notebook-compose-tags label').filter({ hasText: '界面标签二' }).locator('input').check();
  const title = `多标签界面测试 ${Date.now()}`;
  await editor.locator('input[type=text]').fill(title);
  await editor.locator('textarea').fill('多标签保存内容');
  await editor.getByRole('button', { name: '保存笔记', exact: true }).click();
  await editor.waitFor({ state: 'detached' });
  const saved = library.locator('li').filter({ hasText: title });
  await saved.waitFor();
  check(await saved.locator('.notebook-card-tags span').count() === 2, 'two tags persisted on new note');
  await page.getByRole('navigation', { name: '笔记导航' }).getByRole('button', { name: '标签', exact: true }).click();
  const tagsPage = page.locator('[data-notebook-tags]');
  await tagsPage.locator('.notebook-tag-row').first().waitFor();
  check(await tagsPage.locator('[data-notebook-tag-heading] h4').count() === 0,
    'tag tab has no duplicate page heading');
  const tagType = await tagsPage.evaluate(root => {
    const size = selector => getComputedStyle(root.querySelector(selector)).fontSize;
    return { name: size('.notebook-tag-row>span'),
      count: size('.notebook-tag-row small'), action: size('.notebook-tag-actions>summary'),
      formLabel: size(':scope>label:has(input[type=text])'), input: size(':scope>label input[type=text]'),
      colorLegend: size('[data-notebook-tag-colors] legend'),
      colorChoice: size('[data-notebook-tag-colors] label'),
      create: size(':scope>button') };
  });
  check(JSON.stringify(tagType) === JSON.stringify({ name: '14px', count: '12px',
    action: '12px', formLabel: '12px', input: '12px', colorLegend: '12px',
    colorChoice: '12px', create: '12px' }), 'tag manager uses a consistent type scale');
  const newTagName = `选色标签 ${Date.now()}`;
  await tagsPage.locator('input[type=text]').fill(newTagName);
  await tagsPage.getByRole('radio', { name: '紫罗兰色' }).check();
  await tagsPage.getByRole('button', { name: '新建标签', exact: true }).last().click();
  const newTagRow = tagsPage.locator('.notebook-tag-row').filter({ hasText: newTagName });
  await newTagRow.waitFor();
  check(await newTagRow.locator('.notebook-tag-color').evaluate(el =>
    el.style.getPropertyValue('--tag-color') === '#7B61FF'), 'chosen new tag color appears in tag list');
  await tagsPage.getByRole('textbox', { name: '标签名称', exact: true }).fill('未保存的新标签草稿');
  await tagsPage.getByRole('radio', { name: '薄荷绿' }).check();
  const renameCallsBeforeCancel = await page.evaluate(() => window.fixtureCalls.filter(call =>
    call.method.endsWith('/tags/rename')).length);
  const tagRow = page.locator('.notebook-tag-row').filter({ hasText: '界面标签一' });
  await tagRow.locator('.notebook-tag-actions summary').click();
  await tagRow.getByRole('button', { name: '编辑标签', exact: true }).click();
  const tagDialog = page.getByRole('dialog', { name: '编辑标签' });
  await tagDialog.waitFor();
  check(await tagDialog.locator('[data-notebook-tag-colors] input[type=radio]').count() === 6,
    'edit dialog offers exactly six colors');
  check(!(await tagDialog.locator('[data-notebook-tag-colors]').textContent()).includes('亮粉色'),
    'color names are not visible');
  await tagDialog.getByRole('textbox', { name: '标签名称', exact: true }).fill('不保存的改名');
  await tagDialog.getByRole('button', { name: '取消修改', exact: true }).click();
  await tagDialog.waitFor({ state: 'detached' });
  check(await tagsPage.getByRole('textbox', { name: '标签名称', exact: true }).inputValue() === '未保存的新标签草稿',
    'cancel restores the create draft');
  check(await tagsPage.getByRole('radio', { name: '薄荷绿' }).isChecked(), 'cancel restores the selected color');
  check(await page.evaluate(() => window.fixtureCalls.filter(call =>
    call.method.endsWith('/tags/rename')).length) === renameCallsBeforeCancel, 'cancel does not write');
  await tagRow.locator('.notebook-tag-actions summary').click();
  await tagRow.getByRole('button', { name: '编辑标签', exact: true }).click();
  await tagDialog.getByRole('radio', { name: '亮粉色' }).check();
  await tagDialog.getByRole('button', { name: '保存标签', exact: true }).click();
  await tagDialog.waitFor({ state: 'detached' });
  check(await tagsPage.getByRole('textbox', { name: '标签名称', exact: true }).inputValue() === '未保存的新标签草稿',
    'saving an edit preserves the create draft');
  check(await tagsPage.getByRole('radio', { name: '薄荷绿' }).isChecked(),
    'saving an edit preserves the create color');
  await page.getByRole('navigation', { name: '笔记导航' }).getByRole('button', { name: '笔记库', exact: true }).click();
  const recolored = library.locator('li').filter({ hasText: title }); await recolored.waitFor();
  check(await recolored.locator('.notebook-card-tags>span').filter({ hasText: '界面标签一' })
    .evaluate(el => el.style.getPropertyValue('--tag-color') === '#FF5FA2'), 'chosen tag color appears in card');
  await recolored.getByRole('button', { name: '详情', exact: true }).click();
  check(await library.locator('[data-note-detail] .notebook-detail-tags>span').filter({ hasText: '界面标签一' })
    .evaluate(el => el.style.getPropertyValue('--tag-color') === '#FF5FA2'), 'chosen tag color appears in detail');
  await library.locator('[data-note-detail]').getByRole('button', { name: '返回列表', exact: true }).click();
  await page.screenshot({ path: '/private/tmp/notebook-requested-ui.png', animations: 'disabled' });
  await page.goto('http://127.0.0.1:43187/?noWorkspace=1');
  const workspaceStatus = page.locator('[data-notebook-workspace-status]');
  await workspaceStatus.waitFor();
  check(await workspaceStatus.evaluate(el => {
    const style = getComputedStyle(el);
    return { fontSize: style.fontSize, color: style.color, marginBottom: style.marginBottom };
  }).then(style => JSON.stringify(style) === JSON.stringify(normalWorkspaceStyle)),
  'missing workspace membership message matches normal workspace typography');
  console.log('PASS compact filters, source, colored tags, detail, multi-tag save and workspace status style');
}
