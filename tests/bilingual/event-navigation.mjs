import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.QIFA_PREVIEW_URL || 'http://127.0.0.1:4174';
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const language of ['', '/en']) {
      await page.goto(`${origin}${language}/qifa-talk/upcoming/059.html`, { waitUntil: 'networkidle' });
      const nav = page.locator('.event-navigation');
      assert.equal(await nav.locator('[rel="prev"]').getAttribute('href'), `${language}/qifa-talk/upcoming/058.html`);
      assert.equal(await nav.locator('[rel="next"]').getAttribute('href'), `${language}/qifa-talk/upcoming/060.html`);
      await nav.locator('[rel="next"]').click();
      await page.waitForURL(`**${language}/qifa-talk/upcoming/060.html`);
      await page.locator('.event-navigation [rel="prev"]').click();
      await page.waitForURL(`**${language}/qifa-talk/upcoming/059.html`);
      await page.locator('.event-navigation').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `/tmp/qifa-event-nav-${language ? 'en' : 'zh'}-${width}.png` });
      await page.goto(`${origin}${language}/qifa-talk/upcoming/070.html`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.event-navigation [rel="next"]').count(), 0);
      await page.locator('.event-navigation').scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const link = await page.locator('.event-navigation [rel="prev"]').boundingBox();
      assert.ok(link.x >= 0 && link.x + link.width <= width);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: ${width}px Chinese/English neighbor links, click-through, boundaries, and long-title wrapping`);
    await page.close();
  }
} finally {
  await browser.close();
}
