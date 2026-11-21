import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSpotify, matchTrack, normalizeName, searchSpotifyTrack } from '../lib/spotify.js';

function track(name, artists, album) {
  return { name, artists: artists.map(artist => ({ name: artist })), album: { name: album } };
}

// Stands in for the Spotify API, answering each query from a fixed table and
// recording what was asked
function fakeSearch(results) {
  let queries = [];
  let search = async query => {
    queries.push(query);
    return query in results ? results[query] : [];
  };

  return { search, queries };
}

describe('normalizeName', () => {
  it('drops case, spaces and punctuation', () => {
    assert.equal(normalizeName('AC/DC'), 'acdc');
    assert.equal(normalizeName('  The Beatles! '), 'thebeatles');
  });
});

describe('matchTrack', () => {
  let tracks = [
    track('Higher', ['Cover Band'], 'Covers Vol. 2'),
    track('Higher', ['Taio Cruz', 'Kylie Minogue'], 'Higher'),
    track('Higher', ['Taio Cruz'], 'Rokstarr')
  ];

  it('prefers the artist and album both matching', () => {
    assert.equal(matchTrack(tracks, 'Taio Cruz', 'Rokstarr'), tracks[2]);
  });

  it('falls back to the first artist match when the album differs', () => {
    assert.equal(matchTrack(tracks, 'Taio Cruz', 'Something Else'), tracks[1]);
  });

  it('matches a featured credit inside a longer artist string', () => {
    assert.equal(matchTrack(tracks, 'Taio Cruz feat. Kylie Minogue', ''), tracks[1]);
  });

  it('ignores very short artist names that would match by accident', () => {
    let short = [track('Song', ['M'], 'Album')];

    assert.equal(matchTrack(short, 'Eminem', ''), undefined);
  });
});

describe('searchSpotifyTrack', () => {
  let right = track('Higher', ['Taio Cruz'], 'Rokstarr');
  let wrong = track('Higher', ['Cover Band'], 'Covers');

  it('narrows from album-qualified queries down to free text', async () => {
    let { search, queries } = fakeSearch({});

    await searchSpotifyTrack('Taio Cruz', 'Higher', 'Rokstarr', search);

    assert.deepEqual(queries, [
      'track:"Higher" album:"Rokstarr"',
      'artist:"Taio Cruz" track:"Higher"',
      'Taio Cruz - Higher'
    ]);
  });

  it('skips the album query when there is no album', async () => {
    let { search, queries } = fakeSearch({});

    await searchSpotifyTrack('Taio Cruz', 'Higher', '', search);

    assert.equal(queries.length, 2);
  });

  it('stops at the first query with a matching artist', async () => {
    let { search, queries } = fakeSearch({ 'track:"Higher" album:"Rokstarr"': [wrong, right] });

    assert.equal(await searchSpotifyTrack('Taio Cruz', 'Higher', 'Rokstarr', search), right);
    assert.equal(queries.length, 1);
  });

  it('keeps going when results exist but none match', async () => {
    let { search } = fakeSearch({
      'track:"Higher" album:"Rokstarr"': [wrong],
      'artist:"Taio Cruz" track:"Higher"': [right]
    });

    assert.equal(await searchSpotifyTrack('Taio Cruz', 'Higher', 'Rokstarr', search), right);
  });

  it('falls back to the top result from the fuzziest query', async () => {
    let fuzzy = track('Higher (Live)', ['Someone'], 'Live');
    let { search } = fakeSearch({
      'track:"Higher" album:"Rokstarr"': [wrong],
      'Taio Cruz - Higher': [fuzzy]
    });

    assert.equal(await searchSpotifyTrack('Taio Cruz', 'Higher', 'Rokstarr', search), fuzzy);
  });

  it('gives up when the search fails', async () => {
    let search = async () => null;

    assert.equal(await searchSpotifyTrack('Taio Cruz', 'Higher', 'Rokstarr', search), null);
  });
});

// Stands in for Spotify's token, search and artist endpoints
function fakeSpotify({ tokenStatus = 200, searchStatus = 200, items } = {}) {
  let calls = [];
  let clock = { time: 1000000 };
  let found = items ?? [{
    name: 'Higher',
    artists: [{ name: 'Taio Cruz', id: 'taio' }],
    album: { name: 'Rokstarr', images: [{ url: 'https://i.scdn.co/rokstarr' }] }
  }];

  let fetch = async url => {
    let parsed = new URL(url);
    calls.push(parsed);

    let reply = (status, body) => ({ ok: status === 200, status, json: async () => body });

    if (parsed.hostname === 'accounts.spotify.com')
      return reply(tokenStatus, { 'access_token': 'token', 'expires_in': 3600 });

    if (parsed.pathname === '/v1/search')
      return reply(searchStatus, { tracks: { items: found } });

    return reply(200, { id: 'taio', images: [{ url: 'https://i.scdn.co/taio' }] });
  };

  let spotify = createSpotify({ client: 'id', secret: 'secret', fetch, now: () => clock.time });
  let count = path => calls.filter(call => call.pathname.startsWith(path)).length;

  return { spotify, calls, clock, count };
}

let higher = { artist: 'Taio Cruz', title: 'Higher', album: 'Rokstarr' };

describe('createSpotify', () => {
  it('finds album and artist art for a track', async () => {
    let { spotify } = fakeSpotify();

    assert.deepEqual(await spotify.artwork(higher), { album: 'https://i.scdn.co/rokstarr', artist: 'https://i.scdn.co/taio' });
  });

  it('keeps art so the same track never asks again', async () => {
    let { spotify, count, clock } = fakeSpotify();

    await spotify.artwork(higher);
    clock.time += 24 * 60 * 60 * 1000;
    await spotify.artwork(higher);

    assert.equal(count('/v1/search'), 1);
    assert.equal(count('/v1/artists'), 1);
  });

  it('shares one lookup between tracks asked for together', async () => {
    let { spotify, count } = fakeSpotify();

    await Promise.all([spotify.artwork(higher), spotify.artwork(higher)]);

    assert.equal(count('/v1/search'), 1);
  });

  it('reuses one token until it expires', async () => {
    let { spotify, count, clock } = fakeSpotify();

    await spotify.artwork(higher);
    await spotify.artwork({ ...higher, title: 'Dynamite' });
    assert.equal(count('/api/token'), 1);

    clock.time += 3600 * 1000;
    await spotify.artwork({ ...higher, title: 'Break Your Heart' });
    assert.equal(count('/api/token'), 2);
  });

  it('asks again sooner about a track with no art', async () => {
    let { spotify, count, clock } = fakeSpotify({ items: [] });

    assert.deepEqual(await spotify.artwork(higher), { album: '', artist: '' });
    clock.time += 30 * 60 * 1000;
    await spotify.artwork(higher);
    let searches = count('/v1/search');

    clock.time += 31 * 60 * 1000;
    await spotify.artwork(higher);

    assert.equal(count('/v1/search'), searches * 2);
  });

  it('doesn\'t keep a failed search', async () => {
    let { spotify, count } = fakeSpotify({ searchStatus: 500 });

    await spotify.artwork(higher);
    await spotify.artwork(higher);

    assert.equal(count('/v1/search'), 2);
  });

  it('waits a while before asking for another token after a refusal', async () => {
    let { spotify, count, clock } = fakeSpotify({ tokenStatus: 400 });

    await spotify.artwork(higher);
    await spotify.artwork({ ...higher, title: 'Dynamite' });
    assert.equal(count('/api/token'), 1);
    assert.equal(count('/v1/search'), 0);

    clock.time += 60 * 1000;
    await spotify.artwork({ ...higher, title: 'Break Your Heart' });
    assert.equal(count('/api/token'), 2);
  });

  it('never calls out without credentials', async () => {
    let calls = 0;
    let spotify = createSpotify({ fetch: async () => { calls++; } });

    assert.deepEqual(await spotify.artwork(higher), { album: '', artist: '' });
    assert.equal(spotify.available(), false);
    assert.equal(calls, 0);
  });
});
