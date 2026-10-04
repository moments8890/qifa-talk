import { chromium } from 'playwright';

const LOAD_TIMEOUT_MS = 60_000;

export function assertSuccessfulResponse(response) {
  const status = response?.status();
  if (status >= 400) {
    throw new Error(`Notion source responded with HTTP ${status}`);
  }
}

export async function retryAsync(
  operation,
  { attempts = 3, delayMs = 10_000, onRetry = () => {} } = {},
) {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new TypeError('retry attempts must be a positive integer');
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt === attempts) throw error;
      onRetry(error, attempt);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error('retry loop ended unexpectedly');
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

export async function expandVisibleToggles(page) {
  for (let clickCount = 0; clickCount < 500; clickCount += 1) {
    const buttons = page.getByRole('button', { name: 'Open', exact: true });
    const count = await buttons.count();
    if (count === 0) return;

    let foundVisible = false;
    let lastError = null;

    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index);
      if (await button.isVisible().catch(() => false)) {
        foundVisible = true;
        try {
          await button.click({ timeout: 2_000 });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }
    }

    if (!foundVisible) return;
    if (lastError) throw lastError;
    await page.waitForTimeout(50);
  }

  throw new Error('refusing to expand more than 500 Notion toggles');
}

export async function extractPageEvents(page) {
  return page.locator('.notion-column-block h3').evaluateAll((headings) => {
    const allLinks = Array.from(document.querySelectorAll('a[href]'));
    const finalNode = document.body.lastChild;

    return headings.map((heading, index) => {
      const nextHeading = headings[index + 1];
      const range = document.createRange();
      range.setStartBefore(heading);
      if (nextHeading) range.setEndBefore(nextHeading);
      else range.setEndAfter(finalNode);

      const scratch = document.createElement('div');
      scratch.style.cssText = 'position:fixed;left:-100000px;opacity:0';
      scratch.append(range.cloneContents());
      document.body.append(scratch);
      const text = scratch.innerText.trim();
      scratch.remove();

      const block = heading.closest('[data-block-id]')
        || heading.closest('.notion-column-block');
      return {
        heading: heading.textContent.trim(),
        text,
        blockId: block.getAttribute('data-block-id') || '',
        links: allLinks
          .filter((link) => range.intersectsNode(link))
          .map((link) => ({
            text: link.textContent.trim(),
            href: link.href,
          })),
      };
    });
  });
}

async function extractNotionEventsOnce(
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

export async function extractNotionEvents(
  url,
  {
    headless = true,
    minimumNumberedEvents = 1,
    retryAttempts = 3,
    retryDelayMs = 10_000,
  } = {},
) {
  return retryAsync(
    () => extractNotionEventsOnce(url, { headless, minimumNumberedEvents }),
    {
      attempts: retryAttempts,
      delayMs: retryDelayMs,
      onRetry(error, attempt) {
        console.warn(
          `Notion extraction attempt ${attempt} failed: ${error.message}; retrying`,
        );
      },
    },
  );
}
