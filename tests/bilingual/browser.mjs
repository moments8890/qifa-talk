import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.QIFA_PREVIEW_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    await page.locator('[data-language="en"]').click();
    await page.waitForURL('**/en/');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('[data-language="en"]').getAttribute('aria-current'), 'page');
    assert.ok(await page.locator('[data-language="zh"]').isVisible());
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(hasOverflow, false, `Homepage overflow at ${width}px`);
    const images = await page.locator('.event-card-img').evaluateAll(images => images.map(image => image.complete && image.naturalWidth > 0));
    assert.ok(images.every(Boolean), 'Featured posters failed to load');
    if (width < 1024) {
      await page.locator('#menu-btn').click();
      assert.equal(await page.locator('#menu-btn').getAttribute('aria-expanded'), 'true');
      await page.locator('#mobile-nav').getByRole('link', { name: 'About', exact: true }).click();
    } else {
      await page.locator('nav').getByRole('link', { name: 'About', exact: true }).filter({ visible: true }).click();
    }
    await page.waitForURL('**/en/about/');
    assert.match(await page.locator('main').innerText(), /Who We Are/);
    await page.locator('[data-language="zh"]').click();
    await page.waitForURL('**/about/');
    await page.goto(`${origin}/en/qifa-talk/upcoming/057.html`);
    assert.match(await page.locator('main').innerText(), /relativity/i);
    await page.locator('[data-language="zh"]').click();
    await page.waitForURL('**/qifa-talk/upcoming/057.html');
    await page.goto(`${origin}/en/timer/`);
    assert.equal(await page.locator('#start-btn').innerText(), 'Start');
    await page.locator('#duration-input').fill('1');
    await page.locator('#start-btn').click();
    await page.waitForTimeout(1100);
    await page.locator('#pause-btn').click();
    assert.match(await page.locator('.timer-display').innerText(), /00:59/);
    await page.locator('[data-target="free-debate-section"]').click();
    assert.match(await page.locator('#free-debate-section').innerText(), /Affirmative/);
    await page.goto(`${origin}/en/handsup/?s=ABCD#queue`);
    assert.match(await page.locator('[data-language="zh"]').getAttribute('href'), /\/handsup\/\?s=ABCD#queue$/);
    assert.equal(errors.length, 0, errors.join('\n'));
    await page.goto(`${origin}/en/`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `/tmp/qifa-english-${width}.png`, fullPage: true });
    console.log(`PASS: ${width}px language switching, navigation, event pages, posters, timer, and session links`);
    await page.close();
  }
} finally {
  await browser.close();
}
