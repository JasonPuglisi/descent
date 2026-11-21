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

// Spotify's side of it: the client credentials token, the search and artist
// calls, and a cache of the art each track ended up with. Art for a track
// doesn't change, and popular tracks come up on many displays, so most track
// changes after the first don't need Spotify at all.
let tokenUrl = 'https://accounts.spotify.com/api/token';
let apiUrl = 'https://api.spotify.com/v1';

// Spotify's image URLs are content addressed and stay put, so the art can be
// kept a long time. A track with nothing to show is asked about again sooner,
// in case it was a blip.
let artTtl = 7 * 24 * 60 * 60 * 1000;
let missingArtTtl = 60 * 60 * 1000;
let artLimit = 2000;

// How long to wait before asking for a token again after Spotify refused one
let tokenRetry = 60 * 1000;

export function createSpotify({ client, secret, timeout = 4000, fetch = globalThis.fetch, now = Date.now }) {
  let token;
  let tokenExpires = 0;
  let tokenFailed = -Infinity;
  let tokenRequest;
  let art = new Map();
  let artRequests = new Map();

  // Fetched when first needed and again once it expires, rather than on a
  // timer, so an instance with nobody watching never asks
  async function getToken() {
    if (token && now() < tokenExpires)
      return token;

    if (!client || !secret || now() - tokenFailed < tokenRetry)
      return undefined;

    if (!tokenRequest)
      tokenRequest = requestToken().finally(() => { tokenRequest = undefined; });

    return tokenRequest;
  }

  async function requestToken() {
    let authorization = Buffer.from(`${client}:${secret}`).toString('base64');

    try {
      let response = await fetch(tokenUrl, {
        'method': 'post',
        'body': 'grant_type=client_credentials',
        'headers': {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authorization}`
        },
        'signal': AbortSignal.timeout(timeout)
      });

      if (!response.ok)
        throw new Error(`${response.status}`);

      let data = await response.json();

      token = data.access_token;
      // Renew a minute early, so a request never goes out on a token that's
      // about to lapse
      tokenExpires = now() + (data.expires_in - 60) * 1000;

      return token;
    } catch (e) {
      console.warn(`Error getting Spotify authorization: ${e.message || e.name}`);
      token = undefined;
      tokenFailed = now();

      return undefined;
    }
  }

  // Null when Spotify can't be asked or the request fails
  async function get(path) {
    let current = await getToken();

    if (!current)
      return null;

    try {
      let response = await fetch(`${apiUrl}/${path}`, {
        'headers': { 'Authorization': `Bearer ${current}` },
        'signal': AbortSignal.timeout(timeout)
      });

      if (response.status === 401)
        token = undefined;

      if (!response.ok) {
        console.warn(`Error calling Spotify: ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (e) {
      console.warn(`Error calling Spotify: ${e.name}`);
      return null;
    }
  }

  // Spotify ranks differently at limit=1 than at higher limits, returning a
  // worse top result, so always request a page and pick from it
  async function searchTracks(query) {
    let data = await get(`search?${new URLSearchParams({ 'q': query, 'type': 'track', 'limit': 5 })}`);

    return data ? data.tracks?.items || [] : null;
  }

  function searchTrack(artist, title, album) {
    return searchSpotifyTrack(artist, title, album, searchTracks);
  }

  function getArtist(id) {
    return get(`artists/${encodeURIComponent(id)}`);
  }

  async function lookUpArt(artist, title, album) {
    let track = await searchTrack(artist, title, album);

    // A failed search isn't the same as finding nothing, so it isn't kept
    if (track === null)
      return { found: undefined, keep: false };

    let albumImage = track?.album?.images?.[0]?.url;
    let artistId = track?.artists?.[0]?.id;
    let artistData = artistId ? await getArtist(artistId) : undefined;
    let artistImage = artistData?.images?.[0]?.url;

    return { found: { album: albumImage || '', artist: artistImage || '' }, keep: artistData !== null };
  }

  function remember(key, found) {
    // Oldest first, since a Map keeps insertion order
    while (art.size >= artLimit)
      art.delete(art.keys().next().value);

    art.set(key, { found, expires: now() + (found.album || found.artist ? artTtl : missingArtTtl) });
  }

  // Album and artist image URLs for a Last.fm track, either of which may be
  // empty
  async function artwork({ artist, title, album }) {
    if (!artist || !title)
      return { album: '', artist: '' };

    let key = JSON.stringify([artist, title, album || '']);
    let cached = art.get(key);

    if (cached && now() < cached.expires)
      return cached.found;

    if (artRequests.has(key))
      return artRequests.get(key);

    let request = lookUpArt(artist, title, album || '').then(({ found, keep }) => {
      if (keep)
        remember(key, found);

      return found || { album: '', artist: '' };
    }).finally(() => artRequests.delete(key));

    artRequests.set(key, request);

    return request;
  }

  return { artwork, searchTrack, getArtist, available: () => Boolean(client && secret), cached: () => art.size };
}
