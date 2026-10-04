import { chromium } from 'playwright';

const LOAD_TIMEOUT_MS = 60_000;

export function assertSuccessfulResponse(response) {
  const status = response?.status();
  if (status >= 400) {
    throw new Error(`Notion source responded with HTTP ${status}`);
  }
}

async function fullyLoad(page, minimumNumberedEvents) {
  let previousCount = -1;
  let stablePasses = 0;
  const deadline = Date.now() + LOAD_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const count = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.notion-column-block h3'))
        .filter((heading) => /^\d{3}\./u.test(heading.textContent.trim()))
        .length,
    );
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(250);

    if (count === previousCount) stablePasses += 1;
    else stablePasses = 0;
    previousCount = count;

    if (count >= minimumNumberedEvents && stablePasses >= 4) {
      await page.evaluate(() => window.scrollTo(0, 0));
      return;
    }
  }

  throw new Error(
    `Notion loaded ${previousCount} numbered events; expected at least ${minimumNumberedEvents}`,
  );
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

export async function extractNotionEvents(
  url,
  { headless = true, minimumNumberedEvents = 1 } = {},
) {
  const browser = await chromium.launch({ headless });

  try {
    const page = await browser.newPage({ locale: 'en-US' });
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: LOAD_TIMEOUT_MS,
    });
    assertSuccessfulResponse(response);
    await page.locator('.notion-column-block h3').first().waitFor({
      state: 'visible',
      timeout: LOAD_TIMEOUT_MS,
    });

    await fullyLoad(page, minimumNumberedEvents);
    await expandVisibleToggles(page);
    await fullyLoad(page, minimumNumberedEvents);

    return await extractPageEvents(page);
  } finally {
    await browser.close();
  }
}
