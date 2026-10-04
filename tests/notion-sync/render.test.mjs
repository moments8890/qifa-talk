import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEvent } from '../../scripts/notion-sync/render.mjs';

const event = {
  number: 54,
  title: '边走边认识西雅图｜Ballard',
  date: '10/4/2026',
  dateDisplay: '10/4/2026 周日',
  location: 'Ballard',
  type: '沉浸式体验',
  host: 'Lay & 老魏',
  description: '边走边聊 Ballard 的历史和移民文化。',
  links: [{ text: '路线', href: 'https://example.com/route' }],
  status: 'upcoming',
};

test('renders stable public front matter and body', () => {
  const markdown = renderEvent(event);
  assert.match(markdown, /title: "054\. 边走边认识西雅图｜Ballard"/u);
  assert.match(markdown, /parent: "即将开始"/u);
  assert.match(markdown, /event_date: "10\/4\/2026"/u);
  assert.match(markdown, /notion_sync_managed: true/u);
  assert.match(markdown, /\[路线\]\(https:\/\/example\.com\/route\)/u);
});

test('omits missing optional fields', () => {
  const markdown = renderEvent({ ...event, host: '', description: '', links: [] });
  assert.doesNotMatch(markdown, /^host:/mu);
  assert.doesNotMatch(markdown, /待定/u);
  assert.doesNotMatch(markdown, /话题简介/u);
});

test('does not serialize private contact-shaped properties', () => {
  const markdown = renderEvent({
    ...event,
    email: 'private@example.com',
    wechatId: 'private-id',
  });
  assert.doesNotMatch(markdown, /private@example\.com|private-id/u);
});

test('renders past events under the past parent', () => {
  const markdown = renderEvent({ ...event, status: 'past' });
  assert.match(markdown, /parent: "往期活动"/u);
});
