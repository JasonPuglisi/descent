import { cookieEnabled, getCookie } from './cookies.js';
import { toggleDisplay } from './general.js';
import { updateHue } from './hue.js';
import { clearImages, loadImages, showImages } from './images.js';
import { getJson } from './request.js';
import { pageVersion, resources, user } from './state.js';

// Bumped whenever new details start loading. Images still loading for a track
// that has since been replaced check it and drop their results, rather than
// painting the old track's art and counts over the new one.
let generation = 0;

export function initMetadata() {
  watchRecentTracks();

  checkVersion();
  setInterval(checkVersion, 60000);
}

// Ask for the latest track and wait. The server holds the request until the
// answer changes or about 50 seconds pass, so a new track shows up as soon as
// the server sees it, with no polling timer here. The ETag of what's showing
// goes along so the server knows what counts as a change, and an unchanged
// answer comes back as an empty 304.
//
// The page keeps that ETag itself. It used to leave it to the browser's cache
// to add, but a browser that isn't caching, like Safari with the Web
// Inspector's caches turned off, sent none, got an immediate answer every
// time, and asked again in a tight loop until Cloudflare rate limited it.
let holdTimeout = 65000;

// After a failure, wait before asking again, doubling up to a minute
let retryDelay = 0;
let retryMin = 3000;
let retryMax = 60000;

// An unchanged answer should only come back after a full hold. One that comes
// back quickly means the server isn't holding for some reason, so slow down
// rather than spin.
let quickAnswer = 1000;
let quickDelay = 0;

let etag;
let lastAnswer;

async function watchRecentTracks() {
  for (;;) {
    let started = Date.now();
    let { data, unchanged } = await getRecentTracks();
    let failed = !data || data.error;

    updateState(data);

    if (failed) {
      retryDelay = Math.min(retryMax, Math.max(retryMin, retryDelay * 2));
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      continue;
    }

    retryDelay = 0;

    if (unchanged && Date.now() - started < quickAnswer) {
      quickDelay = Math.min(retryMax, Math.max(retryMin, quickDelay * 2));
      await new Promise(resolve => setTimeout(resolve, quickDelay));
    } else {
      quickDelay = 0;
    }
  }
}

async function getRecentTracks() {
  let controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), holdTimeout);
  let url = `/app/lastfm/recent?${new URLSearchParams({ user, 'wait': 1 })}`;

  try {
    // no-store keeps the browser's cache out of it, so the If-None-Match
    // here is the only one sent and a 304 comes through as a 304
    let response = await fetch(url, {
      'headers': etag ? { 'If-None-Match': etag } : {},
      'cache': 'no-store',
      'signal': controller.signal
    });

    if (response.status === 304)
      return { data: lastAnswer, unchanged: true };

    let data = await response.json();

    if (response.ok) {
      let previous = etag;
      etag = response.headers.get('ETag') || undefined;
      lastAnswer = data;

      return { data, unchanged: Boolean(etag) && etag === previous };
    }

    return { data };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

// Kiosks leave this page open for weeks, so without this they'd keep running
// whatever code they loaded with, including how they talk to the server. When
// a deploy changes the version, reload to pick it up. The delay is random so
// every open display doesn't come back in the same second.
let reloadScheduled = false;
let reloadSpread = 30000;

async function checkVersion() {
  let data = await getJson('/app/poll/interval');
  let version = data && data.version;

  if (!version || !pageVersion || version === pageVersion || reloadScheduled)
    return;

  reloadScheduled = true;
  console.info(`Descent ${version} is out, reloading from ${pageVersion}`);
  setTimeout(() => window.location.reload(), Math.random() * reloadSpread);
}

function updateState(data) {
  let ignoreCurrent = getCookie('scrobbleMode') === 'lastScrobbled';

  let playing = false;
  let error = false;
  let metadata = {};

  if (!data || data.error) {
    error = true;
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
        scrobbles: data.total,
        details: data.details
      };
    }
  }

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
    scrobbles: metadata.scrobbles || '',
    // The server looks up art and play counts when the track changes and sends
    // them along with it. Null means they're still coming.
    details: metadata.details || null
  });
}

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
    showDetails(current.details);
  } else if (current.playing && JSON.stringify(current.details) !== current.detailsShown) {
    // Details that took the server a while arrive in an answer of their own
    showDetails(current.details);
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

// Images are loaded before anything changes, so the new track's title, art
// and colors all appear together
async function showDetails(details) {
  let token = ++generation;
  let isCurrent = () => token === generation;
  let track = resources.track.current;

  track.detailsShown = JSON.stringify(details);

  if (!details) {
    clearScrobbles();
    clearImages();
    clearColors();
    updateHue();
    updateMetadata();
    return;
  }

  let images = await loadImages(details);

  if (!isCurrent())
    return;

  Object.assign(track, images, {
    artistScrobbles: details.artistScrobbles,
    trackScrobbles: details.trackScrobbles,
    trackLoved: details.loved
  });

  showImages(isCurrent);
  updateMetadata();
}

function showIdle() {
  // Anything still loading for the last track is no longer wanted
  generation++;
  delete resources.track.current.detailsShown;

  clearScrobbles();
  clearColors();
  updateHue();
  clearImages();
  updateMetadata();
}

// Answers only arrive when something changes now, so the switch to idle can't
// wait for the next one to notice the timeout passed
let idleDelay = 10 * 1000;

function startIdleTimeout() {
  resources.track.current.idleTimeout = Date.now() + idleDelay;

  setTimeout(() => {
    if (!resources.track.current.playing && checkIdleTimeout())
      showIdle();
  }, idleDelay + 100);
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
