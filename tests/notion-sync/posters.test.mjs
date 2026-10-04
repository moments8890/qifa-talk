import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDesiredPosterFiles,
  downloadPoster,
  downloadPosters,
} from '../../scripts/notion-sync/posters.mjs';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function imageResponse(
  body = PNG_1X1,
  url = 'https://zhz1208.notion.site/image/poster.png',
) {
  return {
    ok: true,
    status: 200,
    url,
    headers: new Headers({ 'content-type': 'image/png' }),
    arrayBuffer: async () => body,
  };
}

test('downloads and converts a Notion poster to a numbered JPEG', async () => {
  const poster = await downloadPoster({
    number: 7,
    posterUrl: 'https://zhz1208.notion.site/image/poster.png',
  }, { fetchImpl: async () => imageResponse() });

  assert.equal(poster.path, 'assets/images/007.jpg');
  assert.equal(poster.content.subarray(0, 2).toString('hex'), 'ffd8');
});

test('refuses poster URLs outside the public Notion image proxy', async () => {
  await assert.rejects(
    downloadPoster({
      number: 7,
      posterUrl: 'https://example.com/poster.png',
    }, { fetchImpl: async () => imageResponse() }),
    /unsupported Notion poster URL/u,
  );
});

test('allows redirects to the official Notion image CDN', async () => {
  const poster = await downloadPoster({
    number: 7,
    posterUrl: 'https://zhz1208.notion.site/image/poster.png',
  }, {
    fetchImpl: async () => imageResponse(
      PNG_1X1,
      'https://img.notionusercontent.com/s3/poster.png',
    ),
  });

  assert.equal(poster.path, 'assets/images/007.jpg');
});

test('fails closed when any event has no poster', async () => {
  await assert.rejects(
    downloadPosters([{ number: 7, title: 'Missing', posterUrl: '' }]),
    /event 007 has no Notion poster/u,
  );
});

test('allows only the verified events without Notion posters', async () => {
  const posters = await downloadPosters([
    { number: 1, title: 'Legacy one', posterUrl: '' },
    { number: 2, title: 'Legacy two', posterUrl: '' },
    { number: 38, title: 'Legacy 38', posterUrl: '' },
    { number: 48, title: 'Legacy 48', posterUrl: '' },
    { number: 66, title: 'Upcoming placeholder', posterUrl: '' },
    { number: 3, title: 'With poster', posterUrl: 'https://zhz1208.notion.site/image/003.png' },
  ], { fetchImpl: async () => imageResponse() });

  assert.deepEqual(posters.map((poster) => poster.path), [
    'assets/images/003.jpg',
  ]);
});

test('builds desired poster files from downloaded assets', () => {
  const content = Buffer.from('jpeg');
  assert.deepEqual(
    [...buildDesiredPosterFiles([{ path: 'assets/images/007.jpg', content }])],
    [['assets/images/007.jpg', content]],
  );
});
