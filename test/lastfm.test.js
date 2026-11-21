import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createLastfm } from '../lib/lastfm.js';

let key = 'test-key-0123456789';

// Stands in for fetch. Each call waits until released, so tests can hold
// requests open to check what overlaps, and records the URL and headers.
function fakeFetch(respond = () => ({ status: 200, body: { recenttracks: { track: [] } } })) {
  let calls = [];
  let waiting = [];

  let fetch = (url, options) => {
    calls.push({ url: new URL(url), options });

    return new Promise((resolve, reject) => {
      waiting.push(() => {
        let result = respond(new URL(url));

        if (result instanceof Error)
          reject(result);
        else
          resolve({ status: result.status, json: async () => result.body });
      });
    });
  };

  let release = () => waiting.splice(0).forEach(resolve => resolve());

  return { fetch, calls, release };
}

describe('createLastfm', () => {
  it('sends the key, method and parameters to Last.fm', async () => {
    let fake = fakeFetch();
    let lastfm = createLastfm({ key, userAgent: 'Descent/test', fetch: fake.fetch });

    let pending = lastfm.trackInfo('Taio Cruz', 'Higher', 'djryan');
    fake.release();
    await pending;

    let { url, options } = fake.calls[0];
    assert.equal(url.origin + url.pathname, 'https://ws.audioscrobbler.com/2.0/');
    assert.equal(url.searchParams.get('method'), 'track.getInfo');
    assert.equal(url.searchParams.get('artist'), 'Taio Cruz');
    assert.equal(url.searchParams.get('track'), 'Higher');
    assert.equal(url.searchParams.get('username'), 'djryan');
    assert.equal(url.searchParams.get('api_key'), key);
    assert.equal(url.searchParams.get('format'), 'json');
    assert.equal(options.headers['User-Agent'], 'Descent/test');
  });

  it('shares one upstream call between identical requests in flight', async () => {
    let fake = fakeFetch();
    let lastfm = createLastfm({ key, fetch: fake.fetch });

    let first = lastfm.recentTracks('ben-xo');
    let second = lastfm.recentTracks('ben-xo');
    fake.release();

    assert.equal(fake.calls.length, 1);
    assert.deepEqual(await first, await second);
  });

  it('never serves a finished response to a later request', async () => {
    let plays = 0;
    let fake = fakeFetch(() => ({ status: 200, body: { plays: ++plays } }));
    let lastfm = createLastfm({ key, fetch: fake.fetch });

    let first = lastfm.recentTracks('ben-xo');
    fake.release();
    assert.equal((await first).body.plays, 1);
    assert.equal(lastfm.pending(), 0);

    let second = lastfm.recentTracks('ben-xo');
    fake.release();
    assert.equal((await second).body.plays, 2);
    assert.equal(fake.calls.length, 2);
  });

  it('keeps different requests apart', async () => {
    let fake = fakeFetch();
    let lastfm = createLastfm({ key, fetch: fake.fetch });

    let requests = [lastfm.recentTracks('ben-xo'), lastfm.recentTracks('djryan'), lastfm.artistInfo('Taio Cruz', 'djryan')];
    fake.release();
    await Promise.all(requests);

    assert.equal(fake.calls.length, 3);
  });

  it('passes Last.fm errors through with their status', async () => {
    let fake = fakeFetch(() => ({ status: 429, body: { error: 29, message: 'Rate Limit Exceeded' } }));
    let lastfm = createLastfm({ key, fetch: fake.fetch });

    let pending = lastfm.recentTracks('ben-xo');
    fake.release();

    assert.deepEqual(await pending, { status: 429, body: { error: 29, message: 'Rate Limit Exceeded' } });
  });

  it('reports an unreachable Last.fm as a temporary error', async () => {
    let fake = fakeFetch(() => new TypeError('fetch failed'));
    let lastfm = createLastfm({ key, fetch: fake.fetch });

    let pending = lastfm.recentTracks('ben-xo');
    fake.release();
    let { status, body } = await pending;

    assert.equal(status, 502);
    assert.equal(body.error, 16);
    assert.equal(lastfm.pending(), 0);
  });

  it('gives up on a request that runs past the timeout', async () => {
    let lastfm = createLastfm({ key, timeout: 20, fetch: (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason));
    }) });

    let { status, body } = await lastfm.recentTracks('ben-xo');

    assert.equal(status, 502);
    assert.match(body.message, /TimeoutError/);
  });

  it('does not call Last.fm without a key', async () => {
    let fake = fakeFetch();
    let lastfm = createLastfm({ key: undefined, fetch: fake.fetch });

    let { status, body } = await lastfm.recentTracks('ben-xo');

    assert.equal(status, 503);
    assert.equal(body.error, 10);
    assert.equal(fake.calls.length, 0);
  });

  it('never echoes the key back', async () => {
    let fake = fakeFetch(() => new Error(`something mentioning ${key}`));
    let lastfm = createLastfm({ key, fetch: fake.fetch });

    let pending = lastfm.recentTracks('ben-xo');
    fake.release();

    assert.ok(!JSON.stringify(await pending).includes(key));
  });
});
