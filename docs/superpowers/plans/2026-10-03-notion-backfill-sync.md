# Notion Backfill and Transitional Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backfill qifa-talk events from the public Notion page and add a deterministic daily/manual read-only sync that keeps GitHub Pages current until the host-input workflow replaces Notion.

**Architecture:** A Node 20 command launches Playwright against the public Notion page, expands visible toggles, extracts each event column into a provider-neutral record, validates and normalizes the complete set, and renders only numbered event Markdown under the existing Jekyll directories. Pure parser/renderer modules use Node's built-in test runner; one extractor module owns the network/browser boundary. A daily/manual GitHub Action runs tests, synchronizes content, and commits deterministic event changes.

**Tech Stack:** Node.js 20, Playwright 1.63.0, Node built-in test runner, Jekyll/GitHub Pages, GitHub Actions.

**Scope:** This plan implements only the transitional Notion backfill/sync subsystem requested as the first milestone. Google Form intake, reservations, operations confirmation, private/public spreadsheet separation, and poster-folder automation remain in a later implementation plan.

---

## File Structure

- `package.json`: Node scripts and pinned Playwright dependency.
- `package-lock.json`: reproducible dependency graph.
- `scripts/notion-sync/constants.mjs`: source URL, timezone, paths, and extraction guard.
- `scripts/notion-sync/parse.mjs`: pure heading, metadata, override, and classification logic.
- `scripts/notion-sync/render.mjs`: pure event-to-Markdown rendering.
- `scripts/notion-sync/extract.mjs`: Playwright navigation, scrolling, toggle expansion, and DOM extraction.
- `scripts/notion-sync/files.mjs`: desired/current comparison and guarded atomic writes.
- `scripts/notion-sync/sync.mjs`: dry-run, check, and write CLI.
- `scripts/notion-sync/overrides.json`: reviewed correction for the duplicate Notion number.
- `tests/notion-sync/*.test.mjs`: parser, renderer, and file-safety coverage.
- `.github/workflows/sync-notion.yml`: daily/manual transitional sync.
- `.github/workflows/auto-archive-events.yml`: legacy archive fallback, changed to manual-only.
- `README.md`: operator and cutover instructions.

### Task 1: Add the Node Test and Sync Scaffold

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Modify: `.gitignore`
- Create: `scripts/notion-sync/constants.mjs`

- [ ] **Step 1: Create package metadata**

Create `package.json`:

```json
{
  "name": "qifa-talk",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/notion-sync/*.test.mjs",
    "sync:notion": "node scripts/notion-sync/sync.mjs"
  },
  "devDependencies": {
    "playwright": "1.63.0"
  },
  "engines": {
    "node": ">=20 <21"
  }
}
```

- [ ] **Step 2: Generate the lockfile**

Run: `npm install --package-lock-only`

Expected: `package-lock.json` records `playwright@1.63.0`.

- [ ] **Step 3: Extend `.gitignore` without replacing existing rules**

Append:

```gitignore
node_modules/
playwright-report/
test-results/
```

- [ ] **Step 4: Add shared constants**

Create `scripts/notion-sync/constants.mjs`:

```js
export const NOTION_URL =
  'https://zhz1208.notion.site/2ab260812fe780e3b0c7dae2e1161041';
export const TIME_ZONE = 'America/Los_Angeles';
export const UPCOMING_DIR = 'qifa-talk/upcoming';
export const PAST_DIR = 'qifa-talk/past';
export const MIN_NUMBERED_EVENTS = 60;
export const SOURCE_MARKER = 'notion_sync_managed: true';
```

- [ ] **Step 5: Verify package metadata**

Run: `npm install && npm pkg get scripts engines devDependencies`

Expected: output shows Node 20, the test/sync commands, and Playwright 1.63.0.

- [ ] **Step 6: Commit the scaffold**

```bash
git add package.json package-lock.json .gitignore scripts/notion-sync/constants.mjs
git commit -m "build: add notion sync tooling"
```

### Task 2: Parse and Validate Notion Records

**Files:**
- Create: `scripts/notion-sync/parse.mjs`
- Create: `scripts/notion-sync/overrides.json`
- Create: `tests/notion-sync/parse.test.mjs`

- [ ] **Step 1: Write failing parser tests**

Create `tests/notion-sync/parse.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
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
  assert.equal(event.location, 'Ballard');
  assert.equal(event.type, '沉浸式体验');
  assert.equal(event.host, 'Lay & 老魏');
  assert.equal(event.description, '边走边聊 Ballard 的历史和移民文化。');
});

test('ignores unnumbered candidates', () => {
  assert.equal(parseHeading('0XX. 在水下呼吸'), null);
});

test('applies the reviewed duplicate-number override', () => {
  assert.deepEqual(
    parseHeading('066. 游戏人间', { '066. 游戏人间': { eventNumber: 68 } }),
    { number: 68, title: '游戏人间' },
  );
});

test('classifies dates against an injected Pacific date', () => {
  assert.equal(classifyEvent('10/2/2026', '2026-10-03'), 'past');
  assert.equal(classifyEvent('10/4/2026', '2026-10-03'), 'upcoming');
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
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `parse.mjs`.

- [ ] **Step 3: Implement parser contracts**

Create `scripts/notion-sync/parse.mjs`:

```js
const HEADING_RE = /^(\d{3})\.\s*(.+)$/u;
const DATE_RE = /(\d{1,2}\/\d{1,2}\/\d{4})/u;
const META = { '时间': 'dateDisplay', '地点': 'location', '类型': 'type', 'Host': 'host' };

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
  const lines = raw.text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const metadata = {};
  const body = [];
  for (const line of lines.slice(1)) {
    const match = line.match(/^(时间|地点|类型|Host)：\s*(.*)$/u);
    if (match) metadata[META[match[1]]] = match[2].trim();
    else if (line !== '💡' && line !== 'Open') body.push(line);
  }
  const date = metadata.dateDisplay?.match(DATE_RE)?.[1];
  if (!date) throw new Error(`event ${String(heading.number).padStart(3, '0')} has no parseable date`);
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
    throw new Error(`extracted ${filtered.length} numbered events; expected at least ${minimumCount}`);
  }
  const seen = new Set();
  return filtered.map((event) => {
    if (seen.has(event.number)) {
      throw new Error(`duplicate event number ${String(event.number).padStart(3, '0')}`);
    }
    seen.add(event.number);
    return { ...event, status: classifyEvent(event.date, asOf) };
  }).sort((a, b) => a.number - b.number);
}
```

- [ ] **Step 4: Add the explicit source correction**

Create `scripts/notion-sync/overrides.json`:

```json
{
  "066. 游戏人间": {
    "eventNumber": 68,
    "reason": "Notion repeats 066 after 067; preserve display order with the next number."
  }
}
```

- [ ] **Step 5: Run and commit**

Run: `npm test`

Expected: all parser tests PASS.

```bash
git add scripts/notion-sync/parse.mjs scripts/notion-sync/overrides.json tests/notion-sync/parse.test.mjs
git commit -m "feat: parse and validate notion events"
```

### Task 3: Render Deterministic Jekyll Pages

**Files:**
- Create: `scripts/notion-sync/render.mjs`
- Create: `tests/notion-sync/render.test.mjs`

- [ ] **Step 1: Write failing renderer tests**

Create `tests/notion-sync/render.test.mjs`:

```js
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
  const markdown = renderEvent({ ...event, email: 'private@example.com', wechatId: 'private-id' });
  assert.doesNotMatch(markdown, /private@example\.com|private-id/u);
});
```

- [ ] **Step 2: Verify the renderer tests fail**

Run: `npm test`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `render.mjs`.

- [ ] **Step 3: Implement the renderer**

Create `scripts/notion-sync/render.mjs`:

```js
function yamlString(value) {
  return JSON.stringify(String(value));
}

function escapeMarkdown(value) {
  return value.replaceAll('[', '\\[').replaceAll(']', '\\]');
}

export function renderEvent(event) {
  const number = String(event.number).padStart(3, '0');
  const fullTitle = `${number}. ${event.title}`;
  const parent = event.status === 'past' ? '往期活动' : '即将开始';
  const frontMatter = [
    '---',
    'layout: default',
    `title: ${yamlString(fullTitle)}`,
    `parent: ${yamlString(parent)}`,
    'grand_parent: "启发说"',
    `nav_order: ${event.number}`,
    `event_date: ${yamlString(event.date)}`,
    `event_time: ${yamlString(event.dateDisplay)}`,
    `location: ${yamlString(event.location)}`,
    `event_type: ${yamlString(event.type)}`,
    ...(event.host ? [`host: ${yamlString(event.host)}`] : []),
    ...(event.description ? [`description: ${yamlString(event.description.slice(0, 240))}`] : []),
    'source: "notion"',
    'notion_sync_managed: true',
    '---',
  ];
  const body = [
    `# ${fullTitle}`,
    '',
    `* **时间**：${event.dateDisplay}`,
    ...(event.location ? [`* **地点**：${event.location}`] : []),
    ...(event.type ? [`* **类型**：${event.type}`] : []),
    ...(event.host ? [`* **Host**：${event.host}`] : []),
  ];
  if (event.description) {
    body.push('', '{: .note-title }', '> **话题简介 (Topic Description)**', '>');
    for (const line of event.description.split('\n')) body.push(`> ${line}`);
  }
  if (event.links.length) {
    body.push('', '## 相关资料', '');
    for (const link of event.links) {
      body.push(`- [${escapeMarkdown(link.text || '查看链接')}](${link.href})`);
    }
  }
  return `${frontMatter.join('\n')}\n\n${body.join('\n')}\n`;
}
```

- [ ] **Step 4: Run and commit**

Run: `npm test`

Expected: all parser and renderer tests PASS.

```bash
git add scripts/notion-sync/render.mjs tests/notion-sync/render.test.mjs
git commit -m "feat: render notion events as jekyll pages"
```

### Task 4: Extract Event Blocks with Playwright

**Files:**
- Create: `scripts/notion-sync/extract.mjs`

- [ ] **Step 1: Install the pinned browser**

Run: `npx playwright install chromium`

Expected: Playwright reports Chromium installed successfully.

- [ ] **Step 2: Implement scrolling, toggle expansion, and DOM extraction**

Create `scripts/notion-sync/extract.mjs`:

```js
import { chromium } from 'playwright';

async function fullyLoad(page) {
  let stablePasses = 0;
  let previousHeight = 0;
  while (stablePasses < 3) {
    const height = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(250);
    stablePasses = height === previousHeight ? stablePasses + 1 : 0;
    previousHeight = height;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function expandToggles(page) {
  for (let pass = 0; pass < 4; pass += 1) {
    const buttons = page.getByRole('button', { name: 'Open', exact: true });
    const count = await buttons.count();
    if (count === 0) return;
    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index);
      if (await button.isVisible()) await button.click().catch(() => {});
    }
    await page.waitForTimeout(150);
  }
}

export async function extractNotionEvents(url, { headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage({ locale: 'en-US' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForFunction(
      () => document.querySelectorAll('h3').length >= 60,
      undefined,
      { timeout: 45_000 },
    );
    await fullyLoad(page);
    await expandToggles(page);
    await fullyLoad(page);
    return await page.evaluate(() => [...document.querySelectorAll('h3')].flatMap((heading) => {
      const block = heading.closest('.notion-column-block');
      if (!block) return [];
      return [{
        heading: heading.innerText.trim(),
        text: block.innerText.trim(),
        blockId: block.getAttribute('data-block-id') || '',
        links: [...block.querySelectorAll('a[href]')].map((anchor) => ({
          text: anchor.innerText.trim(),
          href: anchor.href,
        })),
      }];
    }));
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 3: Prove live extraction**

Run:

```bash
node --input-type=module -e "import { extractNotionEvents } from './scripts/notion-sync/extract.mjs'; const rows = await extractNotionEvents('https://zhz1208.notion.site/2ab260812fe780e3b0c7dae2e1161041'); console.log(rows.length, rows[0].heading);"
```

Expected: at least 60 event blocks and the first upcoming heading are printed.

- [ ] **Step 4: Commit the browser boundary**

```bash
git add scripts/notion-sync/extract.mjs
git commit -m "feat: extract public notion event blocks"
```

### Task 5: Compare and Write Managed Files Safely

**Files:**
- Create: `scripts/notion-sync/files.mjs`
- Create: `tests/notion-sync/files.test.mjs`

- [ ] **Step 1: Write failing file-safety tests**

Create `tests/notion-sync/files.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyEventFiles, buildDesiredFiles } from '../../scripts/notion-sync/files.mjs';

test('builds the path from derived status', () => {
  const desired = buildDesiredFiles([{ number: 54, status: 'upcoming', markdown: 'x' }]);
  assert.deepEqual([...desired.keys()], ['qifa-talk/upcoming/054.md']);
});

test('refuses to replace an unmanaged numbered file without adoption', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'qifa-notion-'));
  await mkdir(path.join(root, 'qifa-talk/upcoming'), { recursive: true });
  await mkdir(path.join(root, 'qifa-talk/past'), { recursive: true });
  await writeFile(path.join(root, 'qifa-talk/upcoming/054.md'), 'manual\n');
  await assert.rejects(
    applyEventFiles(root, new Map([['qifa-talk/upcoming/054.md', 'generated\n']]), { write: true }),
    /unmanaged event file/,
  );
  assert.equal(await readFile(path.join(root, 'qifa-talk/upcoming/054.md'), 'utf8'), 'manual\n');
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `files.mjs`.

- [ ] **Step 3: Implement guarded comparison and writes**

Create `scripts/notion-sync/files.mjs`:

```js
import { readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PAST_DIR, SOURCE_MARKER, UPCOMING_DIR } from './constants.mjs';

export function buildDesiredFiles(events) {
  return new Map(events.map((event) => {
    const directory = event.status === 'past' ? PAST_DIR : UPCOMING_DIR;
    return [`${directory}/${String(event.number).padStart(3, '0')}.md`, event.markdown];
  }));
}

async function numberedFiles(root, directory) {
  return (await readdir(path.join(root, directory)))
    .filter((name) => /^\d{3}\.md$/u.test(name))
    .map((name) => `${directory}/${name}`);
}

export async function compareEventFiles(root, desired) {
  const currentPaths = [
    ...await numberedFiles(root, PAST_DIR),
    ...await numberedFiles(root, UPCOMING_DIR),
  ];
  const changes = [];
  for (const [relativePath, content] of desired) {
    let current = null;
    try { current = await readFile(path.join(root, relativePath), 'utf8'); } catch {}
    if (current !== content) changes.push({ action: current === null ? 'create' : 'update', path: relativePath });
  }
  for (const relativePath of currentPaths) {
    if (!desired.has(relativePath)) changes.push({ action: 'remove-or-move', path: relativePath });
  }
  return changes;
}

export async function applyEventFiles(root, desired, { write, adoptExisting = false }) {
  const changes = await compareEventFiles(root, desired);
  if (!write) return changes;
  for (const change of changes) {
    const absolutePath = path.join(root, change.path);
    if (change.action === 'remove-or-move') {
      const current = await readFile(absolutePath, 'utf8');
      if (!adoptExisting && !current.includes(SOURCE_MARKER)) {
        throw new Error(`refusing to remove unmanaged event file: ${change.path}`);
      }
      await unlink(absolutePath);
      continue;
    }
    let current = '';
    try { current = await readFile(absolutePath, 'utf8'); } catch {}
    if (current && !adoptExisting && !current.includes(SOURCE_MARKER)) {
      throw new Error(`refusing to replace unmanaged event file: ${change.path}`);
    }
    const temporaryPath = `${absolutePath}.tmp`;
    await writeFile(temporaryPath, desired.get(change.path), 'utf8');
    await rename(temporaryPath, absolutePath);
  }
  return changes;
}
```

- [ ] **Step 4: Run and commit**

Run: `npm test`

Expected: all tests PASS.

```bash
git add scripts/notion-sync/files.mjs tests/notion-sync/files.test.mjs
git commit -m "feat: update notion-managed event files safely"
```

### Task 6: Add the CLI and Run the First Backfill

**Files:**
- Create: `scripts/notion-sync/sync.mjs`
- Modify: `qifa-talk/past/001.md` through the latest numbered past event
- Modify/Create: `qifa-talk/upcoming/NNN.md` for numbered upcoming events

- [ ] **Step 1: Implement CLI orchestration**

Create `scripts/notion-sync/sync.mjs`:

```js
#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { MIN_NUMBERED_EVENTS, NOTION_URL, TIME_ZONE } from './constants.mjs';
import { extractNotionEvents } from './extract.mjs';
import { applyEventFiles, buildDesiredFiles } from './files.mjs';
import { normalizeEvents, parseEventBlock } from './parse.mjs';
import { renderEvent } from './render.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function pacificToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const write = process.argv.includes('--write');
const check = process.argv.includes('--check');
const adoptExisting = process.argv.includes('--adopt-existing');
const asOf = option('--as-of') || pacificToday();
const url = option('--url') || NOTION_URL;
const overrides = JSON.parse(await readFile(new URL('./overrides.json', import.meta.url), 'utf8'));
const raw = await extractNotionEvents(url);
const parsed = raw.map((record) => parseEventBlock(record, overrides));
const events = normalizeEvents(parsed, { asOf, minimumCount: MIN_NUMBERED_EVENTS });
const rendered = events.map((event) => ({ ...event, markdown: renderEvent(event) }));
const desired = buildDesiredFiles(rendered);
const changes = await applyEventFiles(root, desired, { write, adoptExisting });

for (const change of changes) console.log(`${change.action}: ${change.path}`);
console.log(`events=${events.length} past=${events.filter((event) => event.status === 'past').length} upcoming=${events.filter((event) => event.status === 'upcoming').length} changes=${changes.length}`);
if (check && changes.length) process.exitCode = 1;
```

- [ ] **Step 2: Run a deterministic dry run**

Run: `npm run sync:notion -- --as-of 2026-10-03`

Expected: at least 60 numbered events, event 053 and earlier classified past, event 054 and later classified upcoming, and no files modified.

- [ ] **Step 3: Inspect representative proposed paths**

Run: `npm run sync:notion -- --as-of 2026-10-03 > /tmp/qifa-notion-dry-run.txt`

Run: `rg 'qifa-talk/(past|upcoming)/(001|025|032|053|054|066|067|068)\.md' /tmp/qifa-notion-dry-run.txt`

Expected: representative old, changed, boundary, new, and corrected events appear, including `068.md` for 游戏人间.

- [ ] **Step 4: Adopt current numbered pages and write the backfill**

Run: `npm run sync:notion -- --as-of 2026-10-03 --write --adopt-existing`

Expected: numbered events 001–053 are in `past`, 054–068 are in `upcoming`, and unnumbered `0XX` candidates are absent.

- [ ] **Step 5: Prove idempotency**

Run: `npm run sync:notion -- --as-of 2026-10-03 --check`

Expected: exit code 0 and `changes=0`.

- [ ] **Step 6: Verify generated content and privacy**

Run: `rg -L 'notion_sync_managed: true' qifa-talk/past/[0-9][0-9][0-9].md qifa-talk/upcoming/[0-9][0-9][0-9].md`

Expected: no output.

Run: `rg -n -i 'email|wechat|微信号|微信ID' qifa-talk/past qifa-talk/upcoming`

Expected: no private contact fields.

Run: `rg -n '^title:|^event_date:|^location:|^event_type:' qifa-talk/upcoming/054.md qifa-talk/upcoming/068.md`

Expected: both representative pages have valid public front matter.

- [ ] **Step 7: Run and commit**

Run: `npm test`

Expected: all tests PASS.

```bash
git add scripts/notion-sync/sync.mjs qifa-talk/past qifa-talk/upcoming
git commit -m "content: backfill events from notion"
```

### Task 7: Add the Daily and Manual Transition Workflow

**Files:**
- Create: `.github/workflows/sync-notion.yml`
- Modify: `.github/workflows/auto-archive-events.yml`

- [ ] **Step 1: Create the sync workflow**

Create `.github/workflows/sync-notion.yml`:

```yaml
name: Sync events from Notion

on:
  schedule:
    - cron: '20 8 * * *'
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: notion-event-sync
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm test
      - run: npm run sync:notion -- --write
      - run: npm run sync:notion -- --check

      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true

      - run: bundle exec jekyll build

      - name: Commit synchronized events
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add qifa-talk/past qifa-talk/upcoming
          if git diff --cached --quiet; then
            echo "Notion events are already current."
          else
            git commit -m "content: sync events from notion [skip ci]"
            git pull --rebase origin main
            git push origin HEAD:main
          fi
```

- [ ] **Step 2: Make the old archive workflow manual-only**

Replace its trigger with:

```yaml
on:
  workflow_dispatch:
```

Keep its job as a manual fallback until the new workflow has succeeded in GitHub Actions.

- [ ] **Step 3: Validate workflow syntax**

Run: `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/sync-notion.yml"); YAML.load_file(".github/workflows/auto-archive-events.yml"); puts "workflow yaml ok"'`

Expected: `workflow yaml ok`.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 4: Commit workflow changes**

```bash
git add .github/workflows/sync-notion.yml .github/workflows/auto-archive-events.yml
git commit -m "ci: sync notion events daily"
```

### Task 8: Document, Review, and Ship

**Files:**
- Modify: `README.md`
- Verify: sync code, workflow, and generated event pages

- [ ] **Step 1: Document operator commands and cutover**

Add this section to `README.md`:

````markdown
## Notion event sync

During the transition to host-managed intake, numbered event pages are generated from the public Notion page.

```bash
npm ci
npx playwright install chromium
npm test
npm run sync:notion                 # dry run
npm run sync:notion -- --write      # apply current Notion content
npm run sync:notion -- --check      # fail if the repo is out of date
```

The daily workflow is read-only toward Notion and commits only generated numbered event pages. Unnumbered `0XX` candidates are excluded. `scripts/notion-sync/overrides.json` contains reviewed source corrections, including the duplicate 066 mapping.

When host-managed intake becomes authoritative, run one final comparison, disable `.github/workflows/sync-notion.yml`, and retain the importer for historical reproducibility.
````

- [ ] **Step 2: Run the complete local verification set**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run sync:notion -- --as-of 2026-10-03 --check`

Expected: exit code 0 and `changes=0`.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 3: Commit documentation**

```bash
git add README.md
git commit -m "docs: explain notion event sync"
```

- [ ] **Step 4: Run pre-landing review**

Invoke the repository review workflow against the branch diff. Resolve every correctness, privacy, or destructive-write finding before shipping.

- [ ] **Step 5: Ship through the normal repository workflow**

Push the feature branch and open a pull request. Confirm GitHub Actions passes Node tests, the Notion check, and the GitHub Pages Jekyll build before merging.

- [ ] **Step 6: Verify the deployed site**

Verify event 053 is past, event 054 is next for 2026-10-04, numbered upcoming events continue through corrected event 068, unnumbered candidates are absent, missing posters do not break pages, and no private contact fields appear in page source or visible content.

- [ ] **Step 7: Prove the recurring path**

Trigger `Sync events from Notion` manually after deployment.

Expected: the workflow passes, reports that events are current, and creates no new commit.
