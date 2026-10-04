import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  assertSuccessfulResponse,
  expandVisibleToggles,
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
      },
      {
        heading: '0XX. 候选活动',
        text: '0XX. 候选活动',
        blockId: 'candidate',
        links: [],
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
