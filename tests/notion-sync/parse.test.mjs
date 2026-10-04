import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyEvent,
  normalizeEvents,
  parseEventBlock,
  parseHeading,
} from '../../scripts/notion-sync/parse.mjs';

test('parses a numbered heading and metadata', () => {
  const event = parseEventBlock({
    heading: '054. 边走边认识西雅图｜Ballard',
    text: [
      '054. 边走边认识西雅图｜Ballard',
      '时间：10/4/2026 周日',
      '地点：Ballard',
      '类型：沉浸式体验',
      'Host：Lay & 老魏',
      '💡',
      '边走边聊 Ballard 的历史和移民文化。',
    ].join('\n'),
    links: [],
    blockId: 'block-054',
  });

  assert.equal(event.number, 54);
  assert.equal(event.title, '边走边认识西雅图｜Ballard');
  assert.equal(event.date, '10/4/2026');
  assert.equal(event.dateDisplay, '10/4/2026 周日');
  assert.equal(event.location, 'Ballard');
  assert.equal(event.type, '沉浸式体验');
  assert.equal(event.host, 'Lay & 老魏');
  assert.equal(event.description, '边走边聊 Ballard 的历史和移民文化。');
});

test('ignores unnumbered candidates', () => {
  assert.equal(parseHeading('0XX. 在水下呼吸'), null);
});

test('applies the reviewed duplicate-number overrides', () => {
  const overrides = JSON.parse(readFileSync(
    new URL('../../scripts/notion-sync/overrides.json', import.meta.url),
    'utf8',
  ));

  assert.deepEqual(
    parseHeading('061. 未知探索局 Unknown Club', overrides),
    { number: 60, title: '未知探索局 Unknown Club' },
  );
  assert.deepEqual(
    parseHeading('066. 游戏人间', overrides),
    { number: 68, title: '游戏人间' },
  );
});

test('classifies dates against an injected Pacific date', () => {
  assert.equal(classifyEvent('10/2/2026', '2026-10-03'), 'past');
  assert.equal(classifyEvent('10/4/2026', '2026-10-03'), 'upcoming');
});

test('rejects impossible calendar dates', () => {
  assert.throws(
    () => parseEventBlock({
      heading: '054. Invalid date',
      text: '054. Invalid date\n时间：2/29/2026 周日',
      links: [],
      blockId: 'bad-date',
    }),
    /invalid date.*2\/29\/2026/u,
  );
});

test('omits optional placeholders and derives a factual fallback title', () => {
  const event = parseEventBlock({
    heading: '065. 待定',
    text: [
      '065. 待定',
      '时间：11/29/2026 周日',
      '地点：Bellevue Library',
      '类型：科普/讨论',
      'Host：待定',
      '待定',
    ].join('\n'),
    links: [],
    blockId: 'event-065',
  });

  assert.equal(event.title, '科普/讨论活动');
  assert.equal(event.host, '');
  assert.equal(event.description, '');
});

test('rejects duplicate final event numbers', () => {
  assert.throws(
    () => normalizeEvents([
      { number: 54, title: 'A', date: '10/4/2026' },
      { number: 54, title: 'B', date: '10/11/2026' },
    ], { asOf: '2026-10-03', minimumCount: 2 }),
    /duplicate event number 054/,
  );
});

test('collapses identical render clones of the same Notion block', () => {
  const event = {
    number: 1,
    title: 'A',
    date: '10/4/2026',
    sourceBlockId: 'notion-block-1',
    links: [],
  };

  assert.deepEqual(
    normalizeEvents([event, { ...event }], {
      asOf: '2026-10-03',
      minimumCount: 1,
    }),
    [{ ...event, status: 'upcoming' }],
  );
});

test('rejects conflicting clones even when their Notion block ID matches', () => {
  assert.throws(
    () => normalizeEvents([
      {
        number: 1,
        title: 'A',
        date: '10/4/2026',
        sourceBlockId: 'notion-block-1',
      },
      {
        number: 1,
        title: 'Changed',
        date: '10/4/2026',
        sourceBlockId: 'notion-block-1',
      },
    ], { asOf: '2026-10-03', minimumCount: 1 }),
    /duplicate event number 001.*notion-block-1.*"title":"A".*"title":"Changed"/u,
  );
});

test('fails closed when extraction returns too few numbered events', () => {
  assert.throws(
    () => normalizeEvents([
      { number: 54, title: 'A', date: '10/4/2026' },
    ], { asOf: '2026-10-03', minimumCount: 60 }),
    /extracted 1 numbered events; expected at least 60/,
  );
});

test('fails closed when the extracted event sequence has a gap', () => {
  assert.throws(
    () => normalizeEvents([
      { number: 1, title: 'A', date: '10/1/2026' },
      { number: 3, title: 'C', date: '10/3/2026' },
    ], { asOf: '2026-10-03', minimumCount: 2 }),
    /missing event number 002/,
  );
});
