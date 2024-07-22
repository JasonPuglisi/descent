/* global resources */
/* global cacheImages, checkLoadStatus, clearColors, clearImages, cookieEnabled, toggleDisplay, updateHue */

let user = $('.music .user').text();
let key = 'c1797de6bf0b7e401b623118120cd9e1';
let interval = 10000;
let intervalId;

function initMetadata() {
  // Start state update loop
  refreshState();
  intervalId = setInterval(refreshState, interval);

  // Start interval update loop
  updatePollInterval();
  setInterval(updatePollInterval, 60000);
}

function updatePollInterval() {
  $.ajax({
    url: '/app/poll/interval',
    timeout: 2000,
    success: data => {
      let lastfm = data.lastfm;
      if (interval !== lastfm) {
        interval = lastfm;
        console.info(`Adjusting Last.fm poll interval to ${interval}`);
        clearInterval(intervalId);
        intervalId = setInterval(refreshState, interval);
      }
    }
  });
}

function refreshState() {
  // Query Last.fm for recent track information
  fetchMetadata();
}

function fetchMetadata() {
  // Query Last.fm for recent track information
  let urlUser = encodeURIComponent(user);
  let url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${urlUser}&api_key=${key}&limit=1&format=json`;
  $.ajax({
    url: url,
    timeout: 2000,
    success: data => {
      // Handle successful response
      updateState(data);
    },
    error: () => {
      // Handle errored response
      updateState();
    }
  });
}

function cacheScrobbles() {
  let artist = resources.track.current.artist;
  let title = resources.track.current.title;
  let urlUser = encodeURIComponent(user);
  let urlArtist = encodeURIComponent(artist);
  let urlTitle = encodeURIComponent(title);

  if (artist && title) {
    // Get scrobble count for current artist
    let url = `https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=${urlArtist}&username=${urlUser}&api_key=${key}&limit=1&format=json`;
    $.ajax({
      url: url,
      timeout: 2000,
      success: data => {
        // Handle successful response
        resources.track.current.artistScrobbles = data.artist.stats.userplaycount;
        checkLoadStatus();
      }
    });

    // Get scrobble count for current track
    url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${urlArtist}&track=${urlTitle}&username=${urlUser}&api_key=${key}&limit=1&format=json`;
    $.ajax({
      url: url,
      timeout: 2000,
      success: data => {
        // Handle successful response
        resources.track.current.trackScrobbles = data.track.userplaycount;
        checkLoadStatus();
      }
    });
  }
}

function updateState(data) {
  let scrobbleMode = cookieExists('scrobbleMode') ? Cookies.get('scrobbleMode') : false;
  let ignoreCurrent = (scrobbleMode === 'lastScrobbled');

  // Update current state
  let playing = false;
  let error = false;
  let metadata = {};
  if (!data || data.error) {
    // Invalid or error response
    error = true;
  } else if (!data.recenttracks || !data.recenttracks.track || !data.recenttracks.track[0]) {
    // Valid response but missing recent track data
  } else {
    // Valid response with recent track data
    let track = data.recenttracks.track[0];

    if (!ignoreCurrent && (!track['@attr'] || !track['@attr'].nowplaying)) {
      // No currently playing track
    } else {
      // Currently playing track present
      playing = true;

      // Set track metadata
      metadata = {
        artist: track.artist['#text'],
        artistId: track.artist.mbid,
        title: track.name,
        link: track.url,
        cover: track.image[track.image.length - 1]['#text'],
        scrobbles: data.recenttracks['@attr'].total
      };
    }
  }

  // Update global state and metadata
  setMetadata(playing, error, metadata);

  // Determine if state changed and take appropriate action
  handleStateChange();
}

function setMetadata(playing, error, metadata) {
  // Set global state
  resources.track.current.playing = playing; // True if track is *currently* playing
  resources.track.current.error = error;

  // Set global track metadata
  resources.track.current.artist = metadata.artist !== undefined ? metadata.artist : '';
  resources.track.current.artistId = metadata.artistId ? metadata.artistId : '';
  resources.track.current.title = metadata.title !== undefined ? metadata.title : '';
  resources.track.current.link = metadata.link ? metadata.link : '';
  resources.track.current.cover = metadata.cover ? metadata.cover : '';
  resources.track.current.scrobbles = metadata.scrobbles ? metadata.scrobbles : '';
  resources.track.current.artistScrobbles = '';
  resources.track.current.trackScrobbles = '';
}

function handleStateChange() {
  // Get current and previous state
  current = resources.track.current;
  previous = resources.track.previous;

  if (previous.playing === undefined) {
    if (!current.playing) {
      // State changed from unloaded to idle (clear colors, lights, text)
      clearColors();
      updateHue();
      clearImages();
      updateMetadata();
    } else {
      // State changed from unloaded to playing (fetch images; fetch detailed scrobbles; update colors, lights, images, text)
      cacheImages();
      cacheScrobbles();
    }
  } else if (!previous.playing) {
    if (current.playing) {
      // State changed from idle to playing (fetch images; fetch detailed scrobbles; update colors, lights, images, text)
      cacheImages();
      cacheScrobbles();
    } else {
      // State unchanged from idle (check idle timeout)
      if (checkIdleTimeout()) {
        clearColors();
        updateHue();
        clearImages();
        updateMetadata();
      }
    }
  } else {
    if (current.playing) {
      if (current.artist !== previous.artist || current.title !== previous.title) {
        // State changed from playing to playing new song (fetch images; fetch detailed scrobbles; update colors, lights, images, text)
        cacheImages();
        cacheScrobbles();
      }
    } else {
      // State changed from playing to idle (start idle timeout)
      startIdleTimeout();
    }
  }

  // Set previous state to current
  resources.track.previous = {
    playing: current.playing,
    artist: current.artist,
    title: current.title
  };
}

function startIdleTimeout() {
  // Start new idle timeout of 10 seconds
  resources.track.current.idleTimeout = Date.now() + 10 * 1000;
}

function checkIdleTimeout() {
  // Check if timeout has been met before changing to idle state
  return resources.track.current.idleTimeout && Date.now() > resources.track.current.idleTimeout;
}

function clearColors() {
  // Set default colors
  hexColors = [ '#f6f5f7', '#f6f5f7' ];
  hueColors = [ { x: (1 / 3), y: (1 / 3) } ];

  resources.colors.hex = hexColors;
  resources.colors.hue = hueColors;

  // Update text
  updateTextColors();
}

function updateTextColors() {
  // Update text based on current colors
  $('.music .title').css('color', resources.colors.hex[0]);
  $('.music .artist').css('color', resources.colors.hex[1]);
}

function updateMetadata() {
  // Clear idle timeout
  delete resources.track.current.idleTimeout;

  // Get current track metadata
  let playing = resources.track.current.playing;
  let artist = resources.track.current.artist;
  let title = resources.track.current.title;
  let link = resources.track.current.link;
  let scrobbles = resources.track.current.scrobbles;
  let artistScrobbles = resources.track.current.artistScrobbles;
  let trackScrobbles = resources.track.current.trackScrobbles;

  // Update track metadata text
  $('.music .artist').text(artist || 'Nothing in the air...');
  $('.music .title').text(title);
  $('.music .songLink').attr('href', link);

  // Update scrobbles
  $('.scrobbles .scrobbleCount').text(scrobbles ? scrobbles : '');
  $('.detailedScrobbles .artistScrobbleCount').text(artistScrobbles ? artistScrobbles : '');
  $('.detailedScrobbles .trackScrobbleCount').text(trackScrobbles ? trackScrobbles : '');
  toggleDisplay('.scrobbles', scrobbles);
  toggleDisplay('.detailedScrobbles', artistScrobbles && trackScrobbles);

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
