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
  const requested = [];
  const poster = await downloadPoster({
    number: 7,
    posterUrl: 'https://zhz1208.notion.site/image/poster.png',
  }, {
    fetchImpl: async (url) => {
      requested.push(url.href || String(url));
      if (requested.length === 1) {
        return {
          ok: false,
          status: 302,
          url: requested[0],
          headers: new Headers({
            location: 'https://img.notionusercontent.com/s3/poster.png',
          }),
        };
      }
      return imageResponse(PNG_1X1, requested[1]);
    },
  });

  assert.equal(poster.path, 'assets/images/007.jpg');
  assert.deepEqual(requested, [
    'https://zhz1208.notion.site/image/poster.png',
    'https://img.notionusercontent.com/s3/poster.png',
  ]);
});

test('never requests a disallowed redirect target', async () => {
  const requested = [];
  await assert.rejects(
    downloadPoster({
      number: 7,
      posterUrl: 'https://zhz1208.notion.site/image/poster.png',
    }, {
      fetchImpl: async (url) => {
        requested.push(url.href || String(url));
        return {
          ok: false,
          status: 302,
          url: requested[0],
          headers: new Headers({ location: 'http://127.0.0.1/private' }),
        };
      },
    }),
    /unsupported Notion poster URL/u,
  );
  assert.deepEqual(requested, [
    'https://zhz1208.notion.site/image/poster.png',
  ]);
});

test('fails closed when any event has no poster', async () => {
  await assert.rejects(
    downloadPosters([{ number: 7, title: 'Missing', posterUrl: '' }]),
    /event 007 has no Notion poster/u,
  );
});

test('allows exactly the seven verified events without Notion posters', async () => {
  for (const number of [1, 2, 3, 4, 38, 48, 66]) {
    await assert.doesNotReject(
      downloadPosters([{ number, title: 'Verified gap', posterUrl: '' }]),
    );
  }

  for (const number of [5, 37, 39, 47, 49, 65, 67]) {
    await assert.rejects(
      downloadPosters([{ number, title: 'Not exempt', posterUrl: '' }]),
      new RegExp(`event ${String(number).padStart(3, '0')} has no Notion poster`, 'u'),
    );
  }
});

test('builds desired poster files from downloaded assets', () => {
  const content = Buffer.from('jpeg');
  assert.deepEqual(
    [...buildDesiredPosterFiles([{ path: 'assets/images/007.jpg', content }])],
    [['assets/images/007.jpg', content]],
  );
});
