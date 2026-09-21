const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const base = process.env.TEST_URL || 'http://127.0.0.1:4175';
    const failed = await browser.newContext({ serviceWorkers: 'block' });
    const failurePage = await failed.newPage();
    await failurePage.route('**/app.js?*', route => route.abort());
    await failurePage.goto(base);
    await failurePage.locator('#retry-startup:not([hidden])').waitFor();
    if (!(await failurePage.locator('#startup-message').innerText()).includes('未能加载')) throw new Error('Missing load error');
    await failurePage.unroute('**/app.js?*');
    await failurePage.locator('#retry-startup').click();
    await failurePage.locator('.task-item').first().waitFor();
    await failurePage.locator('[data-view="health"]').click();
    await failurePage.locator('#view-health.is-active').waitFor();
    await failed.close();

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(base);
    await page.locator('.task-item').first().waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const count = await page.locator('.task-item').count();
    await context.setOffline(true);
    await page.goto(`${base}/?offline-recovery=1`);
    await page.locator('.task-item').first().waitFor();
    if ((await page.locator('.task-item').count()) !== count) throw new Error('Records changed after reload');
    await page.locator('[data-view="modules"]').click();
    await page.locator('[data-workspace="cpa"]').click();
    if (!(await page.locator('.cpa-studio').isVisible())) throw new Error('Offline navigation failed');
    await context.close();
    console.log('Startup failure recovery and offline navigation passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
