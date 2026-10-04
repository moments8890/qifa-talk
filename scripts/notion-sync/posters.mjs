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

export async function downloadPoster(
  event,
  { fetchImpl = fetch } = {},
) {
  const sourceUrl = assertAllowedPosterUrl(event.posterUrl);
  const response = await fetchImpl(sourceUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
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

  const source = Buffer.from(await response.arrayBuffer());
  if (source.length === 0 || source.length > MAX_SOURCE_BYTES) {
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
