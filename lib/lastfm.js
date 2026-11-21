// Server side Last.fm calls, so the API key never reaches the browser. A key
// handed to every visitor gets copied into other projects and rate limited or
// suspended along with them, which is what happened to the original one.
//
// Track changes should reach the page as soon as Last.fm reports them, without
// every open display polling on its own. So:
//
// - A page asks for someone's recent track with the ETag of what it already
//   shows, and the server holds that request until the answer changes or about
//   50 seconds pass. App Engine standard can't keep WebSockets or streams
//   open, but it can sit on an ordinary request.
// - While anyone is waiting on a user, one loop polls Last.fm for that user and
//   answers every waiting page the moment something changes. Ten displays of
//   the same person cost the same as one.
// - Upstream calls draw from one budget across every user, which keeps the key
//   under Last.fm's rate limit however the routes get used. When it runs dry
//   the last known answer stands. The loop slows down evenly when more people
//   are watched than the budget covers at the base rate, and backs off further
//   if Last.fm starts rate limiting anyway.
// - Answers are trimmed to the few fields the page reads and sent with an ETag,
//   so nothing goes over the wire twice

import { createHash } from 'node:crypto';

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

// When Last.fm rate limits anyway, poll up to this many times slower, and ease
// back one step after this many clean polls
let maxBackoff = 8;
let recoveryPolls = 20;

export function createLastfm({ key, userAgent, timeout = 4000, rate = defaultRate,
  baseInterval = 3000, holdFor = 50000, fetch = globalThis.fetch, now = Date.now,
  setTimeout: schedule = globalThis.setTimeout, clearTimeout: unschedule = globalThis.clearTimeout }) {
  let inFlight = new Map();
  let users = new Map();
  let bucket = { tokens: rate, updated: now() };
  let backoff = 1;
  let cleanPolls = 0;

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
      return Promise.resolve({ status: 429, body: { error: rateLimited, message: 'Descent is over its Last.fm budget' }, local: true });

    let request = forward(url, trim).finally(() => inFlight.delete(url));
    inFlight.set(url, request);

    return request;
  }

  // Errors pass through with Last.fm's status and code. Successful bodies are
  // trimmed.
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

  function stateFor(user) {
    let state = users.get(user);

    if (!state) {
      state = { waiters: new Set(), polling: false };
      users.set(user, state);
    }

    state.requested = now();
    return state;
  }

  // One upstream call per user at a time. A changed answer goes straight out
  // to everyone waiting on it.
  function refresh(user, state) {
    if (state.refreshing)
      return state.refreshing;

    state.refreshing = call('user.getrecenttracks', { user, 'limit': 1 }, trimRecent).then(result => {
      if (result.status !== 200) {
        if (result.body.error === rateLimited && !result.local)
          slowDown();

        return result;
      }

      speedUp();

      let tagged = { ...result, etag: tag(result.body) };
      let changed = tagged.etag !== state.result?.etag;

      state.result = tagged;
      state.fetched = now();

      if (changed)
        release(state);

      return tagged;
    }).finally(() => {
      state.refreshing = undefined;
    });

    return state.refreshing;
  }

  // The latest answer for a user. With wait set and an ETag matching what the
  // caller already has, it resolves only once that changes, the hold runs
  // out, or the signal aborts, and then with whatever is current.
  async function recentTracks(user, { etag, wait = false, signal } = {}) {
    let state = stateFor(user);

    if (!state.result || now() - state.fetched >= interval() * pollingShare) {
      let result = await refresh(user, state);

      // An error only matters when there's nothing good to fall back on
      if (!state.result)
        return result;
    }

    if (wait && etag && etag === state.result.etag && !signal?.aborted)
      return hold(user, state, signal);

    return state.result;
  }

  function hold(user, state, signal) {
    return new Promise(resolve => {
      let timer;
      let waiter = () => {
        unschedule(timer);
        signal?.removeEventListener('abort', waiter);
        state.waiters.delete(waiter);
        resolve(state.result);
      };

      timer = schedule(waiter, holdFor);
      signal?.addEventListener('abort', waiter, { once: true });
      state.waiters.add(waiter);
      startPolling(user, state);
    });
  }

  function release(state) {
    for (let waiter of [...state.waiters])
      waiter();
  }

  // Poll a user only while someone is waiting on them
  function startPolling(user, state) {
    if (state.polling)
      return;

    state.polling = true;

    let tick = async () => {
      if (!state.waiters.size) {
        state.polling = false;
        return;
      }

      await refresh(user, state);
      schedule(tick, interval());
    };

    schedule(tick, interval());
  }

  function slowDown() {
    cleanPolls = 0;

    if (backoff < maxBackoff) {
      backoff *= 2;
      console.warn(`Last.fm rate limited, polling ${backoff}x slower`);
    }
  }

  function speedUp() {
    if (backoff === 1 || ++cleanPolls < recoveryPolls)
      return;

    cleanPolls = 0;
    backoff /= 2;
    console.info(`Last.fm recovered, polling ${backoff}x slower`);
  }

  function watched() {
    let time = now();
    let count = 0;

    for (let [user, state] of users) {
      let idle = !state.waiters.size && !state.polling;

      if (idle && time - state.requested > forgetAfter)
        users.delete(user);
      else if (time - state.requested <= watchedFor)
        count++;
    }

    return count;
  }

  // Slow everyone down evenly once there are more people being watched than
  // the budget can refresh at the base interval, and further while Last.fm is
  // rate limiting
  function interval() {
    let needed = Math.ceil(watched() * 1000 / (rate * pollingShare));

    return Math.max(baseInterval, needed) * backoff;
  }

  return {
    recentTracks,
    artistInfo: (artist, user) => call('artist.getInfo', { artist, 'username': user }, trimArtist),
    trackInfo: (artist, track, user) => call('track.getInfo', { artist, track, 'username': user }, trimTrack),
    pollInterval: interval,
    pending: () => inFlight.size,
    waiting: () => [...users.values()].reduce((sum, state) => sum + state.waiters.size, 0)
  };
}

// Weak, so Cloudflare passes it through untouched when it compresses the body
function tag(body) {
  return `W/"${createHash('sha1').update(JSON.stringify(body)).digest('base64url')}"`;
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
