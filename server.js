import bodyParser from 'body-parser';
import express from 'express';
import fetch from 'node-fetch';

/* Base application functionality */

let app = express();
app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/app/static/', express.static('public'));

let pollIntervals = {
  'lastfm': 10000
};
loadPollIntervals();

let lastfmKey = process.env.LASTFM_API_KEY;

let spotifyKey;
authenticateSpotify(process.env.SPOTIFY_CLIENT, process.env.SPOTIFY_SECRET);

app.get('/now{*splat}', (req, res) => {
  let path = req.originalUrl.substring(4);
  res.redirect(path ? path : '/');
});

app.get('/', (req, res) => {
  let title = 'Descent';
  let users = [
    'iJason_',
    'jefferyd',
    'foreverautumn',
    'robinlisle',
    'ben-xo',
    'good_bone',
    'pellitero',
    'Nesquen',
    'hjbardenhagen',
    'Kvasmeister',
    'jakeledoux'
  ];
  let user = users[Math.floor(Math.random() * users.length)];

  res.render('landing', { title, user });
});

app.post('/', (req, res) => {
  let user = encodeURIComponent(req.body.user || req.body.defaultUser);

  res.redirect(`/${user}`);
});

app.get('/:user', (req, res) => {
  let title = 'Descent';
  let user = decodeURIComponent(req.params.user.substring(0, 20));

  res.render('now', { title, user, lastfmKey });
});

app.get('/app/poll/interval', (req, res) => {
  res.json(pollIntervals);
});

app.get('/app/config', (req, res) => {
  let title = 'Descent Configuration';

  res.render('config', { title });
});

app.post('/app/config/set', (req, res) => {
  let cookies = [
    {
      'name': 'scrobbleMode',
      'options': ['lastScrobbled', 'currentlyPlaying']
    },
    {
      'name': 'background',
      'options': ['artist', 'album', 'transparent', 'none']
    },
    {
      'name': 'blur',
      'options': ['true', 'false']
    },
    {
      'name': 'defaultBackground'
    },
    {
      'name': 'latitude'
    },
    {
      'name': 'longitude'
    },
    {
      'name': 'units',
      'options': ['imperial', 'metric']
    },
    {
      'name': '24hr',
      'options': ['true', 'false']
    },
    {
      'name': 'weekday',
      'options': ['true', 'false']
    },
    {
      'name': 'seconds',
      'options': ['true', 'false']
    },
    {
      'name': 'lastUser'
    },
    {
      'name': 'weatherOn',
      'options': ['true', 'false']
    },
    {
      'name': 'datetimeOn',
      'options': ['true', 'false']
    },
    {
      'name': 'extendedOn',
      'options': ['true', 'false']
    }
  ];

  for (let cookie of cookies) {
    let name = cookie.name;
    let options = cookie.options;
    let selected = req.body[name];

    if (selected === undefined || (options !== undefined && !options.includes(selected)))
      continue;

    res.cookie(name, selected, { maxAge: 315360000000, secure: true });
  }

  let user = encodeURIComponent(req.body.lastUser);

  if (user === undefined || user === null) {
    res.redirect('/');
    return;
  }

  res.redirect(`/${user}`);
});

/* System functionality */

function loadPollIntervals() {
  let lastfm = process.env.LASTFM_POLL_INTERVAL;
  if (lastfm) {
    console.info(`Setting Last.fm poll interval: ${lastfm}`);
    pollIntervals.lastfm = lastfm;
  }
}

/* Hue functionality */

app.get('/app/hue', (req, res) => {
  let title = 'Descent Hue Setup';

  res.render('hue', { title, hueClientId: process.env.HUE_CLIENT,
    hueAppId: process.env.HUE_ID });
});

app.get('/app/hue/authorize', (req, res) => {
  let code = req.query.code;
  let refreshToken = req.query.refreshToken;
  let username = req.query.username;
  authenticateHue(code, refreshToken, username, auth => {
    if (auth) {
      res.cookie('hueAccessToken', auth.accessToken, { maxAge: auth.expiry, secure: true });
      res.cookie('hueRefreshToken', auth.refreshTokenNew, { maxAge: 315360000000, secure: true });
      res.cookie('hueUsername', auth.usernameNew, { maxAge: 315360000000, secure: true });
    }

    res.redirect('/app/hue');
  });
});

async function authenticateHue(code, refreshToken, username, callback) {
  if (!code && !refreshToken) {
    console.warn('Error authenticating with Hue: No authorization code or refresh token');
    callback();
    return;
  }

  let clientId = process.env.HUE_CLIENT;
  let clientSecret = process.env.HUE_SECRET;
  if (!clientId || !clientSecret) {
    console.warn('Error authenticating with Hue: Missing client ID or secret');
    callback();
    return;
  }

  let url = 'https://api.meethue.com/v2/oauth2/token';
  let auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  let headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${auth}`
  };

  let form = code ? `code=${code}&grant_type=authorization_code` :
    `refresh_token=${refreshToken}&grant_type=refresh_token`;

  const response = await fetch(url, {
    'method': 'post',
    'body': form,
    'headers': headers
  });

  if (!response.ok) {
    console.warn(`Error authenticating with Hue: Token failure`);
    callback();
    return;
  }

  let data = await response.json();
  let accessToken = data.access_token;
  let expiry = (parseInt(data.expires_in) - 300) * 1000;
  let refreshTokenNew = data.refresh_token;
  let tokenType = data.token_type;

  hueWhitelistApplication(accessToken, username, (usernameNew) => {
    let auth = { accessToken, expiry, refreshTokenNew, tokenType, usernameNew };
    callback(auth);
  });
}

async function hueWhitelistApplication(accessToken, username, callback) {
  if (username) {
    callback(username);
    return;
  }

  let url = 'https://api.meethue.com/route/api/0/config';
  let headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  let body = JSON.stringify({ linkbutton: true });

  const response = await fetch(url, {
    'method': 'put',
    'body': body,
    'headers': headers
  });

  url = 'https://api.meethue.com/route/api';
  body = JSON.stringify({ devicetype: 'Descent' });

  const response2 = await fetch(url, {
    'method': 'post',
    'body': body,
    'headers': headers
  });

  let data = await response2.json();
  callback(data[0].success.username);
}

app.post('/app/hue/api/groups', async (req, res) => {
  let accessToken = req.body.accessToken;
  let username = encodeURIComponent(req.body.username);

  let url = `https://api.meethue.com/bridge/${username}/groups`;
  let headers = { 'Authorization': `Bearer ${accessToken}` };

  const response = await fetch(url, {
    'headers': headers
  });

  let data = await response.json();
  res.json(data);
});

app.post('/app/hue/api/light', async (req, res) => {
  let accessToken = req.body.accessToken;
  let username = encodeURIComponent(req.body.username);

  let id = encodeURIComponent(req.body.id);
  let colorX = req.body.colorX;
  let colorY = req.body.colorY;

  let url = `https://api.meethue.com/bridge/${username}/lights/${id}/state`;
  let headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  let body = `{"xy": [${colorX},${colorY}]}`;

  const response = await fetch(url, {
    'method': 'put',
    'body': body,
    'headers': headers
  });

  let data = await response.json();
  res.json(data);
});

/* Spotify functionality */

class Track {
  constructor(success) {
    this.success = success === true;
  }
}

class Artist {
  constructor(success) {
    this.success = success === true;
  }
}

async function authenticateSpotify(client, secret) {
  if (!client || !secret) {
    console.warn('Error getting Spotify authorization: No API credentials');
    return;
  }

  let authorization = Buffer.from(`${client}:${secret}`).toString('base64');
  let url = 'https://accounts.spotify.com/api/token';
  let body = 'grant_type=client_credentials';
  let headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${authorization}`
  };

  const response = await fetch(url, {
    'method': 'post',
    'body': body,
    'headers': headers
  });

  if (!response.ok) {
    console.warn(`Error getting Spotify authorization: ${response.statusText}`);
    spotifyKey = null;
    setTimeout(() => { authenticateSpotify(client, secret); }, 1800000);
    return;
  }

  const data = await response.json();

  spotifyKey = data.access_token;
  setTimeout(() => { authenticateSpotify(client, secret); }, data.expires_in * 1000);
}

app.post('/app/spotify/track', async (req, res) => {
  if (!spotifyKey) {
    console.warn('Error getting Spotify track: No API key');
    res.json(new Track());
    return;
  }

  let track = await searchSpotifyTrack(req.body.artist || '', req.body.title || '',
    req.body.album || '');

  if (!track) {
    console.warn('Error getting Spotify track: No matching results');
    res.json(new Track());
    return;
  }

  track.success = true;

  res.json(track);
});

// Search narrows from album-qualified to free text, preferring a result that
// matches the Last.fm artist and album. Matching only ranks candidates - it never
// discards them, because scrobbles from low-quality sources often carry metadata
// that can't match exactly, and Spotify's fuzzy ranking beats showing nothing.
async function searchSpotifyTrack(artist, title, album) {
  let queries = [];

  if (album)
    queries.push(`track:"${title}" album:"${album}"`);
  queries.push(`artist:"${artist}" track:"${title}"`);
  queries.push(`${artist} - ${title}`);

  let fallback;

  for (let query of queries) {
    let tracks = await searchSpotifyTracks(query);

    if (!tracks)
      return null;

    if (tracks.length)
      fallback = tracks[0];

    let match = matchTrack(tracks, artist, album);

    if (match)
      return match;
  }

  // Nothing matched, so defer to Spotify's best guess from the fuzziest query
  return fallback;
}

// Spotify ranks differently at limit=1 than at higher limits, returning a worse
// top result, so always request a page and pick from it
async function searchSpotifyTracks(query) {
  let url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`;
  let headers = {
    'Authorization': `Bearer ${spotifyKey}`
  };

  const response = await fetch(url, {
    'headers': headers
  });

  if (!response.ok) {
    console.warn(`Error getting Spotify track: ${response.status} ${await response.text()}`);
    return null;
  }

  const data = await response.json();

  return data.tracks.items;
}

function matchTrack(tracks, artist, album) {
  let matches = tracks.filter(track => matchesArtist(track, artist));

  if (album) {
    let exact = matches.find(track => normalizeName(track.album.name) === normalizeName(album));

    if (exact)
      return exact;
  }

  return matches[0];
}

function normalizeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchesArtist(track, artist) {
  let credit = normalizeName(artist);

  return track.artists.some(a => {
    let name = normalizeName(a.name);
    return name.length >= 3 && credit.includes(name);
  });
}

app.post('/app/spotify/artist', async (req, res) => {
  if (!spotifyKey) {
    console.warn('Error getting Spotify artist: No API key');
    res.json(new Artist());
    return;
  }

  let artist = encodeURIComponent(decodeURIComponent(req.body.artist));
  let query = artist;
  let url = `https://api.spotify.com/v1/artists/${query}`;
  let headers = {
    'Authorization': `Bearer ${spotifyKey}`
  };

  const response = await fetch(url, {
    'headers': headers
  });

  if (!response.ok) {
    console.warn(`Error getting Spotify artist: Invalid response: ${err}`);
    res.json(new Artist());
    return;
  }

  let data = await response.json();

  data.success = true;

  res.json(data);
});

/* Weather (OpenWeatherMap and DarkSky) functionality */

class Weather {
  constructor(success) {
    this.success = success === true;
  }
}

app.post('/app/weather', (req, res) => {
  let lat = req.body.latitude;
  let lon = req.body.longitude;
  let units = decodeURIComponent(req.body.units);

  let dsKey = process.env.DARK_SKY_KEY;
  let owmKey = process.env.OPENWEATHERMAP_KEY;

  if (dsKey)
    getWeatherDarkSky(dsKey, lat, lon, units, (err, weather) => {
      if (err)
        console.warn(`Error getting Dark Sky weather: ${err}`);

      res.json(weather);
    });
  else if (owmKey)
    getWeatherOpenweathermap(owmKey, lat, lon, units, (err, weather) => {
      if (err)
        console.warn(`Error getting OpenWeatherMap weather: ${err}`);

      res.json(weather);
    });
  else {
    console.warn('Error getting weather: No API key');
    res.json(new Weather());
  }
});

async function getWeatherDarkSky(key, lat, lon, units, callback) {
  units = units === 'imperial' ? 'us' : 'si';
  let urlLat = encodeURIComponent(lat);
  let urlLon = encodeURIComponent(lon);
  let url = `https://api.darksky.net/forecast/${key}/${urlLat},${urlLon}?units=${units}`;

  const response = await fetch(url);

  if (!response.ok) {
    callback(`Invalid response: ${err}`, new Weather());
  }

  let data = await response.json();
  let icons = {
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

  let weather = new Weather(true);
  weather.summary = data.minutely.summary;
  weather.temperature = Math.round(data.currently.temperature);
  weather.apparentTemperature = Math.round(data.currently.apparentTemperature);
  weather.unit = units === 'us' ? 'F' : 'C';
  weather.icon = icons[data.currently.icon];

  callback(null, weather);
}

async function getWeatherOpenweathermap(key, lat, lon, units, callback) {
  let urlLat = encodeURIComponent(lat);
  let urlLon = encodeURIComponent(lon);
  let urlUnits = encodeURIComponent(units);
  let url = `http://api.openweathermap.org/data/2.5/weather?lat=${urlLat}&lon=${urlLon}&units=${urlUnits}&appid=${key}`;

  const response = await fetch(url);

  if (!response.ok) {
    return callback(`Invalid response: ${err}`, new Weather());
  }

  let data = await response.json();

  let icons = {
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
  let apparent;
  if (units === 'imperial')
    apparent = 35.74 + 0.6215 * data.main.temp - 35.75 * Math.pow(data.wind.speed, 0.16)
      + 0.4275 * data.main.temp * Math.pow(data.wind.speed, 0.16);
  else
    apparent = 13.12 + 0.6215 * data.main.temp - 11.37 * Math.pow(data.wind.speed, 0.16)
      + 0.3965 * data.main.temp * Math.pow(data.wind.speed, 0.16);

  let weather = new Weather(true);
  weather.summary = `${data.weather[0].description} currently`;
  weather.summary = `${weather.summary.substring(0, 1).toUpperCase()}${weather.summary.substring(1)}`;
  weather.temperature = Math.round(data.main.temp);
  weather.apparentTemperature = Math.round(apparent);
  weather.unit = units === 'imperial' ? 'F' : 'C';
  weather.icon = `wi wi-${icons[data.weather[0].icon]}`;

  callback(null, weather);
}

/* Application runtime */

app.listen(process.env.DESCENT_PORT || process.env.PORT || 3000);
