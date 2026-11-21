import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { matchTrack, normalizeName, searchSpotifyTrack } from '../lib/spotify.js';

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
