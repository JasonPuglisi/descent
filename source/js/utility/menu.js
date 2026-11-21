import { cookieEnabled, cookieExists, setCookie, toggleCookie } from './cookies.js';
import { show, toggleDisplay } from './general.js';
import { refreshHueToken, updateHue } from './hue.js';
import { getBackgroundType } from './images.js';
import { resources, user } from './state.js';

export async function initMenu() {
  window.addEventListener('keydown', processKey);

  // The help menu links stand in for their keys
  for (let link of document.querySelectorAll('[data-key]')) {
    link.addEventListener('click', event => {
      event.preventDefault();
      handleKey(link.dataset.key);
    });
  }

  // Fade menu after initial pause
  setTimeout(() => { toggleDisplay('.help', false); }, 3600);

  // Save current user to populate index input
  setCookie('lastUser', user);

  // Apply transparent background if required
  if (getBackgroundType() === 'transparent')
    document.body.style.backgroundColor = 'transparent';

  resources.features.hue = hueConfigured();
  enableHue();

  // The access token cookie expires well before the refresh token, so get a
  // new one if that's all that's missing
  if (!resources.features.hue && cookieExists('hueRefreshToken') && await refreshHueToken()) {
    resources.features.hue = hueConfigured();
    enableHue();
    updateHue();
  }
}

function hueConfigured() {
  return cookieExists('hueAccessToken') && cookieExists('hueUsername') && cookieExists('hueRooms');
}

function processKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey)
    return;

  handleKey(event.key.toLowerCase());
}

function handleKey(key) {
  switch (key) {
    // Toggle help menu
    case 'h': {
      toggleDisplay('.help');
      break;
    }
    // Toggle extended info
    case 'e': {
      let showE = false;
      if (resources.track.current.playing) {
        toggleCookie('extendedOn');
        showE = undefined;
      }
      toggleDisplay('.userLine', showE);
      break;
    }
    // Toggle Hue lights
    case 'l': {
      let on = false;
      if (resources.features.hue) {
        toggleCookie('hueEnabled');
        on = undefined;
      }
      toggleHue(on);
      break;
    }
    // Toggle date and time
    case 't': {
      toggleCookie('datetimeOn');
      toggleDisplay('.datetime');
      break;
    }
    // Toggle weather
    case 'w': {
      // Weather is on until turned off, unlike the other toggles, so flipping
      // the cookie blindly saved "on" the first time it was hidden
      let showW = false;
      if (resources.features.weather) {
        showW = !(!cookieExists('weatherOn') || cookieEnabled('weatherOn'));
        setCookie('weatherOn', showW);
      }
      toggleDisplay('.weather', showW);
      break;
    }
    // Show settings page
    case 's': {
      window.location.href = '/app/config';
      break;
    }
  }
}

function enableHue() {
  if (!resources.features.hue)
    return;

  if (cookieEnabled('hueEnabled'))
    document.querySelector('.hueIndicator').textContent = 'on';

  show('.hueHelp');
}

function toggleHue(on) {
  let indicator = document.querySelector('.hueIndicator');

  if (on === undefined)
    on = indicator.textContent === 'off';

  indicator.textContent = on ? 'on' : 'off';

  if (on)
    updateHue();
}
