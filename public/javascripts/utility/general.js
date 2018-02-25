function initCursor() {
  // Show cursor on any mouse activity
  $('body').on('ready click contextmenu mousemove', showCursor);

  // Start timeout check loop
  checkCursor();
  setInterval(checkCursor, 1000);
}

function checkCursor() {
  // Decrement timeout or hide cursor
  if (resources.state.cursorTimeout > 0)
    resources.state.cursorTimeout--;
  else
    hideCursor();
}

function showCursor() {
  // Reset timeout
  resources.state.cursorTimeout = 3;

  // Show cursor
  $('body').css('cursor', 'auto');
}

function hideCursor() {
  // Hide cursor
  $('body').css('cursor', 'none');
}

function nowPlaying() {
  // Determine whether or not there is music currently playing
  return resources.track.current.artist !== '';
}

function newTrack() {
  // Determine whether or not the track has changed since last function call
  if (resources.track.current.artist === resources.track.previous.artist &&
      resources.track.current.title === resources.track.previous.title)
    return false;

  // Update previous track information
  resources.track.previous.artist = resources.track.current.artist;
  resources.track.previous.title = resources.track.current.title;

  return true;
}

function hasCover() {
  // Determine whether or not cover image is present
  return resources.images.cover !== '';
}

function cookieExists(name) {
  // Determine whether or not a cookie exists
  return Cookies.get(name) !== undefined;
}

function cookieEnabled(name) {
  // Determine whether or not a cookie is enabled
  return Cookies.get(name) === 'true';
}

function toggleCookie(name) {
  // Enable/disable a cookie
  if (cookieEnabled(name)) {
    Cookies.set(name, 'false', { expires: 3650 });
  } else {
    Cookies.set(name, 'true', { expires: 3650 });
  }
}
