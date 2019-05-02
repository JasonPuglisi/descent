const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const request = require('request');

/* Base application functionality */

let app = express();
app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/now/app/static/', express.static('public'));

let spotifyKey;
authenticateSpotify(process.env.SPOTIFY_CLIENT, process.env.SPOTIFY_SECRET);

app.get('/now', (req, res) => {
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

app.post('/now', (req, res) => {
  let user = encodeURIComponent(req.body.user || req.body.defaultUser);

  res.redirect(`/now/${user}`);
});

app.get('/now/:user', (req, res) => {
  let title = 'Descent';
  let user = decodeURIComponent(req.params.user.substring(0, 20));

  res.render('now', { title, user });
});

app.get('/now/app/config', (req, res) => {
  let title = 'Descent Configuration';

  res.render('config', { title });
});

app.post('/now/app/config/set', (req, res) => {
  let cookies = [
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

    res.cookie(name, selected, { maxAge: 315360000000 });
  }

  let user = req.body.lastUser;

  if (user === undefined || user === null) {
    res.redirect('/now');
    return;
  }

  res.redirect(`/now/${user}`);
});

/* Hue functionality */

app.get('/now/app/hue', (req, res) => {
  let title = 'Descent Hue Setup';

  res.render('hue', { title, hueClientId: process.env.HUE_CLIENT,
    hueAppId: process.env.HUE_ID });
});

app.get('/now/app/hue/authorize', (req, res) => {
  let code = req.query.code;
  let refreshToken = req.query.refreshToken;
  authenticateHue(code, refreshToken, auth => {
    if (auth) {
      res.cookie('hueAccessToken', auth.accessToken, { maxAge: auth.accessTokenExpiry });
      res.cookie('hueRefreshToken', auth.refreshToken, { maxAge: auth.refreshTokenExpiry });
      res.cookie('hueUsername', auth.username, { maxAge: auth.accessTokenExpiry });
    }

    res.redirect('/now/app/hue');
  });
});

function authenticateHue(code, refreshToken, callback) {
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

  let url = code ? `https://api.meethue.com/oauth2/token?code=${code}&grant_type=authorization_code` : 'https://api.meethue.com/oauth2/refresh?grant_type=refresh_token';
  request.post(url, (err, res) => {
    if (err || res.statusCode !== 401) {
      console.warn('Error authenticating with Hue: No initial challenge');
      callback();
      return;
    }

    let authHeader = res.headers['www-authenticate'];
    let realm = authHeader.match(/realm="(.+?)"/)[1];
    let nonce = authHeader.match(/nonce="(.+?)"/)[1];
    let uriSuffix = code ? 'token' : 'refresh';
    let digest = calculateHueDigest(clientId, clientSecret, realm, nonce, uriSuffix);

    let auth = `Digest username="${clientId}", realm="${realm}", nonce="${nonce}", uri="/oauth2/${uriSuffix}", response="${digest}"`;
    let headers = { 'Authorization': auth };

    let form = code ? undefined : { refresh_token: refreshToken };

    request.post(url, { headers, form }, (err, res, body) => {
      if (err || res.statusCode !== 200) {
        console.warn(`Error authenticating with Hue: Digest failure: ${body}`);
        callback();
        return;
      }

      let data = JSON.parse(body);
      let accessToken = data.access_token;
      let accessTokenExpiry = (parseInt(data.access_token_expires_in) - 300) * 1000;
      let refreshToken = data.refresh_token;
      let refreshTokenExpiry = (parseInt(data.refresh_token_expires_in) - 300) * 1000;
      let tokenType = data.token_type;

      hueWhitelistApplication(accessToken, (username) => {
        let auth = { accessToken, accessTokenExpiry, refreshToken, refreshTokenExpiry, tokenType, username };
        callback(auth);
      });
    });
  });
}

function calculateHueDigest(clientId, clientSecret, realm, nonce, uriSuffix) {
  let hash1Data = `${clientId}:${realm}:${clientSecret}`;
  let hash1 = crypto.createHash('md5').update(hash1Data).digest('hex');

  let hash2Data = `POST:/oauth2/${uriSuffix}`;
  let hash2 = crypto.createHash('md5').update(hash2Data).digest('hex');

  let digestData = `${hash1}:${nonce}:${hash2}`;
  let digest = crypto.createHash('md5').update(digestData).digest('hex');

  return digest;
}

function hueWhitelistApplication(accessToken, callback) {
  let url = 'https://api.meethue.com/bridge/0/config';
  let headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  let body = JSON.stringify({ linkbutton: true });
  request.put(url, { headers, body }, (err, res, body) => {
    url = 'https://api.meethue.com/bridge/';
    body = JSON.stringify({ devicetype: 'Descent' });

    request.post(url, { headers, body }, (err, res, body) => {
      let data = JSON.parse(body);
      callback(data[0].success.username);
    });
  });
}

app.post('/now/app/hue/api/groups', (req, res) => {
  let accessToken = req.body.accessToken;
  let username = req.body.username;

  let url = `https://api.meethue.com/bridge/${username}/groups`;
  let headers = { 'Authorization': `Bearer ${accessToken}` };
  request(url, { headers }, (err, res2, body) => {
    let data = JSON.parse(body);
    res.json(data);
  });
});

app.post('/now/app/hue/api/light', (req, res) => {
  let accessToken = req.body.accessToken;
  let username = req.body.username;

  let id = req.body.id;
  let colorX = req.body.colorX;
  let colorY = req.body.colorY;

  let url = `https://api.meethue.com/bridge/${username}/lights/${id}/state`;
  let headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  let body = `{"xy": [${colorX},${colorY}]}`;
  request.put(url, { headers, body }, (err, res2, body) => {
    let data = JSON.parse(body);
    res.json(data);
  });
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

function authenticateSpotify(client, secret) {
  if (!client || !secret) {
    console.warn('Error getting Spotify authorization: No API credentials');
    return;
  }

  let authorization = Buffer.from(`${client}:${secret}`).toString('base64');
  let options = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authorization}`
    },
    body: 'grant_type=client_credentials'
  };
  request.post(options, (err, res, body) => {
    if (err || res.statusCode != 200) {
      console.warn(`Error getting Spotify authorization: ${err}`);
      spotifyKey = null;
      setTimeout(() => { authenticateSpotify(client, secret); }, 1800000);
      return;
    }

    let data = JSON.parse(body);
    spotifyKey = data.access_token;
    setTimeout(() => { authenticateSpotify(client, secret); }, data.expires_in * 1000);
  });
}

app.post('/now/app/spotify/track', (req, res) => {
  if (!spotifyKey) {
    console.warn('Error getting Spotify track: No API key');
    res.json(new Track());
    return;
  }

  let artist = encodeURIComponent(decodeURIComponent(req.body.artist));
  let title = encodeURIComponent(decodeURIComponent(req.body.title));
  let query = `${artist}%20-%20${title}`;

  let options = {
    url: `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
    headers: {
      'Authorization': `Bearer ${spotifyKey}`
    }
  };
  request(options, (err, res2, body) => {
    if (err || res2.statusCode != 200) {
      console.warn(`Error getting Spotify track: Invalid response: ${err}`);
      res.json(new Track());
      return;
    }

    let data = JSON.parse(body);
    if (data.tracks.total < 1) {
      console.warn('Error getting Spotify track: No results');
      res.json(new Track());
      return;
    }

    let track = data.tracks.items[0];
    track.success = true;

    res.json(track);
  });
});

app.post('/now/app/spotify/artist', (req, res) => {
  if (!spotifyKey) {
    console.warn('Error getting Spotify artist: No API key');
    res.json(new Artist());
    return;
  }

  let artist = encodeURIComponent(decodeURIComponent(req.body.artist));
  let query = artist;

  let options = {
    url: `https://api.spotify.com/v1/artists/${query}`,
    headers: {
      'Authorization': `Bearer ${spotifyKey}`
    }
  };
  request(options, (err, res2, body) => {
    if (err || res2.statusCode != 200) {
      console.warn(`Error getting Spotify artist: Invalid response: ${err}`);
      res.json(new Artist());
      return;
    }

    let data = JSON.parse(body);
    let artist = data;
    artist.success = true;

    res.json(artist);
  });
});

/* Weather (OpenWeatherMap and DarkSky) functionality */

class Weather {
  constructor(success) {
    this.success = success === true;
  }
}

app.post('/now/app/weather', (req, res) => {
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

function getWeatherDarkSky(key, lat, lon, units, callback) {
  units = units === 'imperial' ? 'us' : 'si';
  let urlLat = encodeURIComponent(lat);
  let urlLon = encodeURIComponent(lon);
  let url = `https://api.darksky.net/forecast/${key}/${urlLat},${urlLon}?units=${units}`;

  request(url, (err, res, body) => {
    if (err || res.statusCode != 200)
      callback(`Invalid response: ${err}`, new Weather());

    let data = JSON.parse(body);
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
  });
}

function getWeatherOpenweathermap(key, lat, lon, units, callback) {
  let urlLat = encodeURIComponent(lat);
  let urlLon = encodeURIComponent(lon);
  let urlUnits = encodeURIComponent(units);
  let url = `http://api.openweathermap.org/data/2.5/weather?lat=${urlLat}&lon=${urlLon}&units=${urlUnits}&appid=${key}`;

  request(url, (err, res, body) => {
    if (err || res.statusCode != 200)
      callback(`Invalid response: ${err}`, new Weather());

    let data = JSON.parse(body);
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
  });
}

/* Application runtime */

app.listen(process.env.DESCENT_PORT || 3000);
