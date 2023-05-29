/* global resources, Cookies, */

function initCursor() {
  // Show cursor on any mouse activity
  $('body').on('ready click contextmenu mousemove', showCursor);

  // Start timeout check loop
  checkCursor();
  setInterval(checkCursor, 1000);
}

function checkCursor() {
  // Decrement timeout or hide cursor
  if (resources.cursorTimeout > 0)
    resources.cursorTimeout--;
  else
    hideCursor();
}

function showCursor() {
  // Reset timeout
  resources.cursorTimeout = 3;

  // Show cursor
  $('body').css('cursor', 'auto');
}

function hideCursor() {
  // Hide cursor
  $('body').css('cursor', 'none');
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
    Cookies.set(name, 'false', { expires: 3650, secure: true });
  } else {
    Cookies.set(name, 'true', { expires: 3650, secure: true });
  }
}
