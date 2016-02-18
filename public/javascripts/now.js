$(function() {
  window.apis = {
    lastfmUser: $('#music #user').text().toLowerCase(),
    lastfmKey: 'c1797de6bf0b7e401b623118120cd9e1'
  };

  window.urls = {
    lastfmTracks: 'https://ws.audioscrobbler.com/2.0/?method=' +
      'user.getrecenttracks&user=%USER%&api_key=%KEY%&limit=1&format=json',
    colorSummary: '/now/colors',
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
    lastfmCover.src = cover;
  } else {
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

    updateColors(cover);
  }
}

function updateColors(image) {
  if (image) {
    var clusters = 3;

    var url = urls.colorSummary;
    var body = 'image="' + image + '"&clusters=' + clusters;

    $.post(url, body, function(data) {
      var clusters = data.clusters;

      var hueColors = [];
      if (clusters) {
        color1 = shadeBlend(0.35, clusters[0].hex[0]);
        color2 = shadeBlend(0.35, clusters[1].hex[0]);

        for (var i in clusters) {
          var xyz = clusters[i].xyz;
          var x = parseFloat(xyz[0]);
          var y = parseFloat(xyz[1]);
          var z = parseFloat(xyz[2]);

          var hueX = x / (x + y + z);
          var hueY = y / (x + y + z);
          hueColors.push({ x: hueX, y: hueY });
        }
      }

      $('#music #title').css('color', color1);
      $('#music #artist').css('color', color2);

      updateHue(hueColors);
    });
  } else {
    color1 = color2 = '#f6f5f7';

    $('#music #title').css('color', color1);
    $('#music #artist').css('color', color2);

    updateHue([{ x: (1 / 3), y: (1 / 3) }]);
  }
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
        var color = colors[i % colors.length];

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

function shadeBlend(p,c0,c1) {
  var n=p<0?p*-1:p,u=Math.round,w=parseInt;
  if(c0.length>7){
    var f=c0.split(","),t=(c1?c1:p<0?"rgb(0,0,0)":"rgb(255,255,255)").split(","),R=w(f[0].slice(4)),G=w(f[1]),B=w(f[2]);
    return "rgb("+(u((w(t[0].slice(4))-R)*n)+R)+","+(u((w(t[1])-G)*n)+G)+","+(u((w(t[2])-B)*n)+B)+")"
  }else{
    var f=w(c0.slice(1),16),t=w((c1?c1:p<0?"#000000":"#FFFFFF").slice(1),16),R1=f>>16,G1=f>>8&0x00FF,B1=f&0x0000FF;
    return "#"+(0x1000000+(u(((t>>16)-R1)*n)+R1)*0x10000+(u(((t>>8&0x00FF)-G1)*n)+G1)*0x100+(u(((t&0x0000FF)-B1)*n)+B1)).toString(16).slice(1)
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
    if (checkCookie('weatherOn')) {
      toggleWeather(fadeTime * 2);
    }
  });

  setTimeout(function() {
    updateWeather(coords, iconMap);
  }, 900000);
}

function initHelp() {
  window.onkeydown = processKey;
  window.fadeTime = 750;
  window.musicPlaying = false;
  window.weatherEnabled = false;

  setTimeout(toggleHelp, 3600, false);
}

function processKey(event) {
  var key = event.key.toLowerCase();
  switch (key) {
    case 'w':
      if (weatherEnabled) {
        toggleCookie('weatherOn');
        toggleWeather();
      } else {
        toggleWeather(null, false);
      }
      break;
    case 'e':
      if (musicPlaying) {
        toggleCookie('extendedOn');
        toggleExtended();
      } else {
        toggleExtended(null, false);
      }
      break;
    case 'h':
      toggleHelp();
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

function toggleHelp(duration, force) {
  toggleDisplay('#help', duration, force);
}

function toggleDisplay(element, duration, force) {
  var show = force !== undefined ? force : !$(element).is(':visible');

  if (show) {
    $(element).fadeIn(duration || fadeTime);
  } else {
    $(element).fadeOut(duration || fadeTime);
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

