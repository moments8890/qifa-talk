import { chromium } from 'playwright';

const LOAD_TIMEOUT_MS = 60_000;

async function fullyLoad(page) {
  let previousHeight = 0;
  let stablePasses = 0;

  for (let pass = 0; pass < 80 && stablePasses < 3; pass += 1) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);

    if (height === previousHeight) stablePasses += 1;
    else stablePasses = 0;
    previousHeight = height;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
}

async function expandVisibleToggles(page) {
  for (let pass = 0; pass < 4; pass += 1) {
    const buttons = page.getByRole('button', { name: 'Open', exact: true });
    const count = await buttons.count();
    let clicked = 0;

    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index);
      if (await button.isVisible().catch(() => false)) {
        await button.click({ timeout: 2_000 }).catch(() => {});
        clicked += 1;
      }
    }

    if (clicked === 0) break;
    await page.waitForTimeout(250);
  }
}

export async function extractPageEvents(page) {
  return page.locator('.notion-column-block h3').evaluateAll((headings) =>
    headings.map((heading) => {
      const column = heading.closest('.notion-column-block');
      const block = column.closest('[data-block-id]') || column;
      return {
        heading: heading.textContent.trim(),
        text: column.innerText.trim(),
        blockId: block.getAttribute('data-block-id') || '',
        links: Array.from(column.querySelectorAll('a[href]'), (link) => ({
          text: link.textContent.trim(),
          href: link.href,
        })),
      };
    }),
  );
}

export async function extractNotionEvents(url, { headless = true } = {}) {
  const browser = await chromium.launch({ headless });

  try {
    const page = await browser.newPage({ locale: 'en-US' });
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: LOAD_TIMEOUT_MS,
    });
    await page.locator('.notion-column-block h3').first().waitFor({
      state: 'visible',
      timeout: LOAD_TIMEOUT_MS,
    });

    await fullyLoad(page);
    await expandVisibleToggles(page);
    await fullyLoad(page);

    return await extractPageEvents(page);
  } finally {
    await browser.close();
  }
}
