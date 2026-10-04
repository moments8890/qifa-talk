import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {
  PAST_DIR,
  SOURCE_MARKER,
  UPCOMING_DIR,
} from './constants.mjs';

const MANAGED_PATH_RE = /^qifa-talk\/(?:past|upcoming)\/\d{3}\.md$/u;

export function buildDesiredFiles(events) {
  return new Map(events.map((event) => {
    const directory = event.status === 'past' ? PAST_DIR : UPCOMING_DIR;
    const number = String(event.number).padStart(3, '0');
    return [`${directory}/${number}.md`, event.markdown];
  }));
}

async function readOptional(filename) {
  try {
    return await readFile(filename, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function numberedFiles(root, directory) {
  let names;
  try {
    names = await readdir(path.join(root, directory));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return names
    .filter((name) => /^\d{3}\.md$/u.test(name))
    .sort()
    .map((name) => `${directory}/${name}`);
}

function validateDesired(desired) {
  for (const [relativePath, content] of desired) {
    if (!MANAGED_PATH_RE.test(relativePath)) {
      throw new Error(`refusing invalid managed event path: ${relativePath}`);
    }
    if (typeof content !== 'string') {
      throw new TypeError(`event content must be a string: ${relativePath}`);
    }
  }
}

export async function compareEventFiles(root, desired) {
  validateDesired(desired);
  const currentPaths = [
    ...await numberedFiles(root, PAST_DIR),
    ...await numberedFiles(root, UPCOMING_DIR),
  ];
  const changes = [];

  for (const [relativePath, content] of desired) {
    const current = await readOptional(path.join(root, relativePath));
    if (current !== content) {
      changes.push({
        action: current === null ? 'create' : 'update',
        path: relativePath,
      });
    }
  }

  for (const relativePath of currentPaths) {
    if (!desired.has(relativePath)) {
      changes.push({ action: 'remove-or-move', path: relativePath });
    }
  }

  return changes;
}

export async function assertNoEventChanges(root, desired) {
  const changes = await compareEventFiles(root, desired);
  if (changes.length > 0) {
    const paths = changes.map((change) => change.path).join(', ');
    throw new Error(`event write is not idempotent: ${paths}`);
  }
}

async function verifyChangesAreSafe(root, changes, adoptExisting) {
  if (adoptExisting) return;

  for (const change of changes) {
    if (change.action === 'create') continue;
    const current = await readFile(path.join(root, change.path), 'utf8');
    if (!current.includes(SOURCE_MARKER)) {
      throw new Error(`refusing to change unmanaged event file: ${change.path}`);
    }
  }
}

export async function applyEventFiles(
  root,
  desired,
  { write, adoptExisting = false },
) {
  const changes = await compareEventFiles(root, desired);
  if (!write) return changes;

  await verifyChangesAreSafe(root, changes, adoptExisting);

  for (const change of changes) {
    const absolutePath = path.join(root, change.path);
    if (change.action === 'remove-or-move') {
      await unlink(absolutePath);
      continue;
    }

    await mkdir(path.dirname(absolutePath), { recursive: true });
    const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, desired.get(change.path), 'utf8');
    await rename(temporaryPath, absolutePath);
  }

  return changes;
}
