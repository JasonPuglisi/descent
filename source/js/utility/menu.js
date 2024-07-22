/* global resources, Cookies */
/* global cookieEnabled, cookieExists, getBackgroundType, nowPlaying, toggleCookie, updateHue */

function initMenu() {
  // Update globals
  resources.features.hue = cookieExists('hueAccessToken') &&
    cookieExists('hueUsername') && cookieExists('hueRooms');
  if (!resources.features.hue && cookieExists('hueRefreshToken')) {
    let refreshToken = Cookies.get('hueRefreshToken');
    let url = `/app/hue/authorize?refreshToken=${refreshToken}`;
    $.get(url, () => {
      resources.features.hue = true;
      enableHue();
      updateHue();
    });
  }

  // Set function for key presses
  window.onkeydown = processKey;

  // Update Hue state
  enableHue();

  // Fade menu after initial pause
  setTimeout(() => { toggleDisplay('.help', false); }, 3600);

  // Save current user to populate index input
  Cookies.set('lastUser', $('.music .user').text(), { expires: 3650, secure: true });

  // Apply transparent background if required
  if (getBackgroundType() === 'transparent')
    $('body').css('background-color', 'transparent');
}

function processKey(event) {
  // Return if modifier key is held down
  if (event.ctrlKey || event.metaKey)
    return;

  // Get key pressed
  let key = event.keyCode;
  switch (key) {
    // Handle H to toggle help menu
    case 72: {
      toggleDisplay('.help');
      break;
    }
    // Handle E to toggle extended info
    case 69: {
      let showE = false;
      if (resources.track.current.playing) {
        toggleCookie('extendedOn');
        showE = undefined;
      }
      toggleDisplay('.userLine', showE);
      break;
    }
    // Handle L to toggle Hue lights
    case 76: {
      let on = false;
      if (resources.features.hue) {
        toggleCookie('hueEnabled');
        on = undefined;
      }
      toggleHue(on);
      break;
    }
    // Handle T to toggle date and time
    case 84: {
      toggleCookie('datetimeOn');
      toggleDisplay('.datetime');
      break;
    }
    // Handle W to toggle weather
    case 87: {
      let showW = false;
      if (resources.features.weather) {
        toggleCookie('weatherOn');
        showW = undefined;
      }
      toggleDisplay('.weather', showW);
      break;
    }
    // Handle S to show settings page
    case 83: {
      window.location.href = '/app/config';
      break;
    }
  }
}

function toggleDisplay(element, show) {
  // Call function with each element if array of elements is passed
  if (element.constructor === Array) {
    element.forEach(element => { toggleDisplay(element, show); });

    return;
  }

  // Determine whether or not to show element
  if (show === undefined)
    show = !$(element).is(':visible');

  // Show/hide element
  if (show)
    $(element).fadeIn(750, 'linear');
  else
    $(element).fadeOut(750, 'linear');
}

function enableHue() {
  if (resources.features.hue) {
    if (cookieEnabled('hueEnabled'))
      $('.hueIndicator').text('on');
    $('.hueHelp').show();
  }
}

function toggleHue(on) {
  // Determine whether or not to turn Hue on
  if (on === undefined)
    on = $('.hueIndicator').text() === 'off';

  // Turn Hue on/off
  if (on) {
    $('.hueIndicator').text('on');
    updateHue();
  } else
    $('.hueIndicator').text('off');
}
