import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  assertSuccessfulResponse,
  expandVisibleToggles,
  hydrateEventImages,
  extractNotionEvents,
  extractPageEvents,
  retryAsync,
} from '../../scripts/notion-sync/extract.mjs';

test('fails fast when the source responds with an HTTP error', () => {
  assert.throws(
    () => assertSuccessfulResponse({ status: () => 429 }),
    /HTTP 429/,
  );
  assert.doesNotThrow(
    () => assertSuccessfulResponse({ status: () => 200 }),
  );
});

test('retries transient extraction failures with a bounded attempt count', async () => {
  let attempts = 0;
  const result = await retryAsync(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('partial load');
      return 'complete';
    },
    { attempts: 3, delayMs: 0 },
  );

  assert.equal(result, 'complete');
  assert.equal(attempts, 3);
});

test('surfaces the final extraction failure after retries are exhausted', async () => {
  let attempts = 0;
  await assert.rejects(
    retryAsync(
      async () => {
        attempts += 1;
        throw new Error('still partial');
      },
      { attempts: 2, delayMs: 0 },
    ),
    /still partial/,
  );
  assert.equal(attempts, 2);
});

test('extracts event columns and their links from a Notion-shaped page', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setContent(`
      <div class="notion-column-block" data-block-id="event-054">
        <h3>054. 边走边认识西雅图｜Ballard</h3>
        <div>时间：10/4/2026 周日</div>
        <div>地点：Ballard</div>
        <img style="display:block" src="https://zhz1208.notion.site/image/poster-054.jpg" alt="活动海报">
        <a href="https://example.com/outline">活动资料</a>
      </div>
      <div class="notion-column-block" data-block-id="candidate">
        <h3>0XX. 候选活动</h3>
      </div>
    `);

    assert.deepEqual(await extractPageEvents(page), [
      {
        heading: '054. 边走边认识西雅图｜Ballard',
        text: [
          '054. 边走边认识西雅图｜Ballard',
          '时间：10/4/2026 周日',
          '地点：Ballard',
          '活动资料',
        ].join('\n'),
        blockId: 'event-054',
        links: [{ text: '活动资料', href: 'https://example.com/outline' }],
        images: [{
          alt: '活动海报',
          src: 'https://zhz1208.notion.site/image/poster-054.jpg',
        }],
      },
      {
        heading: '0XX. 候选活动',
        text: '0XX. 候选活动',
        blockId: 'candidate',
        links: [],
        images: [],
      },
    ]);
  } finally {
    await browser.close();
  }
});

test('segments adjacent events even when Notion nests them in one outer column', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setContent(`
      <div class="notion-column-block" data-block-id="outer">
        <h3 data-block-id="event-065">065. First</h3>
        <div>时间：8/17/2025 周日</div>
        <div>First description</div>
        <div class="notion-column-block" data-block-id="event-066">
          <h3>066. Second</h3>
          <div>时间：11/22/2026 周日</div>
          <div>Second description</div>
        </div>
      </div>
    `);

    const rows = await extractPageEvents(page);
    assert.equal(
      rows[0].text,
      ['065. First', '时间：8/17/2025 周日', 'First description'].join('\n'),
    );
    assert.equal(
      rows[1].text,
      ['066. Second', '时间：11/22/2026 周日', 'Second description'].join('\n'),
    );
    assert.deepEqual(rows.map((row) => row.images), [[], []]);
  } finally {
    await browser.close();
  }
});

test('associates a poster in a sibling column before the event heading', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setContent(`
      <div class="event-row">
        <div class="notion-column-block">
          <img src="https://zhz1208.notion.site/image/001.jpg" alt="活动海报">
        </div>
        <div class="notion-column-block" data-block-id="event-001">
          <h3>001. First</h3>
          <div>时间：1/1/2026 周四</div>
        </div>
      </div>
    `);

    const [row] = await extractPageEvents(page);
    assert.deepEqual(row.images, [{
      alt: '活动海报',
      src: 'https://zhz1208.notion.site/image/001.jpg',
    }]);
  } finally {
    await browser.close();
  }
});

test('hydrates each numbered event image before extraction', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setContent(`
      <div class="notion-column-block" style="height:900px">
        <h3>001. First</h3>
        <img loading="lazy" src="https://zhz1208.notion.site/image/001.jpg">
      </div>
      <div class="notion-column-block" style="height:900px">
        <h3>002. Second</h3>
        <img loading="lazy" src="https://zhz1208.notion.site/image/002.jpg">
      </div>
    `);

    const hydratedImages = await hydrateEventImages(page, { delayMs: 0 });
    await page.locator('img').evaluateAll((images) => images.forEach((image) => image.remove()));
    assert.deepEqual(
      (await extractPageEvents(page, hydratedImages)).map((row) => row.images[0].src),
      [
        'https://zhz1208.notion.site/image/001.jpg',
        'https://zhz1208.notion.site/image/002.jpg',
      ],
    );
  } finally {
    await browser.close();
  }
});

test('expands more toggles than the old fixed-pass ceiling', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setContent(Array.from({ length: 40 }, (_, index) =>
      `<button aria-label="Open" onclick="this.remove()">Open ${index}</button>`,
    ).join(''));

    await expandVisibleToggles(page);
    assert.equal(await page.getByRole('button', { name: 'Open', exact: true }).count(), 0);
  } finally {
    await browser.close();
  }
});

test('finishes page extraction before closing the browser', async () => {
  const html = Buffer.from(`
    <div class="notion-column-block" data-block-id="event-001">
      <h3>001. 生命周期测试</h3>
      <div>时间：1/1/2026 周四</div>
    </div>
  `).toString('base64');

  const rows = await extractNotionEvents(`data:text/html;charset=utf-8;base64,${html}`);
  assert.equal(rows[0].heading, '001. 生命周期测试');
});

test('waits for the required numbered records to finish lazy loading', async () => {
  const html = Buffer.from(`
    <div id="events">
      <div class="notion-column-block"><h3>001. First</h3></div>
    </div>
    <script>
      setTimeout(() => {
        document.querySelector('#events').insertAdjacentHTML(
          'beforeend',
          '<div class="notion-column-block"><h3>002. Second</h3></div>',
        );
      }, 2500);
    </script>
  `).toString('base64');

  const rows = await extractNotionEvents(
    `data:text/html;charset=utf-8;base64,${html}`,
    { minimumNumberedEvents: 2 },
  );
  assert.deepEqual(rows.map((row) => row.heading), ['001. First', '002. Second']);
});
