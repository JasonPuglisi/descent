$(function() {
  window.apis = {
    lastfmUser: $('#music #user').text().toLowerCase(),
    lastfmKey: 'c1797de6bf0b7e401b623118120cd9e1'
  };

  window.urls = {
    lastfmTracks: 'https://ws.audioscrobbler.com/2.0/?method=' +
      'user.getrecenttracks&user=%USER%&api_key=%KEY%&limit=1&format=json',
    cover: document.location + '/cover?url=',
    hueInfo: '/now/hue/info',
    hueSet: '/now/hue/set',
    hueAction: 'https://www.meethue.com/api/sendmessage?token=%TOKEN%',
    weather: '/now/weather',
    blankImage: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///' +
      'yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  };

  initLastfm();
  initWeather();
  initHelp();
});

function initLastfm() {
  window.lastfmCoverPrevious = '';
  window.lastfmCover = new Image();
  window.lastfmCoverRefresh = false;

  lastfmCover.onload = function() {
    updateLastfmCover(lastfmCover.src);
  };

  var url = urls.lastfmTracks.replace('%USER%', apis.lastfmUser).
    replace('%KEY%', apis.lastfmKey);
  updateLastfm(url);
}

function updateLastfm(url) {
  $.get(url, function(data) {
    var playing;
    if (data) {
      var tracks = data.recenttracks;
      if (tracks) {
        var track = tracks.track[0];

        playing = track['@attr'] && track['@attr'].nowplaying;
        if (playing) {
          musicPlaying = true;

          var cover = track.image[track.image.length - 1]['#text'];
          var title = track.name;
          var artist = track.artist['#text'];
          var link = track.url;

          updateLastfmMetadata(cover, title, artist, link);
        }
      }
    }

    if (!playing) {
      musicPlaying = false;
      updateLastfmMetadata();
    }
  });

  setTimeout(function() {
    updateLastfm(url);
  }, 3000);
}

function updateLastfmMetadata(cover, title, artist, link) {
  if (cover) {
    if (lastfmCover.src.substring(urls.cover.length) !== cover ||
        lastfmCoverRefresh) {
      lastfmCoverRefresh = false;
      lastfmCover.src = urls.cover + cover;
    }
  } else {
    delete lastfmCover.src;
    updateLastfmCover();
  }

  $('#music #title').text(title || '');
  $('#music #artist').text(artist || 'Nothing in the air...');
  $('#music #songLink').attr('href', link);

  if (musicPlaying) {
    document.title = '"' + title + '" by ' + artist;
    if (checkCookie('extendedOn')) {
      toggleExtended(null, true);
    }
  } else {
    document.title = 'Last.fm Now';
    toggleExtended(null, false);
  }
}

function updateLastfmCover(cover) {
  if (lastfmCoverPrevious != cover) {
    lastfmCoverPrevious = cover;

    $('#background').css('background-image', 'url(' +
      (cover ? cover : urls.blankImage) + ')');

    if (cover) {
      $('#music #cover').attr('src', cover);
      $('#music #cover').show();
    } else {
      $('#music #cover').hide();
    }

    updateColors(!cover);
  }
}

function updateColors(reset) {
  if (!reset) {
    var colorThief = new ColorThief();
    var colors = colorThief.getPalette(lastfmCover, 2);

    var hueColors = [];
    for (var i in colors) {
      var color = colors[i];
      var brightenFactor = 3 * (1 - chroma(color).luminance());
      colors[i] = chroma(color).brighten(brightenFactor).hex();

      color = chroma(color).gl();
      for (var j in color) {
        color[j] = color[j] > 0.04045 ?
          Math.pow((color[j] + 0.055) / 1.055, 2.4) : color[j] / 12.92;
      }

      var x = color[0] * 0.664511 + color[1] * 0.154324 + color[2] * 0.162028;
      var y = color[0] * 0.283881 + color[1] * 0.668433 + color[2] * 0.047685;
      var z = color[0] * 0.000088 + color[1] * 0.072310 + color[2] * 0.986039;

      var finalX = x / (x + y + z);
      var finalY = y / (x + y + z);

      hueColors.push({ x: finalX, y: finalY });
    }

    var color1 = colors[0];
    var color2 = colors[1];

    $('#music #title').css('color', color1);
    $('#music #artist').css('color', color2);

    updateHue(hueColors);
  } else {
    resetColors();
  }
}

function resetColors() {
  var color1 = '#f6f5f7';
  var color2 = color1;

  $('#music #title').css('color', color1);
  $('#music #artist').css('color', color2);

  updateHue([{ x: (1 / 3), y: (1 / 3) }]);
}

function updateHue(colors) {
  var enabled = Cookies.get('hueEnabled');
  if (enabled === 'true') {
    var accessToken = Cookies.get('hueAccessToken');
    var bridgeId = Cookies.get('hueBridgeId');

    var url = urls.hueInfo;
    var body = 'accessToken=' + accessToken + '&bridgeId=' + bridgeId;

    $.post(url, body, function(data) {
      var lights = Object.keys(data.lights).length;

      var url = urls.hueSet;
      for (var i = 1; i <= lights; i++) {
        var color = colors[(i - 1) % colors.length];

        var cmdUrl = urls.hueAction.replace('%TOKEN%', accessToken);
        var slug = 'lights/' + i + '/state';
        var method = 'PUT';
        var cmdBody = '{"xy": [' + color.x + ',' + color.y + ']}';

        var body = 'clipmessage={bridgeId: "' + bridgeId +
          '", clipCommand: {url: "/api/0/' + slug + '", method: "' +
          method + '", body: ' + cmdBody + '}}&url="' + cmdUrl + '"';

        $.post(url, body);
      }
    });
  }
}

function initWeather() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
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
        'tornado': 'tornado'
      };

      updateWeather(coords, iconMap);
    });
  }
}

function updateWeather(coords, iconMap) {
  var url = urls.weather;
  var body = 'latitude=' + coords.latitude + '&longitude=' + coords.longitude;

  $.post(url, body, function(data) {
    var summary = data.minutely.summary;
    var temperature = Math.round(data.currently.temperature);
    var apparentTemperature = Math.round(data.currently.apparentTemperature);
    var unit = data.flags.units == 'us' ? 'F' : 'C';
    var icon = 'wi wi-' + iconMap[data.currently.icon];

    $('#weather #summary').text(summary);
    $('#weather #conditions #temperature').text(temperature);
    $('#weather #conditions #apparentTemperature').text(apparentTemperature);
    $('#weather #conditions .unit').text(unit);
    $('#weather #conditions #icon').removeClass($(this).attr('class')).
      addClass(icon);

    weatherEnabled = true;
    if (checkCookie('weatherOn') || !cookieExists('weatherOn')) {
      toggleWeather(fadeTime * 2, true);
    }
  });

  setTimeout(function() {
    updateWeather(coords, iconMap);
  }, 600000);
}

function initHelp() {
  window.onkeydown = processKey;
  window.fadeTime = 750;
  window.musicPlaying = false;
  window.weatherEnabled = false;
  window.hueAllowed = Cookies.get('hueBridgeId') !== undefined &&
    Cookies.get('hueAccessToken') !== undefined;

  if (hueAllowed) {
    if (checkCookie('hueEnabled')) {
      $('#hueIndicator').text('on');
    }
    $('#hueHelp').show();
  }

  setTimeout(function() {
    toggleHelp(null, false);
  }, 3600);
}

function processKey(event) {
  var key = event.keyCode;
  switch (key) {
    case 70:
      if (weatherEnabled) {
        toggleCookie('weatherOn');
        toggleWeather();
      } else {
        toggleWeather(null, false);
      }
      break;
    case 69:
      if (musicPlaying) {
        toggleCookie('extendedOn');
        toggleExtended();
      } else {
        toggleExtended(null, false);
      }
      break;
    case 76:
      if (hueAllowed) {
        toggleCookie('hueEnabled');
        toggleHue();
      } else {
        toggleHue(false);
      }
      break;
    case 72:
      toggleHelp(null);
      break;
  }
}

function toggleWeather(duration, force) {
  toggleDisplay('#weather', duration, force);
}

function toggleExtended(duration, force) {
  var elements = ['#userLine', '#songLink'];
  for(var i in elements) {
    toggleDisplay(elements[i], duration, force);
  }
}

function toggleHue(force) {
  var element = '#hueIndicator';
  var enable = force !== undefined ? force : $(element).text() === 'off';

  if (enable) {
    $(element).text('on');
    lastfmCoverPrevious = '';
    lastfmCoverRefresh = true;
  } else {
    $(element).text('off');
  }
}

function toggleHelp(duration, force) {
  toggleDisplay('#help', duration, force);
}

function toggleDisplay(element, duration, force) {
  var show = force !== undefined ? force : !$(element).is(':visible');

  if (show) {
    $(element).fadeIn(duration || fadeTime, 'linear');
  } else {
    $(element).fadeOut(duration || fadeTime, 'linear');
  }
}

function toggleCookie(name) {
  if (checkCookie(name)) {
    Cookies.set(name, 'false', { expires: 365 });
  } else {
    Cookies.set(name, 'true', { expires: 365 });
  }
}

function checkCookie(name) {
  return Cookies.get(name) === 'true';
}

function cookieExists(name) {
  return Cookies.get(name) !== undefined;
}

