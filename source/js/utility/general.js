/* global resources, Cookies, */

let wakeLock;

// Kiosks running this full screen shouldn't let the display sleep. The browser
// drops the lock whenever the page is hidden and never restores it on its own,
// so it has to be taken again on the way back rather than just once at startup.
function initWakeLock() {
  if (!('wakeLock' in navigator))
    return;

  requestWakeLock();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
      requestWakeLock();
  });
}

async function requestWakeLock() {
  if (wakeLock || document.visibilityState !== 'visible')
    return;

  try {
    wakeLock = await navigator.wakeLock.request('screen');

    // The system can drop the lock on its own, usually on low battery
    wakeLock.addEventListener('release', () => {
      wakeLock = undefined;
    });
  } catch (e) {
    console.warn(`Error requesting wake lock: ${e.name}, ${e.message}`);
  }
}

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
