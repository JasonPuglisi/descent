import { cookieEnabled, getCookie } from './cookies.js';
import { toggleDisplay } from './general.js';
import { updateHue } from './hue.js';
import { cacheImages, clearImages } from './images.js';
import { getJson } from './request.js';
import { resources, user } from './state.js';

// The server sends the real interval within a second or two of loading
let baseInterval = 3000;
let pollInterval = 3000;
let intervalId;

// Last.fm rate limits per API key rather than per IP, so every display sharing
// this key draws on one budget. A client that backs off when it gets throttled
// frees capacity for all the others, which is why this is worth doing at all.
let backoff = 1;
let backoffMax = 8;
let backoffRecoveryPolls = 20;
let consecutiveSuccesses = 0;

// Bumped on every track change. Image and scrobble lookups for a track that
// has since been replaced check it and drop their results, rather than
// painting the old track's art and counts over the new one.
let generation = 0;

export function initMetadata() {
  // Start state update loop
  fetchMetadata();
  applyPollInterval();

  // Start interval update loop
  updatePollInterval();
  setInterval(updatePollInterval, 60000);
}

async function updatePollInterval() {
  let data = await getJson('/app/poll/interval');

  if (!data)
    return;

  let lastfm = parseInt(data.lastfm, 10);

  if (!Number.isFinite(lastfm) || lastfm <= 0 || lastfm === baseInterval)
    return;

  console.info(`Adjusting Last.fm poll interval to ${lastfm}`);
  baseInterval = lastfm;
  applyPollInterval();
}

// Re-arm the poll timer, but only when the effective delay actually moved
function applyPollInterval() {
  let effective = baseInterval * backoff;

  if (effective === pollInterval && intervalId)
    return;

  pollInterval = effective;
  clearInterval(intervalId);
  intervalId = setInterval(fetchMetadata, pollInterval);
}

// Back off on rate limiting, then walk it back down once responses recover
function handleRateLimit() {
  consecutiveSuccesses = 0;

  if (backoff >= backoffMax)
    return;

  backoff *= 2;
  console.warn(`Last.fm rate limited, backing off to ${baseInterval * backoff}ms`);
  applyPollInterval();
}

function handlePollSuccess() {
  if (backoff === 1)
    return;

  consecutiveSuccesses++;

  if (consecutiveSuccesses < backoffRecoveryPolls)
    return;

  consecutiveSuccesses = 0;
  backoff /= 2;
  console.info(`Last.fm recovered, easing poll interval to ${baseInterval * backoff}ms`);
  applyPollInterval();
}

// Last.fm goes through the server, which holds the API key. The timeout gives
// the server's own upstream timeout room to answer first with a proper error.
let lastfmTimeout = 5000;

function getLastfm(path, params) {
  return getJson(`/app/lastfm/${path}?${new URLSearchParams(params)}`, lastfmTimeout);
}

async function fetchMetadata() {
  updateState(await getLastfm('recent', { user }));
}

async function cacheScrobbles(current) {
  let { artist, title } = resources.track.current;

  if (!artist || !title)
    return;

  let [artistInfo, trackInfo] = await Promise.all([
    getLastfm('artist', { artist, user }),
    getLastfm('track', { artist, 'track': title, user })
  ]);

  if (!current())
    return;

  let track = resources.track.current;

  if (artistInfo && !artistInfo.error)
    track.artistScrobbles = artistInfo.playcount;

  if (trackInfo && !trackInfo.error) {
    track.trackScrobbles = trackInfo.playcount;
    track.trackLoved = trackInfo.loved;
  }

  // Images haven't landed yet, so leave it to them to update the text
  if (track.albumImageLoaded && track.artistImageLoaded)
    updateMetadata();
}

function updateState(data) {
  let ignoreCurrent = getCookie('scrobbleMode') === 'lastScrobbled';

  let playing = false;
  let error = false;
  let metadata = {};

  if (!data || data.error) {
    error = true;

    // 29 is Last.fm's rate limit code
    if (data && data.error === 29)
      handleRateLimit();
  } else {
    // The server trims Last.fm's answer down to the latest track and total
    let track = data.track;

    if (track && (ignoreCurrent || track.nowPlaying)) {
      playing = true;

      metadata = {
        artist: track.artist,
        album: track.album,
        title: track.title,
        link: track.url,
        scrobbles: data.total
      };
    }
  }

  if (!error)
    handlePollSuccess();

  // A failed poll says nothing about what's playing, so keep showing the last
  // good answer. Treating it as idle is what turned rate limiting into
  // "Nothing in the air" for everyone sharing the key. The first poll still
  // falls through, so a page that never loads shows idle rather than nothing.
  if (error && resources.track.previous.playing !== undefined)
    return;

  setMetadata(playing, error, metadata);
  handleStateChange();
}

function setMetadata(playing, error, metadata) {
  Object.assign(resources.track.current, {
    playing, // True if track is *currently* playing
    error,
    artist: metadata.artist ?? '',
    album: metadata.album || '',
    title: metadata.title ?? '',
    link: metadata.link || '',
    scrobbles: metadata.scrobbles || ''
  });
}

// Detailed counts belong to a track rather than a poll, so they're only
// cleared when the track changes. Clearing them on every poll blanked them out
// whenever the artwork took longer to load than the poll interval.
function clearScrobbles() {
  Object.assign(resources.track.current, {
    artistScrobbles: '',
    trackScrobbles: '',
    trackLoved: false
  });
}

function handleStateChange() {
  let current = resources.track.current;
  let previous = resources.track.previous;

  let changedTrack = current.playing && (!previous.playing ||
    current.artist !== previous.artist || current.title !== previous.title);

  if (changedTrack) {
    // Fetch images and detailed scrobbles, which then update colors, lights,
    // images and text
    let token = ++generation;
    let isCurrent = () => token === generation;

    clearScrobbles();
    cacheImages(isCurrent);
    cacheScrobbles(isCurrent);
  } else if (!current.playing) {
    if (previous.playing === undefined) {
      // Unloaded to idle
      showIdle();
    } else if (previous.playing) {
      // Playing to idle, which waits out a short timeout in case the next
      // track is about to start
      startIdleTimeout();
    } else if (checkIdleTimeout()) {
      showIdle();
    }
  }

  resources.track.previous = {
    playing: current.playing,
    artist: current.artist,
    title: current.title
  };
}

function showIdle() {
  // Anything still loading for the last track is no longer wanted
  generation++;

  clearScrobbles();
  clearColors();
  updateHue();
  clearImages();
  updateMetadata();
}

function startIdleTimeout() {
  resources.track.current.idleTimeout = Date.now() + 10 * 1000;
}

function checkIdleTimeout() {
  return resources.track.current.idleTimeout && Date.now() > resources.track.current.idleTimeout;
}

export function clearColors() {
  resources.colors.hex = ['#f6f5f7', '#f6f5f7'];
  resources.colors.hue = [{ x: 0.3127, y: 0.3290 }];

  updateTextColors();
}

export function updateTextColors() {
  document.querySelector('.music .title').style.color = resources.colors.hex[0];
  document.querySelector('.music .artist').style.color = resources.colors.hex[1];
}

export function updateMetadata() {
  let track = resources.track.current;
  delete track.idleTimeout;

  let { playing, artist, title, link, scrobbles, artistScrobbles, trackScrobbles, trackLoved } = track;

  document.querySelector('.music .artist').textContent = artist || 'Nothing in the air...';
  document.querySelector('.music .title').textContent = title;
  document.querySelector('.music .songLink').setAttribute('href', link);

  document.querySelector('.scrobbles .scrobbleCount').textContent = scrobbles || '';
  document.querySelector('.detailedScrobbles .artistScrobbleCount').textContent = artistScrobbles || '';
  document.querySelector('.detailedScrobbles .trackScrobbleCount').textContent = trackScrobbles || '';
  toggleDisplay('.scrobbles', scrobbles);
  toggleDisplay('.detailedScrobbles', artistScrobbles && trackScrobbles);
  toggleDisplay('.detailedScrobbles .loved', trackLoved);

  // Update document title and show/hide extended info as necessary
  if (playing) {
    document.title = `"${title}" by ${artist}`;

    if (cookieEnabled('extendedOn'))
      toggleDisplay('.userLine', true);
  } else {
    document.title = 'Descent';
    toggleDisplay('.userLine', false);
  }
}
