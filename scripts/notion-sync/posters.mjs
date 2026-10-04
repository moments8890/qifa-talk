import sharp from 'sharp';
import { retryAsync } from './extract.mjs';

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const VERIFIED_EVENTS_WITHOUT_POSTERS = new Set([1, 2, 3, 4, 38, 48, 66]);
const NOTION_IMAGE_HOSTS = new Set([
  'zhz1208.notion.site',
  'www.notion.so',
  'file.notion.so',
  'img.notionusercontent.com',
  'prod-files-secure.s3.us-west-2.amazonaws.com',
]);

function assertAllowedPosterUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`unsupported Notion poster URL: ${value}`);
  }
  if (
    url.protocol !== 'https:'
    || !NOTION_IMAGE_HOSTS.has(url.hostname)
  ) {
    throw new Error(`unsupported Notion poster URL: ${value}`);
  }
  return url;
}

async function fetchPoster(sourceUrl, fetchImpl) {
  let url = sourceUrl;
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const response = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get('location');
    if (!location) throw new Error('Notion poster redirect has no Location header');
    if (redirectCount === 5) {
      throw new Error('Notion poster exceeded the redirect limit');
    }
    url = assertAllowedPosterUrl(new URL(location, url).href);
  }
  throw new Error('Notion poster redirect loop ended unexpectedly');
}

async function readPosterBody(response) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_SOURCE_BYTES) {
    throw new Error('poster source exceeds the 20 MB limit');
  }

  if (!response.body?.getReader) {
    const source = Buffer.from(await response.arrayBuffer());
    if (source.length > MAX_SOURCE_BYTES) {
      throw new Error('poster source exceeds the 20 MB limit');
    }
    return source;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error('poster source exceeds the 20 MB limit');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

export async function downloadPoster(
  event,
  { fetchImpl = fetch } = {},
) {
  const sourceUrl = assertAllowedPosterUrl(event.posterUrl);
  const response = await fetchPoster(sourceUrl, fetchImpl);
  if (!response.ok) {
    throw new Error(
      `poster for event ${String(event.number).padStart(3, '0')} responded with HTTP ${response.status}`,
    );
  }
  assertAllowedPosterUrl(response.url || sourceUrl.href);

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(
      `poster for event ${String(event.number).padStart(3, '0')} is not an image`,
    );
  }

  const source = await readPosterBody(response);
  if (source.length === 0) {
    throw new Error(
      `poster for event ${String(event.number).padStart(3, '0')} has an invalid size`,
    );
  }

  const content = await sharp(source, { animated: false })
    .rotate()
    .resize({ width: 1400, withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  const number = String(event.number).padStart(3, '0');
  return { path: `assets/images/${number}.jpg`, content };
}

export async function downloadPosters(
  events,
  { fetchImpl = fetch, concurrency = 4 } = {},
) {
  for (const event of events) {
    if (!event.posterUrl && !VERIFIED_EVENTS_WITHOUT_POSTERS.has(event.number)) {
      throw new Error(
        `event ${String(event.number).padStart(3, '0')} has no Notion poster`,
      );
    }
  }

  const downloadableEvents = events.filter((event) => event.posterUrl);
  const results = new Array(downloadableEvents.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < downloadableEvents.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await retryAsync(
        () => downloadPoster(downloadableEvents[index], { fetchImpl }),
        { attempts: 3, delayMs: 2_000 },
      );
    }
  }

  const workerCount = Math.max(
    1,
    Math.min(concurrency, downloadableEvents.length),
  );
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export function buildDesiredPosterFiles(posters) {
  return new Map(posters.map((poster) => [poster.path, poster.content]));
}
