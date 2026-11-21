// Server side Last.fm calls, so the API key never reaches the browser. A key
// handed to every visitor gets copied into other projects and rate limited or
// suspended along with them, which is what happened to the original one.
//
// Nothing is cached, because track changes should show up as soon as Last.fm
// reports them. The one saving is that identical requests already in flight
// share a single upstream call, so several displays polling the same person at
// the same moment cost one request instead of several.

let endpoint = 'https://ws.audioscrobbler.com/2.0/';

// Last.fm's own code for a temporary failure, used when it can't be reached at
// all so the browser treats it like any other failed poll
let unavailable = 16;

export function createLastfm({ key, userAgent, timeout = 4000, fetch = globalThis.fetch }) {
  let inFlight = new Map();

  function call(method, params) {
    if (!key)
      return Promise.resolve({ status: 503, body: { error: 10, message: 'No Last.fm API key is configured' } });

    let query = new URLSearchParams({ method, ...params, 'api_key': key, 'format': 'json' });
    let url = `${endpoint}?${query}`;

    if (inFlight.has(url))
      return inFlight.get(url);

    let request = forward(url).finally(() => inFlight.delete(url));
    inFlight.set(url, request);

    return request;
  }

  // Pass Last.fm's status and body through untouched, since the browser
  // reacts to its error codes, rate limiting in particular
  async function forward(url) {
    try {
      let response = await fetch(url, {
        'headers': { 'User-Agent': userAgent },
        'signal': AbortSignal.timeout(timeout)
      });

      return { status: response.status, body: await response.json() };
    } catch (e) {
      return { status: 502, body: { error: unavailable, message: `Last.fm could not be reached: ${e.name}` } };
    }
  }

  return {
    recentTracks: user => call('user.getrecenttracks', { user, 'limit': 1 }),
    artistInfo: (artist, user) => call('artist.getInfo', { artist, 'username': user }),
    trackInfo: (artist, track, user) => call('track.getInfo', { artist, track, 'username': user }),
    pending: () => inFlight.size
  };
}
