// Run with: playwright-cli -s=<authorized-session> run-code --filename=tests/e2e/phase-0-browser-check.js
// Use only an already authenticated user-approved Harness page. Do not create a browser or export auth.
// This checks the existing deployment; it does not install, disable, restart, or write Notebook data.
async page => {
  const expectedVersion = '0.0.12';
  const entry = page.getByRole('button', { name: /^(打开 AI 笔记|Open AI Notes)$/ });
  const dialog = page.getByRole('dialog', { name: /^(AI 笔记|AI Notes)$/ });
  const connected = /^(Host 已连接；存储尚未就绪。|Host connected; storage is not ready\.)$/;
  const result = { origin: await page.evaluate(() => location.origin), expectedVersion, checks: {}, gatewayStatuses: [] };
  const requireCheck = (name, condition) => {
    result.checks[name] = condition;
    if (!condition) throw new Error(`PHASE0_CHECK_FAILED:${name}`);
  };
  // User-selected independent Web deployment, not the Desktop Host or a new preview server.
  requireCheck('targetWebOrigin', result.origin === 'http://127.0.0.1:3080');
  // Fail without changing the page if another Notebook surface is already open.
  requireCheck('initiallyClosed', await dialog.count() === 0);
  requireCheck('singleGlobalEntry', await entry.count() === 1);
  requireCheck('foreground', await page.evaluate(() => !document.hidden));
  const gateway = async () => {
    const status = await page.evaluate(async () => {
      const response = await fetch('/api/settings/describe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rpcId: 'notebook-phase0-check', args: {} }),
        signal: AbortSignal.timeout(5000),
      });
      await response.body?.cancel();
      return response.status;
    });
    result.gatewayStatuses.push(status);
    requireCheck(`gatewayRead${result.gatewayStatuses.length}`, status === 200);
  };
  let opened = false;
  try {
    await gateway();
    await entry.focus();
    await page.keyboard.press('Enter');
    opened = true;
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    await dialog.getByText(connected, { exact: true }).waitFor({ timeout: 15000 });
    requireCheck('productionRpcConnected', true);
    requireCheck('singleDialog', await dialog.count() === 1);
    requireCheck('version', await dialog.locator('[data-notebook-version]').getAttribute('data-notebook-version') === expectedVersion);
    requireCheck('initialFocusInside', await dialog.evaluate(el => el.contains(document.activeElement)));
    result.layout = await dialog.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const close = el.querySelector('button')?.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        viewport: { width: innerWidth, height: innerHeight },
        bounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        insideViewport: rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0
          && rect.right <= innerWidth && rect.bottom <= innerHeight,
        noHorizontalOverflow: el.scrollWidth <= el.clientWidth + 1,
        closeVisible: !!close && close.width > 0 && close.height > 0 && close.left >= rect.left
          && close.right <= rect.right && close.top >= rect.top && close.bottom <= rect.bottom,
        opaqueBackground: !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.backgroundColor),
        foregroundDistinct: style.color !== style.backgroundColor,
        background: style.backgroundColor, foreground: style.color,
      };
    });
    for (const check of ['insideViewport', 'noHorizontalOverflow', 'closeVisible', 'opaqueBackground', 'foregroundDistinct']) {
      requireCheck(check, result.layout[check]);
    }
    // Nonmodal surface: Tab is allowed to leave. Escape is deliberately checked with focus inside.
    await dialog.getByRole('button', { name: /^(关闭|Close)$/ }).focus();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    opened = false;
    requireCheck('escapeClosed', await dialog.count() === 0);
    requireCheck('focusReturned', await entry.evaluate(el => el === document.activeElement));
    await page.keyboard.press('Enter');
    opened = true;
    await dialog.getByText(connected, { exact: true }).waitFor({ timeout: 15000 });
    requireCheck('reopenedConnected', await dialog.count() === 1);
    await dialog.getByRole('button', { name: /^(关闭|Close)$/ }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    opened = false;
    requireCheck('buttonClosed', await dialog.count() === 0);
    requireCheck('noDuplicateEntry', await entry.count() === 1);
    await gateway();
    return result;
  } finally {
    if (opened && await dialog.count() === 1) {
      await dialog.getByRole('button', { name: /^(关闭|Close)$/ }).click({ timeout: 5000 });
      await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }
}
