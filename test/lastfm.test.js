import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createLastfm, trimArtist, trimRecent, trimTrack } from '../lib/lastfm.js';

let key = 'test-key-0123456789';

function recentBody(name = 'Higher', nowPlaying = true) {
  return {
    recenttracks: {
      track: [{
        artist: { 'mbid': 'abc', '#text': 'Taio Cruz' },
        album: { 'mbid': 'def', '#text': 'Rokstarr' },
        name,
        url: 'https://www.last.fm/music/Taio+Cruz/_/Higher',
        image: [{ 'size': 'small', '#text': 'https://example.com/a.png' }],
        ...(nowPlaying ? { '@attr': { nowplaying: 'true' } } : {})
      }],
      '@attr': { user: 'djryan', total: '287137' }
    }
  };
}

// Stands in for fetch and the clock. Calls stay open until released, so tests
// can hold requests in flight, and every URL is recorded.
function fakeLastfm(options = {}, respond = () => ({ status: 200, body: recentBody() })) {
  let calls = [];
  let waiting = [];
  let clock = { time: 1000000 };

  let fetch = (url, fetchOptions) => {
    calls.push({ url: new URL(url), options: fetchOptions });

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

  let lastfm = createLastfm({ key, userAgent: 'Descent/test', fetch, now: () => clock.time, ...options });
  let release = () => waiting.splice(0).forEach(resolve => resolve());

  // Run a request to completion
  let settle = async promise => {
    await Promise.resolve();
    release();
    return promise;
  };

  return { lastfm, calls, clock, release, settle };
}

describe('trimming', () => {
  it('keeps only what the page reads from recent tracks', () => {
    assert.deepEqual(trimRecent(recentBody()), {
      track: {
        artist: 'Taio Cruz',
        album: 'Rokstarr',
        title: 'Higher',
        url: 'https://www.last.fm/music/Taio+Cruz/_/Higher',
        nowPlaying: true
      },
      total: '287137'
    });
  });

  it('handles a lone track sent as an object, and no tracks at all', () => {
    let single = recentBody('Higher', false);
    single.recenttracks.track = single.recenttracks.track[0];

    assert.equal(trimRecent(single).track.nowPlaying, false);
    assert.equal(trimRecent({ recenttracks: { 'track': [], '@attr': { total: '0' } } }).track, null);
  });

  it('keeps only play counts and the loved flag from the info calls', () => {
    assert.deepEqual(trimArtist({ artist: { name: 'Taio Cruz', bio: { content: 'x'.repeat(5000) }, stats: { userplaycount: '12' } } }),
      { playcount: '12' });
    assert.deepEqual(trimTrack({ track: { name: 'Higher', userplaycount: '3', userloved: '1' } }),
      { playcount: '3', loved: true });
  });
});

describe('createLastfm', () => {
  it('sends the key, method and parameters to Last.fm', async () => {
    let { lastfm, calls, settle } = fakeLastfm({}, () => ({ status: 200, body: { track: { userplaycount: '3', userloved: '0' } } }));

    await settle(lastfm.trackInfo('Taio Cruz', 'Higher', 'djryan'));

    let { url, options } = calls[0];
    assert.equal(url.origin + url.pathname, 'https://ws.audioscrobbler.com/2.0/');
    assert.equal(url.searchParams.get('method'), 'track.getInfo');
    assert.equal(url.searchParams.get('artist'), 'Taio Cruz');
    assert.equal(url.searchParams.get('track'), 'Higher');
    assert.equal(url.searchParams.get('username'), 'djryan');
    assert.equal(url.searchParams.get('api_key'), key);
    assert.equal(options.headers['User-Agent'], 'Descent/test');
  });

  it('returns trimmed bodies', async () => {
    let { lastfm, settle } = fakeLastfm();

    let { status, body } = await settle(lastfm.recentTracks('djryan'));

    assert.equal(status, 200);
    assert.equal(body.track.title, 'Higher');
    assert.equal(body.recenttracks, undefined);
  });

  it('shares one upstream call between requests in flight', async () => {
    let { lastfm, calls, settle } = fakeLastfm();

    let first = lastfm.recentTracks('djryan');
    let second = lastfm.recentTracks('djryan');
    await settle(Promise.all([first, second]));

    assert.equal(calls.length, 1);
  });

  it('shares a fresh answer between displays, and only briefly', async () => {
    let plays = 0;
    let { lastfm, calls, clock, settle } = fakeLastfm({ baseInterval: 3000 }, () => ({ status: 200, body: recentBody(`Track ${++plays}`) }));

    assert.equal((await settle(lastfm.recentTracks('djryan'))).body.track.title, 'Track 1');

    // Another display a second later gets the same answer
    clock.time += 1000;
    assert.equal((await lastfm.recentTracks('djryan')).body.track.title, 'Track 1');
    assert.equal(calls.length, 1);

    // A poll interval later it's fetched again, so a new track shows up
    clock.time += 2000;
    assert.equal((await settle(lastfm.recentTracks('djryan'))).body.track.title, 'Track 2');
    assert.equal(calls.length, 2);
  });

  it('keeps different users apart', async () => {
    let { lastfm, calls, settle } = fakeLastfm();

    await settle(Promise.all([lastfm.recentTracks('ben-xo'), lastfm.recentTracks('djryan')]));

    assert.equal(calls.length, 2);
  });

  it('holds upstream calls to the budget however often they are asked for', async () => {
    let { lastfm, calls, clock, settle } = fakeLastfm({ rate: 4 }, () => ({ status: 200, body: recentBody() }));

    // Forty different users in the same instant
    let results = await settle(Promise.all(Array.from({ length: 40 }, (_, i) => lastfm.recentTracks(`user${i}`))));

    assert.equal(calls.length, 4);
    assert.equal(results.filter(result => result.status === 429 && result.body.error === 29).length, 36);

    // The budget refills at the rate
    clock.time += 1000;
    await settle(Promise.all(Array.from({ length: 40 }, (_, i) => lastfm.recentTracks(`other${i}`))));
    assert.equal(calls.length, 8);
  });

  it('serves the last answer instead of an error when over budget', async () => {
    let { lastfm, clock, settle } = fakeLastfm({ rate: 1, baseInterval: 1000 });

    await settle(lastfm.recentTracks('djryan'));

    // Use up the budget on someone else, then come back after the answer is stale
    clock.time += 1000;
    await settle(lastfm.recentTracks('ben-xo'));
    clock.time += 10;

    let { status, body } = await lastfm.recentTracks('djryan');

    assert.equal(status, 200);
    assert.equal(body.track.title, 'Higher');
  });

  it('passes Last.fm errors through with their status', async () => {
    let { lastfm, settle } = fakeLastfm({}, () => ({ status: 429, body: { error: 29, message: 'Rate Limit Exceeded' } }));

    assert.deepEqual(await settle(lastfm.recentTracks('djryan')), { status: 429, body: { error: 29, message: 'Rate Limit Exceeded' } });
  });

  it('reports an unreachable Last.fm as a temporary error', async () => {
    let { lastfm, settle } = fakeLastfm({}, () => new TypeError('fetch failed'));

    let { status, body } = await settle(lastfm.recentTracks('djryan'));

    assert.equal(status, 502);
    assert.equal(body.error, 16);
    assert.equal(lastfm.pending(), 0);
  });

  it('reports a response it cannot read as a temporary error', async () => {
    let { lastfm, settle } = fakeLastfm({}, () => ({ status: 200, body: { unexpected: true } }));

    let { status, body } = await settle(lastfm.recentTracks('djryan'));

    assert.equal(status, 502);
    assert.equal(body.error, 16);
  });

  it('gives up on a request that runs past the timeout', async () => {
    let lastfm = createLastfm({ key, timeout: 20, fetch: (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason));
    }) });

    let { status, body } = await lastfm.recentTracks('djryan');

    assert.equal(status, 502);
    assert.match(body.message, /TimeoutError/);
  });

  it('does not call Last.fm without a key', async () => {
    let { calls } = fakeLastfm();
    let lastfm = createLastfm({ key: undefined, fetch: () => calls.push('called') });

    let { status, body } = await lastfm.recentTracks('djryan');

    assert.equal(status, 503);
    assert.equal(body.error, 10);
    assert.equal(calls.length, 0);
  });

  it('never echoes the key back', async () => {
    let { lastfm, settle } = fakeLastfm({}, () => ({ status: 403, body: { error: 10, message: `Invalid API key ${key}`, extra: key } }));

    let result = await settle(lastfm.recentTracks('djryan'));

    // Only Last.fm's message comes through, which is its own text
    assert.deepEqual(Object.keys(result.body), ['error', 'message']);
  });
});

describe('pollInterval', () => {
  it('stays at the base interval while the budget keeps up', async () => {
    let { lastfm, settle } = fakeLastfm({ rate: 4, baseInterval: 3000 });

    await settle(Promise.all(['a', 'b', 'c'].map(user => lastfm.recentTracks(user))));

    assert.equal(lastfm.pollInterval(), 3000);
  });

  it('stretches to fit more watched users into the budget', async () => {
    let { lastfm, clock, settle } = fakeLastfm({ rate: 4, baseInterval: 3000 });

    // Ask about 32 users over several seconds so the budget isn't the limit
    for (let i = 0; i < 32; i++) {
      clock.time += 300;
      await settle(lastfm.recentTracks(`user${i}`));
    }

    // 32 users at 3.2 polls a second is a 10 second cycle
    assert.equal(lastfm.pollInterval(), 10000);
  });

  it('stops counting people nobody is watching', async () => {
    let { lastfm, clock, settle } = fakeLastfm({ rate: 1, baseInterval: 3000 });

    for (let i = 0; i < 10; i++) {
      clock.time += 1000;
      await settle(lastfm.recentTracks(`user${i}`));
    }

    assert.ok(lastfm.pollInterval() > 3000);

    clock.time += 61 * 1000;
    assert.equal(lastfm.pollInterval(), 3000);
  });
});
