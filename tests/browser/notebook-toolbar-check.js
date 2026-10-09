async page => {
  const check = (value, label) => { if (!value) throw Error(label); };
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('http://127.0.0.1:43187/?selection=1');
  await page.locator('[data-notebook-library]').waitFor();
  const menu = page.getByRole('button', { name: '打开 AI 笔记', exact: true });
  check(await menu.count() === 1, 'one AI Notes menu');
  await menu.click();
  check(await page.evaluate(() => window.fixtureTabs.at(-1) === 'dsh-session-notebook'), 'menu opens native pane');
  const select = () => page.evaluate(() => {
    const node = document.querySelector('#fixture-chat .gKv1-q_body').firstChild;
    const range = document.createRange(); range.selectNodeContents(node);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  const toolbar = page.getByRole('dialog', { name: '选区操作', exact: true });
  const compact = async () => {
    await toolbar.waitFor();
    check(await toolbar.locator('textarea').count() === 0, 'editor collapsed on new selection');
    check(!(await toolbar.innerText()).includes('Source for toolbar selection.'), 'toolbar does not repeat quote');
    check(await toolbar.evaluate(el => el.getBoundingClientRect().height < 80), 'compact toolbar height');
  };
  const lastSaved = () => page.evaluate(async () => {
    const call = window.fixtureCalls.filter(call => call.method.endsWith('/notes/excerpt')).at(-1);
    const all = await (await fetch('/rpc', { method: 'POST', body: JSON.stringify({method:'dsh-session-notebook/library/query', payload:{scope:'all',limit:50}}) })).json();
    const row = all.value.items.find(item => call.payload.quote.content.startsWith(item.quoteExcerpt) && item.kind === call.payload.kind);
    const detail = await (await fetch('/rpc', {method:'POST',body:JSON.stringify({method:'dsh-session-notebook/notes/get',payload:{id:row.id}})})).json();
    return { intent: call.payload, note: detail.value.note };
  });
  await select(); await compact();
  await toolbar.getByRole('button', { name: '添加标签', exact: true }).click();
  const picker = toolbar.locator('[data-annotation-tag-picker]');
  await picker.getByRole('checkbox', { name: 'TODO' }).check();
  check(await toolbar.locator('[data-annotation-tags] button').count() === 0, 'no quick tag or duplicate save buttons');
  check(await toolbar.getByRole('button', { name: '保存划线', exact: true }).count() === 1, 'one save action in toolbar');
  check(await toolbar.locator('[data-annotation-actions]').getByRole('button', { name: '保存划线', exact: true }).count() === 1, 'save action is at top');
  check(await picker.locator('legend').innerText() === '选择标签', 'short picker title');
  const expandedWidth = await toolbar.evaluate(el => el.getBoundingClientRect().width);
  check(expandedWidth <= 275, `narrow tag popup: ${expandedWidth}`);
  await toolbar.getByRole('button', { name: '保存划线', exact: true }).click();
  await toolbar.waitFor({ state: 'detached' });
  let saved = await lastSaved();
  check(saved.note.kind === 'highlight' && saved.note.tagIds.includes('builtin_todo'), 'selected tag persisted');
  await select(); await compact();
  await toolbar.getByRole('button', { name: '记笔记', exact: true }).click();
  await toolbar.getByRole('textbox', { name: '笔记内容', exact: true }).fill('Typed annotation');
  check(await toolbar.getByRole('button', { name: '保存笔记', exact: true }).count() === 0, 'no duplicate bottom note save');
  check(await toolbar.getByRole('button', { name: '保存', exact: true }).count() === 1, 'one top note save');
  await toolbar.getByRole('button', { name: '取消选区操作', exact: true }).click();
  const discard = toolbar.locator('[data-annotation-discard]');
  check(await discard.getByRole('button', { name: '丢弃', exact: true }).evaluate(el => getComputedStyle(el).borderRadius) ===
    await toolbar.getByRole('button', { name: '保存', exact: true }).evaluate(el => getComputedStyle(el).borderRadius), 'discard action matches save shape');
  await discard.getByRole('button', { name: '继续编辑', exact: true }).click();
  await toolbar.getByRole('button', { name: '保存', exact: true }).click();
  await toolbar.waitFor({ state: 'detached' });
  saved = await lastSaved();
  check(saved.note.kind === 'note' && saved.note.bodyMarkdown === 'Typed annotation', 'annotation persisted');
  await select(); await compact();
  await toolbar.getByRole('button', { name: '添加标签', exact: true }).click();
  const tagPicker = toolbar.locator('[data-annotation-tag-picker]');
  const important = tagPicker.getByRole('checkbox', { name: '重要' });
  const todo = tagPicker.getByRole('checkbox', { name: 'TODO' });
  await important.check();
  await todo.check();
  check(await important.isChecked() && await todo.isChecked(), 'ordinary tags select without a modifier key');
  await todo.uncheck();
  check(await important.isChecked() && !(await todo.isChecked()), 'unchecking one tag retains the other');
  await toolbar.getByRole('textbox', { name: '新标签名称', exact: true }).fill(`New-${Date.now()}`);
  await toolbar.getByRole('button', { name: '保存划线', exact: true }).click();
  await toolbar.waitFor({ state: 'detached' });
  saved = await lastSaved();
  check(saved.note.tagIds.length === 2 && saved.note.tagIds.includes('builtin_important'), 'existing plus new tag persisted together');
  const ordinaryText = await page.evaluate(() => {
    const body = document.querySelector('#fixture-chat .gKv1-q_body');
    body.innerHTML = '<p>另外，还有一套可选的动态 Cordis 包机制，支持模型提交 Host/Client 代码并运行。</p><button>复制代码</button>';
    const node = body.querySelector('p').firstChild;
    const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, node.length);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return selection.toString();
  });
  await toolbar.waitFor();
  check(await toolbar.getByRole('button', { name: '保存划线', exact: true }).count() === 1,
    'ordinary selection keeps the save-highlight label beside unrelated controls');
  await toolbar.getByRole('button', { name: '保存划线', exact: true }).click();
  await toolbar.waitFor({ state: 'detached' });
  saved = await lastSaved();
  check(saved.note.quote.content === ordinaryText, 'ordinary selection preserves exact quote');
  check(await page.evaluate(() => {
    const node = document.querySelector('#fixture-chat .gKv1-q_body p').firstChild;
    return Array.from(CSS.highlights.values()).some(highlight => Array.from(highlight).some(range =>
      range.startContainer === node && range.startOffset === 0
      && range.endContainer === node && range.endOffset === node.length));
  }), 'ordinary selection restores the same text range');
  const selectedText = await page.evaluate(() => {
    const body = document.querySelector('#fixture-chat .gKv1-q_body');
    body.innerHTML = '<p>子作用域可以继承祖先的注册内容，较近的同名注册可以遮蔽较远的注册。</p><p>因此可以做到：</p><ul><li>公共工具所有 Agent 可见。</li><li>某个 Agent 有专属工具。</li><li>不同 Agent 使用不同工具限制。</li><li>Agent 销毁后，专属注册一起撤销</li></ul>';
    const start = body.querySelector('p').firstChild;
    const end = body.querySelectorAll('li')[3].firstChild;
    const range = document.createRange(); range.setStart(start, 0); range.setEnd(end, end.length);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return selection.toString();
  });
  await toolbar.waitFor();
  check(!(await toolbar.innerText()).includes('TRANSPORT_FAILED'), 'multiblock selection does not show transport failure');
  check(selectedText.includes('\n\n因此可以做到：\n\n'), 'real browser paragraph spacing reproduced');
  await toolbar.getByRole('button', { name: '保存划线', exact: true }).click();
  await toolbar.waitFor({ state: 'detached' });
  saved = await lastSaved();
  check(saved.note.quote.content === selectedText && saved.note.anchor.exact === selectedText, 'visible multiblock quote saved exactly');
  check(await page.evaluate(() => {
    const body = document.querySelector('#fixture-chat .gKv1-q_body');
    const start = body.querySelector('p').firstChild, end = body.querySelectorAll('li')[3].firstChild;
    return Array.from(CSS.highlights.entries()).some(([name, highlight]) =>
      name.startsWith('dsh-notebook-annotations-') && Array.from(highlight).some(range =>
        range.startContainer === start && range.startOffset === 0
        && range.endContainer === end && range.endOffset === end.length));
  }), 'saved multiblock quote relocated to the same DOM endpoints after reload');
  const mixedText = await page.evaluate(() => {
    const body = document.querySelector('#fixture-chat .gKv1-q_body');
    body.innerHTML = '<p>这是一种<strong>把业务功能与横切策略分离</strong>的设计。</p><p>工具作者负责“做什么”；权限、审批、超时、结果检查等，可以由其他插件接入统一管线。</p><p>例如真实的&nbsp;<code>dsh-tool-todo</code>&nbsp;实现就同时注册：</p><ul><li><code>todo_write</code>&nbsp;工具；</li><li><code>todos</code>&nbsp;会话投影。</li></ul><p>这也说明一个插件可以贡献多种能力，不是“一插件只能有一个工具”。</p>';
    const start = body.querySelector('p').firstChild, end = body.querySelectorAll('p')[3].firstChild;
    const range = document.createRange(); range.setStart(start, 1); range.setEnd(end, end.length);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return selection.toString();
  });
  await toolbar.waitFor();
  check(!(await toolbar.innerText()).includes('UNMAPPABLE_RANGE'), 'mixed Markdown selection maps safely');
  check(mixedText.includes('todos\u00a0会话投影。\n这也说明'), 'list-to-paragraph newline reproduced');
  await toolbar.getByRole('button', { name: '保存划线', exact: true }).click();
  await toolbar.waitFor({ state: 'detached' });
  saved = await lastSaved();
  check(saved.note.quote.content === mixedText && saved.note.anchor.exact === mixedText,
    'mixed Markdown quote saved exactly');
  check(saved.note.anchor.startOffset === undefined && saved.note.anchor.endOffset === undefined,
    'different browser and index whitespace never stores false offsets');
  check(await page.evaluate(() => {
    const body = document.querySelector('#fixture-chat .gKv1-q_body');
    const start = body.querySelector('p').firstChild, end = body.querySelectorAll('p')[3].firstChild;
    return Array.from(CSS.highlights.values()).some(highlight => Array.from(highlight).some(range =>
      range.startContainer === start && range.startOffset === 1
      && range.endContainer === end && range.endOffset === end.length));
  }), 'mixed Markdown quote relocated to its DOM endpoints');
  await select(); await compact();
  await page.screenshot({ path: '/private/tmp/notebook-toolbar-0.0.21.png' });
  await toolbar.getByRole('button', { name: '取消选区操作', exact: true }).click();
  check(errors.length === 0, errors.join(';'));
  console.log('PASS compact selection, single top save, multiselect tags, new tag transaction, annotation, repeated selection reset and native menu');
}
