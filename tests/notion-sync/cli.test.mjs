import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dateInTimeZone,
  parseSyncArguments,
} from '../../scripts/notion-sync/cli.mjs';

test('parses explicit write and source options', () => {
  assert.deepEqual(
    parseSyncArguments([
      '--write',
      '--adopt-existing',
      '--as-of',
      '2026-10-03',
      '--url',
      'https://example.com/notion',
    ]),
    {
      write: true,
      check: false,
      adoptExisting: true,
      asOf: '2026-10-03',
      url: 'https://example.com/notion',
    },
  );
});

test('rejects destructive adoption without write mode', () => {
  assert.throws(
    () => parseSyncArguments(['--adopt-existing']),
    /requires --write/,
  );
});

test('rejects malformed dates and unknown options', () => {
  assert.throws(
    () => parseSyncArguments(['--as-of', '10/03/2026']),
    /YYYY-MM-DD/,
  );
  assert.throws(
    () => parseSyncArguments(['--surprise']),
    /unknown option/,
  );
});

test('derives the date in the configured timezone', () => {
  const instant = new Date('2026-10-04T06:30:00Z');
  assert.equal(dateInTimeZone(instant, 'America/Los_Angeles'), '2026-10-03');
});
