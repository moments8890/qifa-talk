import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  extractNotionEvents,
  extractPageEvents,
} from '../../scripts/notion-sync/extract.mjs';

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
