#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dateInTimeZone, parseSyncArguments } from './cli.mjs';
import {
  MIN_NUMBERED_EVENTS,
  NOTION_URL,
  TIME_ZONE,
} from './constants.mjs';
import { extractNotionEvents } from './extract.mjs';
import {
  applyEventFiles,
  assertNoEventChanges,
  buildDesiredFiles,
} from './files.mjs';
import { normalizeEvents, parseEventBlock } from './parse.mjs';
import { renderEvent } from './render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const options = parseSyncArguments(process.argv.slice(2));
const asOf = options.asOf || dateInTimeZone(new Date(), TIME_ZONE);
const url = options.url || NOTION_URL;
const overrides = JSON.parse(
  await readFile(new URL('./overrides.json', import.meta.url), 'utf8'),
);

const rawRecords = await extractNotionEvents(url, {
  minimumNumberedEvents: MIN_NUMBERED_EVENTS,
});
const parsedEvents = rawRecords.map((record) => parseEventBlock(record, overrides));
const events = normalizeEvents(parsedEvents, {
  asOf,
  minimumCount: MIN_NUMBERED_EVENTS,
});
const renderedEvents = events.map((event) => ({
  ...event,
  markdown: renderEvent(event),
}));
const desired = buildDesiredFiles(renderedEvents);
const changes = await applyEventFiles(root, desired, {
  write: options.write,
  adoptExisting: options.adoptExisting,
});
if (options.write) await assertNoEventChanges(root, desired);

for (const change of changes) {
  console.log(`${change.action}: ${change.path}`);
}

const pastCount = events.filter((event) => event.status === 'past').length;
const upcomingCount = events.length - pastCount;
console.log(
  `asOf=${asOf} events=${events.length} past=${pastCount} upcoming=${upcomingCount} changes=${changes.length}`,
);

if (options.check && changes.length > 0) process.exitCode = 1;
