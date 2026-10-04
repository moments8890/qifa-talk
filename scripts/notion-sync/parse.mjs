const HEADING_RE = /^(\d{3})\.\s*(.+)$/u;
const DATE_RE = /(\d{1,2}\/\d{1,2}\/\d{4})/u;
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

  return {
    ...heading,
    date,
    dateDisplay: metadata.dateDisplay,
    location: metadata.location || '',
    type: metadata.type || '',
    host: metadata.host || '',
    description: body.join('\n').trim(),
    links: raw.links.filter((link) => /^https:\/\//u.test(link.href)),
    sourceBlockId: raw.blockId,
  };
}

export function classifyEvent(date, asOf) {
  const [month, day, year] = date.split('/').map(Number);
  const [asOfYear, asOfMonth, asOfDay] = asOf.split('-').map(Number);
  const key = year * 10000 + month * 100 + day;
  const asOfKey = asOfYear * 10000 + asOfMonth * 100 + asOfDay;
  return key < asOfKey ? 'past' : 'upcoming';
}

export function normalizeEvents(events, { asOf, minimumCount }) {
  const filtered = events.filter(Boolean);
  if (filtered.length < minimumCount) {
    throw new Error(
      `extracted ${filtered.length} numbered events; expected at least ${minimumCount}`,
    );
  }

  const seen = new Set();
  return filtered
    .map((event) => {
      if (seen.has(event.number)) {
        throw new Error(
          `duplicate event number ${String(event.number).padStart(3, '0')}`,
        );
      }
      seen.add(event.number);
      return { ...event, status: classifyEvent(event.date, asOf) };
    })
    .sort((a, b) => a.number - b.number);
}
