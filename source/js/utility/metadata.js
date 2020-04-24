/* global resources */
/* global cacheImages, checkLoadStatus, clearColors, clearImages, cookieEnabled, toggleDisplay, updateHue */

function initMetadata() {
  // Start state update loop
  refreshState();
  setInterval(refreshState, 3000);
}

function refreshState() {
  // Query Last.fm for recent track information
  fetchMetadata();
}

function fetchMetadata() {
  // Query Last.fm for recent track information
  let user = $('.music .user').text();
  let key = 'c1797de6bf0b7e401b623118120cd9e1';
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

function updateState(data) {
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
    if (!track['@attr'] || !track['@attr'].nowplaying) {
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
  resources.track.current.playing = playing;
  resources.track.current.error = error;

  // Set global track metadata
  resources.track.current.artist = metadata.artist !== undefined ? metadata.artist : '';
  resources.track.current.artistId = metadata.artistId ? metadata.artistId : '';
  resources.track.current.title = metadata.title !== undefined ? metadata.title : '';
  resources.track.current.link = metadata.link ? metadata.link : '';
  resources.track.current.cover = metadata.cover ? metadata.cover : '';
  resources.track.current.scrobbles = metadata.scrobbles ? metadata.scrobbles : '';
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
      // State changed from unloaded to playing (fetch images; update colors, lights, images, text)
      cacheImages();
    }
  } else if (!previous.playing) {
    if (current.playing) {
      // State changed from idle to playing (fetch images; update colors, lights, images, text)
      cacheImages();
    }
  } else {
    if (current.playing) {
      if (current.artist !== previous.artist || current.title !== previous.title) {
        // State changed from playing to playing new song (fetch images; update colors, lights, images, text)
        cacheImages();
      }
    } else {
      // State changed from playing to idle (wait; clear colors, lights, images, text)
      clearColors();
      updateHue();
      clearImages();
      updateMetadata();
    }
  }

  // Set previous state to current
  resources.track.previous = {
    playing: current.playing,
    artist: current.artist,
    title: current.title
  };
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
  // Get current track metadata
  let playing = resources.track.current.playing;
  let artist = resources.track.current.artist;
  let title = resources.track.current.title;
  let link = resources.track.current.link;
  let scrobbles = resources.track.current.scrobbles;

  // Update track metadata text
  $('.music .artist').text(artist || 'Nothing in the air...');
  $('.music .title').text(title);
  $('.music .songLink').attr('href', link);

  // Update scrobbles
  $('.scrobbles .scrobbleCount').text(scrobbles ? scrobbles : '');
  toggleDisplay('.scrobbles', scrobbles);

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
