/* Initialization functions */

$(function() {
  // Set globals
  window.resources = {
    credentials: {
      lastfm: {
        user: $('#music #user').text(),
        key: 'c1797de6bf0b7e401b623118120cd9e1'
      }
    },
    images: {
      blank: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///' +
        'yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      cover: '',
      artist: ''
    },
    urls: {
      lastfm: {
        recent: 'https://ws.audioscrobbler.com/2.0/?method=user.' +
          'getrecenttracks&user=%USER%&api_key=%KEY%&limit=1&format=json',
        cover: '/now/app/cover?url=',
        artist: 'https://ws.audioscrobbler.com/2.0/?method=artist.getinfo' +
          '&mbid=%MBID%&api_key=%KEY%&format=json'
      },
      spotify: {
        query: 'https://api.spotify.com/v1/search?q=%QUERY%&type=track&limit=1'
      },
      hue: {
        rooms: 'http://%IP%/api/%USERNAME%/groups',
        set: 'http://%IP%/api/%USERNAME%/lights/%ID%/state'
      },
      forecast: {
        query: '/now/app/weather'
      }
    },
    state: {
      cursorTimeout: 3,
      fadeTime: 750,
      features: {
        weather: false,
        hue: false,
      },
      cover: new Image(),
      background: cookieExists('background') ? Cookies.get('background') :
        'album'
    },
    track: {
      current: {
        artist: '',
        artistId: '',
        title: '',
        link: '',
        cover: ''
      },
      previous: {
        artist: '',
        title: ''
      }
    },
    colors: {
      regular: [],
      hue: [],
      hex: []
    }
  };

  // Initialize features
  init();
});

function init() {
  // Initialize features
  initCursor();
  initMenu();
  initMetadata();
  initWeather();
  initDatetime();
}

/* Cursor functions */

function initCursor() {
  // Show cursor on any mouse activity
  $('body').on('ready click contextmenu mousemove', showCursor);

  // Start timeout check loop
  checkCursor();
}

function checkCursor() {
  // Decrement timeout or hide cursor
  if (resources.state.cursorTimeout > 0) {
    resources.state.cursorTimeout--;
  } else {
    hideCursor();
  }

  // Restart timeout check loop
  setTimeout(checkCursor, 1000);
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

/* Menu functions */

function initMenu() {
  // Update globals
  resources.state.features.hue = cookieExists('hueIp') &&
    cookieExists('hueUsername') && cookieExists('hueRooms');

  // Set function for key presses
  window.onkeydown = processKey;

  // Update Hue state
  if (resources.state.features.hue) {
    if (cookieEnabled('hueEnabled')) {
      $('#hueIndicator').text('on');
    }
    $('#hueHelp').show();
  }

  // Fade menu after initial pause
  setTimeout(function() {
    toggleDisplay('#help', false);
  }, 3600);

  // Save current user to populate index input
  Cookies.set('lastUser', resources.credentials.lastfm.user, { expires:
    3650 });
}

function processKey(event) {
  // Return if modifier key is held down
  if (event.ctrlKey || event.metaKey)
    return;

  // Get key pressed
  var key = event.keyCode;

  switch (key) {
    // Handle H to toggle menu/help
    case 72:
      toggleDisplay('#help');
      break;
    // Handle E to toggle extended info
    case 69:
      var showE = false;
      if (nowPlaying()) {
        toggleCookie('extendedOn');
        showE = undefined;
      }
      toggleDisplay('#userLine', showE);
      break;
    // Handle F to toggle weather/forecast
    case 70:
      var showF = false;
      if (resources.state.features.weather) {
        toggleCookie('weatherOn');
        showF = undefined;
      }
      toggleDisplay('#weather', showF);
      break;
    // Handle L to toggle Hue/lights
    case 76:
      var on = false;
      if (resources.state.features.hue) {
        toggleCookie('hueEnabled');
        on = undefined;
      }
      toggleHue(on);
      break;
    // Handle T to toggle date and time
    case 84:
      toggleCookie('datetimeEnabled');
      toggleDisplay('#datetime');
      break;
  }
}

function toggleDisplay(element, show) {
  // Call function with each element if array of elements is passed
  if (element.constructor === Array) {
    for (var i in element) {
      toggleDisplay(element[i], show);
    }

    return;
  }

  // Determine whether or not to show element
  if (show === undefined) {
    show = !$(element).is(':visible');
  }

  // Show/hide element
  if (show) {
    $(element).fadeIn(resources.state.fadeTime, 'linear');
  } else {
    $(element).fadeOut(resources.state.fadeTime, 'linear');
  }
}

function toggleHue(on) {
  // Determine whether or not to turn Hue on
  if (on === undefined) {
    on = $('#hueIndicator').text() === 'off';
  }

  // Turn Hue on/off
  if (on) {
    $('#hueIndicator').text('on');
    updateHue();
  } else {
    $('#hueIndicator').text('off');
  }
}

/* Cover and artist functions */

function fetchImages() {
  if (nowPlaying()) {
    // If music is playing, check if track has changed
    if (newTrack()) {
      // If track has changed, check for cover from Last.fm
      if (resources.track.current.cover) {
        // Set cover from Last.fm
        setCover(resources.urls.lastfm.cover + resources.track.current.cover);
      } else {
        // Set cover from Spotify
        var query = resources.track.current.artist + ' - ' +
          resources.track.current.title;
        var url = insertVars(resources.urls.spotify.query, { QUERY: query });
        $.get(url, function(data) {
          // Set cover image if one is found
          if (data.tracks.total > 0) {
            setCover(data.tracks.items[0].album.images[0].url);
          } else {
            resetCover();
          }
        }).fail(resetCover);
      }

      // If track has changed, and background is artist, get artist image from
      // Last.fm
      if (resources.state.background == 'artist') {
        // Query Last.fm for artist information
        var url2 = insertVars(resources.urls.lastfm.artist, { MBID:
          resources.track.current.artistId, KEY:
          resources.credentials.lastfm.key });
        $.get(url2, function(data) {
          if (data.artist) {
            // Update background image
            $('#background').css('background-image', 'url(' +
            data.artist.image[data.artist.image.length - 1]['#text'] + ')');
          } else {
            resetBackground();
          }
        }).fail(resetBackground);
      }
    }
  } else {
    resetCover();
    resetBackground();
  }
}

function setCover(cover) {
  // Set cover image
  $('#music #cover')[0].crossOrigin = 'Anonymous';
  resources.images.cover = cover;
  updateCover();
}

function resetCover() {
  // Clear/reset cover image
  $('#music #cover')[0].crossOrigin = null;
  resources.images.cover = '';
  updateCover();
}

function updateCover() {
  // Determine cover image url
  var url = resources.images.cover || resources.images.blank;

  // Load image before setting it in visible places
  resources.state.cover.onload = function() {
    // Apply cover image to background if required
    if (resources.state.background == 'album') {
      $('#background').css('background-image', 'url(' + url + ')');
    }

    // Apply cover image to preview if it exists
    if (hasCover()) {
      $('#music #cover').show();
    } else {
      $('#music #cover').hide();
    }
    $('#music #cover').attr('src', url);
  };
  resources.state.cover.src = url;
}

function resetBackground() {
  $('#background').css('background-image', 'url(' + resources.images.blank +
    ')');
}

/* Color functions */

function fetchColors() {
  if (hasCover()) {
    // If cover image is present, get colors from Color Thief
    var colorThief = new ColorThief();
    var colors = colorThief.getPalette($('#music #cover')[0], 2);

    // Set colors from Color Thief
    setColors(colors);
  } else {
    resetColors();
  }
}

function setColors(colors) {
  // Set colors
  resources.colors.regular = colors;
  fetchHueColors();
}

function resetColors() {
  // Clear/reset colors
  resources.colors.regular = [];
  fetchHueColors();
}

function fetchHueColors() {
  if (hasCover()) {
    // If cover image is pressent, get regular colors
    var colors = resources.colors.regular;
    var hueColors = [];

    // Loop through regular colors
    for (var i in colors) {
      // Get GL values
      var color = chroma(colors[i]).gl();
      for (var j in color) {
        color[j] = color[j] > 0.04045 ?
          Math.pow((color[j] + 0.055) / 1.055, 2.4) : color[j] / 12.92;
      }

      // Calculate XYZ values for Hue
      var x = color[0] * 0.664511 + color[1] * 0.154324 + color[2] * 0.162028;
      var y = color[0] * 0.283881 + color[1] * 0.668433 + color[2] * 0.047685;
      var z = color[0] * 0.000088 + color[1] * 0.072310 + color[2] * 0.986039;

      // Calculate XY values
      var finalX = x / (x + y + z);
      var finalY = y / (x + y + z);

      // Add calculated values to Hue color array
      hueColors.push({ x: finalX, y: finalY });
    }

    // Set colors from calculations
    setHueColors(hueColors);
  } else {
    resetHueColors();
  }
}

function setHueColors(colors) {
  // Set Hue colors
  resources.colors.hue = colors;
  fetchHexColors();
}

function resetHueColors() {
  // Clear/reset Hue colors
  resources.colors.hue = [];
  fetchHexColors();
}

function fetchHexColors() {
  if (hasCover()) {
    // If cover image is present, get regular colors
    var colors = resources.colors.regular;
    var hexColors = [];

    // Loop through regular colors
    for (var i in colors) {
      // Brighten and get hex values
      var color = colors[i];
      var brightenFactor = 3 * (1 - chroma(color).luminance());
      var hex = chroma(color).brighten(brightenFactor).hex();

      // Add retreived value to hex color array
      hexColors.push(hex);
    }

    // Set hex colors
    setHexColors(hexColors);
  } else {
    resetHexColors();
  }
}

function setHexColors(colors) {
  // Set hex colors
  resources.colors.hex = colors;
  updateColors();
}

function resetHexColors() {
  // Clear/reset hex colors
  resources.colors.hex = [];
  updateColors();
}

function updateColors() {
  // Set color arrays
  var hexColors;
  var hueColors;

  if (hasCover()) {
    // Update color arrays with determined values
    hexColors = resources.colors.hex;
  } else {
    // Update color arrays with default values
    hexColors = [ '#f6f5f7', '#f6f5f7' ];
    hueColors = [ { x: (1 / 3), y: (1 / 3) } ];

    resources.colors.hex = hexColors;
    resources.colors.hue = hueColors;
  }

  // Update text colors
  $('#music #title').css('color', hexColors[0]);
  $('#music #artist').css('color', hexColors[1]);

  // Update Hue lights
  updateHue();
}

function updateHue() {
  // Make sure Hue functionality is enabled
  if (cookieEnabled('hueEnabled')) {
    // Set Hue credentials
    var ip = Cookies.get('hueIp');
    var username = Cookies.get('hueUsername');
    var rooms = Cookies.get('hueRooms').split(',');

    // Get light information from Hue
    var url = insertVars(resources.urls.hue.rooms, { IP: ip, USERNAME:
      username });
    $.get(url, function(data) {
      // Loop through lights and colors for selected groups
      var lights = [];
      for (var i in rooms) {
        var room = data[rooms[i]];
        for (var j in room.lights) {
          lights.push(parseInt(room.lights[j]));
        }
      }

      var colors = resources.colors.hue;
      var colorIteration = 0;
      for (var k in lights) {
        var color = colors[colorIteration % colors.length];
        colorIteration++;

        // Prepare and send update message for each Hue light
        var url = insertVars(resources.urls.hue.set, { IP: ip, USERNAME:
          username, ID: lights[k] });
        var body = '{"xy": [' + color.x + ',' + color.y + ']}';
        $.ajax({
          url: url,
          type: 'PUT',
          data: body
        });
      }
    });
  }
}

/* Metadata functions */

function initMetadata() {
  // Update preview image properties
  $('#music #cover')[0].onload = fetchColors;

  // Start metadata fetch loop
  fetchMetadata();
}

function fetchMetadata() {
  // Query Last.fm for recent track information
  var url = insertVars(resources.urls.lastfm.recent, { USER:
    resources.credentials.lastfm.user.toLowerCase(), KEY:
    resources.credentials.lastfm.key });
  $.get(url, function(data) {
    if (data.recenttracks) {
      // Make sure the most recent track is still playing, and update metadata
      var track = data.recenttracks.track[0];
      if (track['@attr'] && track['@attr'].nowplaying) {
        var artist = track.artist['#text'];
        var artistId = track.artist.mbid;
        var title = track.name;
        var link = track.url;
        var cover = track.image[track.image.length - 1]['#text'];

        setMetadata(artist, artistId, title, link, cover);
      } else {
        resetMetadata();
      }
    } else {
      resetMetadata();
    }
  }).fail(resetMetadata);

  // Restart metadata fetch loop
  setTimeout(function() {
    fetchMetadata(url);
  }, 3000);
}

function setMetadata(artist, artistId, title, link, cover) {
  // Set track metadata
  resources.track.current.artist = artist;
  resources.track.current.artistId = artistId;
  resources.track.current.title = title;
  resources.track.current.link = link;
  resources.track.current.cover = cover ? cover : '';
  updateMetadata();
}

function resetMetadata() {
  // Clear/reset track metadata
  resources.track.current.artist = '';
  resources.track.current.artistId = '';
  resources.track.current.title = '';
  resources.track.current.link = '';
  resources.track.current.cover = '';
  updateMetadata();
}

function updateMetadata() {
  // Get current track metadata
  var artist = resources.track.current.artist;
  var title = resources.track.current.title;
  var link = resources.track.current.link;

  // Update track metadata text
  $('#music #artist').text(artist || 'Nothing in the air...');
  $('#music #title').text(title);
  $('#music #songLink').attr('href', link);

  // Update document title and show/hide extended info as necessary
  if (nowPlaying()) {
    document.title = '"' + title + '" by ' + artist;
    if (cookieEnabled('extendedOn')) {
      toggleDisplay('#userLine', true);
    }
  } else {
    document.title = 'Last.fm Now';
    toggleDisplay('#userLine', false);
    resetBackground();
  }

  // Update cover and artist images
  fetchImages();
}

/* Weather functions */

function initWeather() {
  // Get location from geolocation API
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      // Set coordinates and weather icon mapping
      var coords = position.coords;
      var iconMap = {
        'clear-day': 'day-sunny',
        'clear-night': 'night-clear',
        'rain': 'rain',
        'snow': 'snow',
        'sleet': 'sleet',
        'wind': 'cloudy-gusts',
        'fog': 'fog',
        'cloudy': 'cloudy',
        'partly-cloudy-day': 'day-cloudy',
        'partly-cloudy-night': 'night-alt-cloudy',
        'hail': 'hail',
        'thunderstorm': 'thunderstorm',
        'tornado': 'tornado',
        '01d': 'day-sunny',
        '01n': 'night-clear',
        '02d': 'day-cloudy',
        '02n': 'night-cloudy',
        '03d': 'cloud',
        '03n': 'cloud',
        '04d': 'cloudy',
        '04n': 'cloudy',
        '09d': 'rain',
        '09n': 'rain',
        '10d': 'day-rain',
        '10n': 'night-rain',
        '11d': 'thunderstorm',
        '11n': 'thunderstorm',
        '13d': 'snow',
        '13n': 'snow',
        '50d': 'windy',
        '50n': 'windy'
      };

      // Start weather refresh loop
      updateWeather(coords, iconMap);
    });
  }
}

function updateWeather(coords, iconMap) {
  // Get weather from Forecast API (requested server-side)
  var url = resources.urls.forecast.query;
  var units = cookieExists('units') ? Cookies.get('units') : 'imperial';
  var body = 'latitude=' + coords.latitude + '&longitude=' + coords.longitude +
    '&units=' + units;
  $.post(url, body, function(data) {
    // Set weather feature to enabled
    resources.state.features.weather = true;

    // Set weather data
    var summary, temperature, apparentTemperature, unit, icon;
    unit = units == 'imperial' ? 'F' : 'C';
    if (data.apiType == 'darkSky') {
      summary = data.minutely.summary;
      temperature = Math.round(data.currently.temperature);
      apparentTemperature = Math.round(data.currently.apparentTemperature);
      icon = 'wi wi-' + iconMap[data.currently.icon];
    } else {
      summary = data.weather[0].description + ' currently';
      summary = summary.substring(0, 1).toUpperCase() + summary.substring(1);
      temperature = Math.round(data.main.temp);
      apparentTemperature = null;
      icon = 'wi wi-' + iconMap[data.weather[0].icon];
    }

    // Update weather data
    $('#weather #summary').text(summary);
    $('#weather #conditions #temperature').text(temperature);
    $('#weather #conditions #apparentTemperature').text(apparentTemperature);
    $('#weather #conditions .unit').text(unit);
    $('#weather #conditions #icon').removeClass($(this).attr('class')).
      addClass(icon);

    // Display weather text as appropriate
    if (cookieEnabled('weatherOn') || !cookieExists('weatherOn')) {
      if (apparentTemperature) {
        $('#apparent').show();
      } else {
        $('#apparent').hide();
      }
      toggleDisplay('#weather', true);
    }
  });

  // Restart weather refresh loop
  setTimeout(function() {
    updateWeather(coords, iconMap);
  }, 600000);
}

/* Date and time functions */

function initDatetime() {
  setInterval(function() {
    updateDatetime();
  }, 1000);

  if (cookieEnabled('datetimeEnabled'))
    toggleDisplay('#datetime', true);
}

function updateDatetime() {
  $('#datetime #date').text(getCurrentDate());
  $('#datetime #time').text(getCurrentTime());
}

function getCurrentDate() {
  var months = [
    'January', 
    'February', 
    'March', 
    'April', 
    'May', 
    'June', 
    'July', 
    'August', 
    'September', 
    'October', 
    'November', 
    'December'
  ];
  var date = new Date();
  var month = months[date.getMonth()];
  return month + ' ' + date.getDate() + ', ' + date.getFullYear();
}

function getCurrentTime() {
  var date = new Date();
  var hours = date.getHours().toString();
  var minutes = date.getMinutes().toString();
  if (hours.length == 1) hours = '0' + hours;
  if (minutes.length == 1) minutes = '0' + minutes;
  return hours + ':' + minutes;
}

/* Utility functions */

function nowPlaying() {
  // Determine whether or not there is music currently playing
  return resources.track.current.artist !== '';
}

function newTrack() {
  // Determine whether or not the track has changed since last function call
  if (resources.track.current.artist !== resources.track.previous.artist ||
      resources.track.current.title !== resources.track.previous.title) {
    // Update previous track information
    resources.track.previous.artist = resources.track.current.artist;
    resources.track.previous.title = resources.track.current.title;

    return true;
  }

  return false;
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

function insertVars(string, vars) {
  // Replace variable placeholders with specified variables
  for (var i in vars) {
    string = string.replace(new RegExp('%' + i + '%', 'g'), vars[i]);
  }
  return string;
}
