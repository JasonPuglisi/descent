// Server side Last.fm calls, so the API key never reaches the browser. A key
// handed to every visitor gets copied into other projects and rate limited or
// suspended along with them, which is what happened to the original one.
//
// Track changes should show up within one poll, so nothing is cached for long.
// What keeps this cheap instead:
//
// - Responses are trimmed to the few fields the page reads, a couple hundred
//   bytes instead of 1-16 KB, and the routes send them with an ETag so a poll
//   that finds nothing new gets an empty 304
// - Each user's latest answer is shared for just under one poll interval, so
//   several displays of the same person cost one upstream call between them
// - Upstream calls draw from one budget across every user, which keeps the key
//   under Last.fm's rate limit however the routes get used. When it runs dry a
//   poll gets the last known answer rather than a fresh one.
// - The poll interval handed to browsers grows when there are more people
//   being watched than the budget can refresh at the base rate

let endpoint = 'https://ws.audioscrobbler.com/2.0/';

// Last.fm's own codes, so the browser handles these like any other error.
// 16 is a temporary failure and 29 is rate limiting.
let unavailable = 16;
let rateLimited = 29;

// Last.fm doesn't publish a limit anymore. Its old terms allowed 5 requests a
// second, so stay a little under that.
let defaultRate = 4;

// Share of the budget that steady polling may use, leaving the rest for the
// play count lookups that follow each track change
let pollingShare = 0.8;

// People nobody has asked about in this long stop counting as watched, and
// their state is dropped
let watchedFor = 60 * 1000;
let forgetAfter = 10 * 60 * 1000;

export function createLastfm({ key, userAgent, timeout = 4000, rate = defaultRate,
  baseInterval = 3000, fetch = globalThis.fetch, now = Date.now }) {
  let inFlight = new Map();
  let users = new Map();
  let bucket = { tokens: rate, updated: now() };

  // Token bucket holding up to one second of requests, so short bursts like
  // a track change's lookups go through but the average stays at the rate
  function takeToken() {
    let time = now();
    bucket.tokens = Math.min(rate, bucket.tokens + (time - bucket.updated) / 1000 * rate);
    bucket.updated = time;

    if (bucket.tokens < 1)
      return false;

    bucket.tokens--;
    return true;
  }

  function call(method, params, trim) {
    if (!key)
      return Promise.resolve({ status: 503, body: { error: 10, message: 'No Last.fm API key is configured' } });

    let query = new URLSearchParams({ method, ...params, 'api_key': key, 'format': 'json' });
    let url = `${endpoint}?${query}`;

    if (inFlight.has(url))
      return inFlight.get(url);

    if (!takeToken())
      return Promise.resolve({ status: 429, body: { error: rateLimited, message: 'Descent is over its Last.fm budget' } });

    let request = forward(url, trim).finally(() => inFlight.delete(url));
    inFlight.set(url, request);

    return request;
  }

  // Errors pass through with Last.fm's status and code, since the browser
  // backs off on rate limiting. Successful bodies are trimmed.
  async function forward(url, trim) {
    let status;
    let body;

    try {
      let response = await fetch(url, {
        'headers': { 'User-Agent': userAgent },
        'signal': AbortSignal.timeout(timeout)
      });

      status = response.status;
      body = await response.json();
    } catch (e) {
      return { status: 502, body: { error: unavailable, message: `Last.fm could not be reached: ${e.name}` } };
    }

    if (body.error)
      return { status: status >= 400 ? status : 502, body: { error: body.error, message: body.message } };

    try {
      return { status: 200, body: trim(body) };
    } catch {
      return { status: 502, body: { error: unavailable, message: 'Last.fm sent an unexpected response' } };
    }
  }

  function freshness() {
    return pollInterval() * pollingShare;
  }

  async function recentTracks(user) {
    let time = now();
    let state = users.get(user) || {};
    state.requested = time;
    users.set(user, state);

    if (state.result && time - state.fetched < freshness())
      return state.result;

    let result = await call('user.getrecenttracks', { user, 'limit': 1 }, trimRecent);

    // Over budget, a slightly old answer beats none, and keeps the display
    // from treating it as a failed poll
    if (result.body.error === rateLimited && result.status === 429 && state.result)
      return state.result;

    if (result.status === 200) {
      state.result = result;
      state.fetched = now();
    }

    return result;
  }

  function watched() {
    let time = now();
    let count = 0;

    for (let [user, state] of users) {
      if (time - state.requested > forgetAfter)
        users.delete(user);
      else if (time - state.requested <= watchedFor)
        count++;
    }

    return count;
  }

  // Slow everyone down evenly once there are more people being watched than
  // the budget can refresh at the base interval
  function pollInterval() {
    let needed = Math.ceil(watched() * 1000 / (rate * pollingShare));

    return Math.max(baseInterval, needed);
  }

  return {
    recentTracks,
    artistInfo: (artist, user) => call('artist.getInfo', { artist, 'username': user }, trimArtist),
    trackInfo: (artist, track, user) => call('track.getInfo', { artist, track, 'username': user }, trimTrack),
    pollInterval,
    pending: () => inFlight.size
  };
}

// Only what the page reads. Last.fm returns the now playing track first and
// the last scrobble after it, as an object rather than an array when there's
// only one.
export function trimRecent(body) {
  let tracks = [].concat(body.recenttracks.track || []);
  let track = tracks[0];

  return {
    track: track ? {
      artist: track.artist['#text'],
      album: track.album ? track.album['#text'] : '',
      title: track.name,
      url: track.url,
      nowPlaying: track['@attr']?.nowplaying === 'true'
    } : null,
    total: body.recenttracks['@attr']?.total || ''
  };
}

export function trimArtist(body) {
  return { playcount: body.artist.stats?.userplaycount ?? '' };
}

export function trimTrack(body) {
  return { playcount: body.track.userplaycount ?? '', loved: body.track.userloved === '1' };
}
