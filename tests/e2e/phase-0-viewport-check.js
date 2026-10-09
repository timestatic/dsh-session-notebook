// Requires explicit user approval for temporary viewport changes; restores original dimensions.
// Run against the existing authenticated 3080 Web via playwright-cli run-code --filename.
async page => {
  const original = await page.evaluate(() => ({ origin: location.origin, width: innerWidth, height: innerHeight }));
  if (original.origin !== 'http://127.0.0.1:3080') throw new Error('PHASE0_VIEWPORT_FAILED:targetWebOrigin');
  const configured = page.viewportSize();
  const dialog = page.getByRole('dialog', { name: /^(AI 笔记|AI Notes)$/ });
  const entry = page.getByRole('button', { name: /^(打开 AI 笔记|Open AI Notes)$/ });
  if (await dialog.count() !== 0) throw new Error('PHASE0_VIEWPORT_FAILED:initiallyClosed');
  const results = [];
  let opened = false;
  try {
    for (const size of [{ width: 480, height: 640 }, { width: 800, height: 600 }]) {
      await page.setViewportSize(size);
      await entry.click({ timeout: 5000 });
      opened = true;
      await dialog.getByText(/^(Host 已连接；存储尚未就绪。|Host connected; storage is not ready\.)$/).waitFor({ timeout: 15000 });
      const layout = await dialog.evaluate(el => {
        const r = el.getBoundingClientRect();
        const b = el.querySelector('button').getBoundingClientRect();
        return {
          width: innerWidth, height: innerHeight,
          insideViewport: r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
          noHorizontalOverflow: el.scrollWidth <= el.clientWidth + 1,
          closeVisible: b.width > 0 && b.height > 0 && b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom,
        };
      });
      results.push(layout);
      if (layout.width !== size.width || layout.height !== size.height || !layout.insideViewport || !layout.noHorizontalOverflow || !layout.closeVisible) {
        throw new Error('PHASE0_VIEWPORT_FAILED:layout');
      }
      await dialog.getByRole('button', { name: /^(关闭|Close)$/ }).click();
      await dialog.waitFor({ state: 'hidden', timeout: 5000 });
      opened = false;
    }
  } finally {
    try {
      if (opened && await dialog.count() === 1) {
        await dialog.getByRole('button', { name: /^(关闭|Close)$/ }).click({ timeout: 5000 });
        await dialog.waitFor({ state: 'hidden', timeout: 5000 });
      }
    } finally {
      await page.setViewportSize(configured || { width: original.width, height: original.height });
    }
  }
  const restored = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  if (restored.width !== original.width || restored.height !== original.height) throw new Error('PHASE0_VIEWPORT_FAILED:restore');
  return { origin: original.origin, results, restored, dialogCount: await dialog.count() };
}
