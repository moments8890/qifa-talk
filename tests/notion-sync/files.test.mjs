import test from 'node:test';
import assert from 'node:assert/strict';
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  applyEventFiles,
  assertNoEventChanges,
  buildDesiredFiles,
} from '../../scripts/notion-sync/files.mjs';

async function fixtureRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'qifa-notion-'));
  await mkdir(path.join(root, 'qifa-talk/upcoming'), { recursive: true });
  await mkdir(path.join(root, 'qifa-talk/past'), { recursive: true });
  return root;
}

test('builds the path from derived status', () => {
  const desired = buildDesiredFiles([
    { number: 54, status: 'upcoming', markdown: 'x' },
  ]);
  assert.deepEqual([...desired.keys()], ['qifa-talk/upcoming/054.md']);
});

test('refuses to replace an unmanaged numbered file without adoption', async () => {
  const root = await fixtureRoot();
  const target = path.join(root, 'qifa-talk/upcoming/054.md');
  await writeFile(target, 'manual\n');

  await assert.rejects(
    applyEventFiles(
      root,
      new Map([['qifa-talk/upcoming/054.md', 'generated\n']]),
      { write: true },
    ),
    /unmanaged event file/,
  );
  assert.equal(await readFile(target, 'utf8'), 'manual\n');
});

test('preflights every change before writing any file', async () => {
  const root = await fixtureRoot();
  const unmanaged = path.join(root, 'qifa-talk/upcoming/054.md');
  const newFile = path.join(root, 'qifa-talk/upcoming/055.md');
  await writeFile(unmanaged, 'manual\n');

  await assert.rejects(
    applyEventFiles(
      root,
      new Map([
        ['qifa-talk/upcoming/055.md', 'new generated\n'],
        ['qifa-talk/upcoming/054.md', 'replacement\n'],
      ]),
      { write: true },
    ),
    /unmanaged event file/,
  );
  await assert.rejects(access(newFile));
  assert.equal(await readFile(unmanaged, 'utf8'), 'manual\n');
});

test('moves a managed numbered event while preserving nonnumbered pages', async () => {
  const root = await fixtureRoot();
  await writeFile(
    path.join(root, 'qifa-talk/upcoming/054.md'),
    'notion_sync_managed: true\nold\n',
  );
  await writeFile(path.join(root, 'qifa-talk/upcoming/movie.md'), 'manual movie\n');

  const desired = new Map([
    ['qifa-talk/past/054.md', 'notion_sync_managed: true\nnew\n'],
  ]);
  const changes = await applyEventFiles(root, desired, { write: true });

  assert.deepEqual(changes, [
    { action: 'create', path: 'qifa-talk/past/054.md' },
    { action: 'remove-or-move', path: 'qifa-talk/upcoming/054.md' },
  ]);
  assert.equal(
    await readFile(path.join(root, 'qifa-talk/past/054.md'), 'utf8'),
    'notion_sync_managed: true\nnew\n',
  );
  await assert.rejects(access(path.join(root, 'qifa-talk/upcoming/054.md')));
  assert.equal(
    await readFile(path.join(root, 'qifa-talk/upcoming/movie.md'), 'utf8'),
    'manual movie\n',
  );
});

test('adopts existing numbered files only when explicitly enabled', async () => {
  const root = await fixtureRoot();
  const target = path.join(root, 'qifa-talk/past/001.md');
  await writeFile(target, 'manual legacy page\n');

  await applyEventFiles(
    root,
    new Map([['qifa-talk/past/001.md', 'notion_sync_managed: true\nnew\n']]),
    { write: true, adoptExisting: true },
  );

  assert.equal(await readFile(target, 'utf8'), 'notion_sync_managed: true\nnew\n');
});

test('verifies a write is idempotent without refetching the source', async () => {
  const root = await fixtureRoot();
  const desired = new Map([
    ['qifa-talk/upcoming/054.md', 'notion_sync_managed: true\nnew\n'],
  ]);

  await assert.rejects(
    assertNoEventChanges(root, desired),
    /not idempotent.*054\.md/u,
  );
  await applyEventFiles(root, desired, { write: true });
  await assert.doesNotReject(assertNoEventChanges(root, desired));
});
