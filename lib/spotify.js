// Picking the right Spotify track for a Last.fm scrobble. The search itself is
// passed in, which keeps this free of credentials and network so it can be
// tested against canned results.

// Search narrows from album-qualified to free text, preferring a result that
// matches the Last.fm artist and album. Matching only ranks candidates - it never
// discards them, because scrobbles from low-quality sources often carry metadata
// that can't match exactly, and Spotify's fuzzy ranking beats showing nothing.
export async function searchSpotifyTrack(artist, title, album, search) {
  let queries = [];

  if (album)
    queries.push(`track:"${title}" album:"${album}"`);
  queries.push(`artist:"${artist}" track:"${title}"`);
  queries.push(`${artist} - ${title}`);

  let fallback;

  for (let query of queries) {
    let tracks = await search(query);

    if (!tracks)
      return null;

    if (tracks.length)
      fallback = tracks[0];

    let match = matchTrack(tracks, artist, album);

    if (match)
      return match;
  }

  // Nothing matched, so defer to Spotify's best guess from the fuzziest query
  return fallback;
}

export function matchTrack(tracks, artist, album) {
  let matches = tracks.filter(track => matchesArtist(track, artist));

  if (album) {
    let exact = matches.find(track => normalizeName(track.album.name) === normalizeName(album));

    if (exact)
      return exact;
  }

  return matches[0];
}

export function normalizeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchesArtist(track, artist) {
  let credit = normalizeName(artist);

  return track.artists.some(a => {
    let name = normalizeName(a.name);
    return name.length >= 3 && credit.includes(name);
  });
}
