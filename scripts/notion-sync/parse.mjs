const HEADING_RE = /^(\d{3})\.\s*(.+)$/u;
const DATE_RE = /(\d{1,2}\/\d{1,2}\/\d{4})/u;
const PLACEHOLDERS = new Set(['待定', 'TBD', 'N/A', '暂无', '无']);
const META = {
  '时间': 'dateDisplay',
  '地点': 'location',
  '类型': 'type',
  'Host': 'host',
};

export function parseHeading(value, overrides = {}) {
  const text = value.trim();
  const match = text.match(HEADING_RE);
  if (!match) return null;
  return {
    number: overrides[text]?.eventNumber ?? Number(match[1]),
    title: match[2].trim(),
  };
}

function publicValue(value = '') {
  const normalized = value.trim();
  return PLACEHOLDERS.has(normalized) ? '' : normalized;
}

function calendarKey(value) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u.exec(value);
  if (!match) throw new Error(`invalid date: ${value}`);
  const [, month, day, year] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    throw new Error(`invalid date: ${value}`);
  }
  return year * 10000 + month * 100 + day;
}

export function parseEventBlock(raw, overrides = {}) {
  const heading = parseHeading(raw.heading, overrides);
  if (!heading) return null;

  const lines = raw.text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const metadata = {};
  const body = [];

  for (const line of lines.slice(1)) {
    const match = line.match(/^(时间|地点|类型|Host)：\s*(.*)$/u);
    if (match) metadata[META[match[1]]] = match[2].trim();
    else if (line !== '💡' && line !== 'Open') body.push(line);
  }

  const date = metadata.dateDisplay?.match(DATE_RE)?.[1];
  if (!date) {
    throw new Error(
      `event ${String(heading.number).padStart(3, '0')} has no parseable date`,
    );
  }
  calendarKey(date);

  const type = publicValue(metadata.type);
  const title = publicValue(heading.title) || (type ? `${type}活动` : '活动');
  const description = body
    .filter((line) => publicValue(line))
    .join('\n')
    .trim();

  return {
    ...heading,
    title,
    date,
    dateDisplay: metadata.dateDisplay,
    location: publicValue(metadata.location),
    type,
    host: publicValue(metadata.host),
    description,
    links: raw.links.filter((link) => /^https:\/\//u.test(link.href)),
    sourceBlockId: raw.blockId,
  };
}

export function classifyEvent(date, asOf) {
  const [asOfYear, asOfMonth, asOfDay] = asOf.split('-').map(Number);
  const key = calendarKey(date);
  const asOfKey = asOfYear * 10000 + asOfMonth * 100 + asOfDay;
  return key < asOfKey ? 'past' : 'upcoming';
}

export function normalizeEvents(events, { asOf, minimumCount }) {
  const filtered = events.filter(Boolean);
  const seen = new Map();
  const unique = [];

  for (const event of filtered) {
    const previous = seen.get(event.number);
    if (!previous) {
      seen.set(event.number, event);
      unique.push(event);
      continue;
    }

    const sameSourceBlock = event.sourceBlockId
      && event.sourceBlockId === previous.sourceBlockId;
    if (sameSourceBlock && JSON.stringify(event) === JSON.stringify(previous)) {
      continue;
    }

    const sourceIds = [previous.sourceBlockId, event.sourceBlockId]
      .filter(Boolean)
      .join(', ');
    throw new Error(
      `duplicate event number ${String(event.number).padStart(3, '0')}`
      + (sourceIds ? ` (source blocks: ${sourceIds})` : ''),
    );
  }

  if (unique.length < minimumCount) {
    throw new Error(
      `extracted ${unique.length} numbered events; expected at least ${minimumCount}`,
    );
  }

  const normalized = unique
    .map((event) => ({ ...event, status: classifyEvent(event.date, asOf) }))
    .sort((a, b) => a.number - b.number);

  const numbers = new Set(normalized.map((event) => event.number));
  const maximum = normalized.at(-1)?.number || 0;
  for (let number = 1; number <= maximum; number += 1) {
    if (!numbers.has(number)) {
      throw new Error(
        `missing event number ${String(number).padStart(3, '0')}`,
      );
    }
  }

  return normalized;
}
