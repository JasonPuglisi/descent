import express from 'express';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { readCookies } from './lib/cookies.js';
import { createLastfm } from './lib/lastfm.js';
import { createSpotify } from './lib/spotify.js';
import { createWeather } from './lib/weather.js';

/* Base application functionality */

let app = express();
app.set('view engine', 'pug');

// A few headers that cost nothing and close off old browser footguns. There's
// no frame restriction, since people embed the now playing page in streams
// and dashboards.
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Content-Security-Policy', contentSecurityPolicy());
  next();
});

// Scripts only come from here and cdnjs. Cloudflare injects an inline bot
// detection script into every page, and it reads the nonce from this header
// to tag that script, so the nonce is what lets it run without allowing
// inline scripts in general. Images are open to any HTTPS host because album
// art comes from Spotify and the default background can be any URL.
function contentSecurityPolicy() {
  let nonce = randomBytes(16).toString('base64');

  return [
    'default-src \'self\'',
    `script-src 'self' 'nonce-${nonce}' https://cdnjs.cloudflare.com`,
    'style-src \'self\' https://fonts.googleapis.com https://cdnjs.cloudflare.com',
    'font-src \'self\' https://fonts.gstatic.com https://cdnjs.cloudflare.com',
    'img-src \'self\' data: https:',
    'connect-src \'self\'',
    'object-src \'none\'',
    'base-uri \'self\'',
    'form-action \'self\''
  ].join('; ');
}

// Static assets sit behind a CDN with a day-long cache at fixed URLs, so a
// deploy would serve fresh markup against stale scripts until someone purged by
// hand. Tying the URLs to the release means a version bump misses the cache on
// its own. The version goes in the path rather than a query string because
// browser modules import their siblings by relative URL, which carries the
// path along but drops the query.
app.locals.version = JSON.parse(readFileSync(new URL('package.json', import.meta.url))).version;
app.locals.assets = `/app/static/${app.locals.version}`;
app.use(express.urlencoded({ extended: true }));

// Express 5 leaves the body undefined for a request without one, and every
// POST route reads fields straight off it
app.use((req, res, next) => {
  req.body ??= {};
  next();
});
app.use(app.locals.assets, express.static('public'));
app.use('/app/static/', express.static('public'));

let pollIntervals = {
  'lastfm': 3000
};
loadPollIntervals();

if (!process.env.LASTFM_API_KEY)
  console.warn('No Last.fm API key set, so the now playing page will not load any tracks');

let spotify = createSpotify({ client: process.env.SPOTIFY_CLIENT, secret: process.env.SPOTIFY_SECRET });

if (!spotify.available())
  console.warn('No Spotify credentials set, so album and artist art will not show');

// Every request comes from this one server now, so identify it in case
// Last.fm ever needs to know whose traffic it is
let lastfm = createLastfm({
  key: process.env.LASTFM_API_KEY,
  userAgent: `Descent/${app.locals.version} (+https://descent.live)`,
  baseInterval: pollIntervals.lastfm,
  details: true,
  artwork: spotify.artwork
});

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
    'jakeledoux',
    'djryan'
  ];
  let user = users[Math.floor(Math.random() * users.length)];

  res.render('landing', { title, user });
});

app.post('/', (req, res) => {
  let user = req.body.user || req.body.defaultUser;

  res.redirect(user ? `/${encodeURIComponent(user)}` : '/');
});

app.get('/:user', (req, res) => {
  let title = 'Descent';
  let user = decodeURIComponent(req.params.user.substring(0, 20));

  res.render('now', { title, user });
});

// The configured interval is the fastest browsers will poll. The proxy
// stretches it when more people are being watched than its Last.fm budget can
// keep up with at that rate.
app.get('/app/poll/interval', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ 'lastfm': lastfm.pollInterval(), 'version': app.locals.version });
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

  // Encoding first used to turn a missing user into the string "undefined",
  // which slipped past the check and sent people to /undefined
  let user = req.body.lastUser;

  res.redirect(user ? `/${encodeURIComponent(user)}` : '/');
});

/* Last.fm functionality */

// Query values arrive as arrays when a name repeats, and as nothing when it's
// missing, so only take a single string of a sane length
function queryString(value, maxLength) {
  return typeof value === 'string' && value && value.length <= maxLength ? value : undefined;
}

// Successful answers can be kept, but must be checked with us every time.
// Express tags each with an ETag, so the browser revalidates on every poll and
// gets an empty 304 back when nothing has changed. Errors aren't kept at all.
async function sendLastfm(res, request) {
  let { status, body, etag } = await request;

  // The page may have gone while the request was held
  if (res.writableEnded || res.destroyed)
    return;

  // Our own ETag rather than Express's, so a held request and the browser
  // agree on what "unchanged" means. Express still answers 304 when it
  // matches the browser's If-None-Match.
  if (etag)
    res.set('ETag', etag);

  res.set('Cache-Control', status === 200 ? 'no-cache' : 'no-store');
  res.status(status).json(body);
}

app.get('/app/lastfm/recent', (req, res) => {
  let user = queryString(req.query.user, 64);

  if (!user) {
    res.status(400).json({ error: 6, message: 'Missing user' });
    return;
  }

  // Pages that pass wait get held until the answer changes, so they can ask
  // again straight away instead of polling on a timer. Without it this answers
  // immediately, which is what pages from before this change expect.
  let controller = new AbortController();
  res.on('close', () => controller.abort());

  sendLastfm(res, lastfm.recentTracks(user, {
    etag: req.get('If-None-Match'),
    wait: req.query.wait === '1',
    signal: controller.signal
  }));
});

app.get('/app/lastfm/artist', (req, res) => {
  let artist = queryString(req.query.artist, 512);
  let user = queryString(req.query.user, 64);

  if (!artist || !user) {
    res.status(400).json({ error: 6, message: 'Missing artist or user' });
    return;
  }

  sendLastfm(res, lastfm.artistInfo(artist, user));
});

app.get('/app/lastfm/track', (req, res) => {
  let artist = queryString(req.query.artist, 512);
  let track = queryString(req.query.track, 512);
  let user = queryString(req.query.user, 64);

  if (!artist || !track || !user) {
    res.status(400).json({ error: 6, message: 'Missing artist, track or user' });
    return;
  }

  sendLastfm(res, lastfm.trackInfo(artist, track, user));
});

/* System functionality */

function loadPollIntervals() {
  let lastfm = process.env.LASTFM_POLL_INTERVAL;

  if (!lastfm)
    return;

  // Without parsing this the endpoint hands clients a string, and they compare
  // it against a number
  let parsed = parseInt(lastfm, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`Ignoring invalid Last.fm poll interval: ${lastfm}`);
    return;
  }

  console.info(`Setting Last.fm poll interval: ${parsed}`);
  pollIntervals.lastfm = parsed;
}

/* Hue functionality */

app.get('/app/hue', (req, res) => {
  let title = 'Descent Hue Setup';

  res.render('hue', { title, hueClientId: process.env.HUE_CLIENT });
});

// Hue sends people back here with an authorization code after they approve
// Descent. Pages from before 2.12.1 also refresh tokens through this route,
// with the refresh token in the query string, so that still works until they
// reload.
app.get('/app/hue/authorize', async (req, res) => {
  await authorizeHue(res, queryString(req.query.code, 512), queryString(req.query.refreshToken, 512),
    queryString(req.query.username, 128));

  res.redirect('/app/hue');
});

// Refreshing uses the refresh token from its cookie. Pages from before 2.13.2
// can read their tokens and post them instead, so the body still counts when
// there's no cookie.
app.post('/app/hue/authorize', async (req, res) => {
  let { refreshToken, username } = hueCredentials(req);
  let success = await authorizeHue(res, undefined, refreshToken, username);

  res.set('Cache-Control', 'no-store');
  res.json({ success });
});

async function authorizeHue(res, code, refreshToken, username) {
  let auth;

  // A failure here used to reject with nobody listening, which left the
  // request hanging until App Engine gave up on it
  try {
    auth = await authenticateHue(code, refreshToken, username);
  } catch (e) {
    console.warn(`Error authenticating with Hue: ${e}`);
  }

  if (!auth)
    return false;

  // The tokens and the bridge's application key are httpOnly, so nothing
  // running in the page can read them, and the server takes them from the
  // cookies on each Hue request. The page only needs to know whether there's
  // a current access token and whether one can be refreshed, which the two
  // flags tell it. Lax keeps another site from posting to the Hue routes with
  // these cookies attached.
  let forever = 315360000000;

  res.cookie('hueAccessToken', auth.accessToken, { maxAge: auth.expiry, secure: true, httpOnly: true, sameSite: 'lax' });
  res.cookie('hueRefreshToken', auth.refreshTokenNew, { maxAge: forever, secure: true, httpOnly: true, sameSite: 'lax' });
  res.cookie('hueUsername', auth.usernameNew, { maxAge: forever, secure: true, httpOnly: true, sameSite: 'lax' });
  res.cookie('hueAccess', 'true', { maxAge: auth.expiry, secure: true, sameSite: 'lax' });
  res.cookie('hueLinked', 'true', { maxAge: forever, secure: true, sameSite: 'lax' });

  return true;
}

// Cookies first. The body is what pages from before 2.13.2 send, which only
// matters for someone whose cookies haven't been reissued as httpOnly yet.
function hueCredentials(req) {
  let cookies = readCookies(req.headers.cookie);
  let pick = (name, maxLength) => queryString(cookies[name], maxLength) || queryString(req.body[name], maxLength);

  return {
    accessToken: pick('hueAccessToken', 512),
    refreshToken: pick('hueRefreshToken', 512),
    username: pick('hueUsername', 128)
  };
}

async function authenticateHue(code, refreshToken, username) {
  if (!code && !refreshToken) {
    console.warn('Error authenticating with Hue: No authorization code or refresh token');
    return;
  }

  let clientId = process.env.HUE_CLIENT;
  let clientSecret = process.env.HUE_SECRET;
  if (!clientId || !clientSecret) {
    console.warn('Error authenticating with Hue: Missing client ID or secret');
    return;
  }

  let url = 'https://api.meethue.com/v2/oauth2/token';
  let auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  let headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${auth}`
  };

  // Both values come from the browser, so encode them rather than let a stray
  // & or = rewrite the token request
  let form = new URLSearchParams(code ?
    { 'code': code, 'grant_type': 'authorization_code' } :
    { 'refresh_token': refreshToken, 'grant_type': 'refresh_token' }).toString();

  const response = await fetch(url, {
    'method': 'post',
    'body': form,
    'headers': headers
  });

  if (!response.ok) {
    console.warn(`Error authenticating with Hue: Token failure: ${response.status} ${await response.text()}`);
    return;
  }

  let data = await response.json();
  let accessToken = data.access_token;
  let expiry = (parseInt(data.expires_in) - 300) * 1000;
  let refreshTokenNew = data.refresh_token;
  let tokenType = data.token_type;
  let usernameNew = await hueWhitelistApplication(accessToken, username);

  return { accessToken, expiry, refreshTokenNew, tokenType, usernameNew };
}

async function hueWhitelistApplication(accessToken, username) {
  if (username)
    return username;

  let url = 'https://api.meethue.com/route/api/0/config';
  let headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  let body = JSON.stringify({ linkbutton: true });

  const response = await fetch(url, {
    'method': 'put',
    'body': body,
    'headers': headers
  });

  if (!response.ok)
    console.warn(`Error allowlisting with Hue: ${response.status} ${await response.text()}`);

  url = 'https://api.meethue.com/route/api';
  body = JSON.stringify({ devicetype: 'Descent' });

  const response2 = await fetch(url, {
    'method': 'post',
    'body': body,
    'headers': headers
  });

  let data = await response2.json();

  return data[0].success.username;
}

// Hue API v2. The cloud gateway mirrors the local bridge under /route, so the
// same CLIP v2 resource paths work remotely with the app key as a header.
//
// Failures come back as { error } so the page can tell what to do about them:
// "expired" means the access token needs refreshing, and "unlinked" means the
// bridge no longer knows the application key, which only connecting again
// fixes. Returning an empty list for both used to leave the setup page with no
// rooms and no explanation.
async function hueRequest(accessToken, applicationKey, path, body) {
  if (!accessToken)
    return { error: 'expired' };

  if (!applicationKey)
    return { error: 'unlinked' };

  let url = `https://api.meethue.com/route/clip/v2/resource/${path}`;
  let headers = {
    'Authorization': `Bearer ${accessToken}`,
    'hue-application-key': applicationKey,
    'Content-Type': 'application/json'
  };

  let response;
  let data;

  try {
    response = await fetch(url, {
      'method': body ? 'put' : 'get',
      'body': body ? JSON.stringify(body) : undefined,
      'headers': headers,
      'signal': AbortSignal.timeout(8000)
    });

    data = await response.json();
  } catch (e) {
    console.warn(`Error calling Hue API: ${path}: ${e.name}`);
    return { error: 'unavailable' };
  }

  if (!response.ok) {
    console.warn(`Error calling Hue API: ${path}: ${response.status} ${JSON.stringify(data).slice(0, 200)}`);

    let errors = { 401: 'expired', 403: 'unlinked' };
    return { error: errors[response.status] || 'unavailable' };
  }

  return { data: data.data || [] };
}

function sendHueError(res, error) {
  res.status(error === 'unavailable' ? 502 : 401).json({ error });
}

app.post('/app/hue/api/rooms', async (req, res) => {
  let { accessToken, username } = hueCredentials(req);
  let rooms = await hueRequest(accessToken, username, 'room');

  if (rooms.error) {
    sendHueError(res, rooms.error);
    return;
  }

  res.json(rooms.data.map(room => ({ id: room.id, name: room.metadata?.name || 'Unnamed room' })));
});

// Rooms hold devices and devices expose light services, so the three resources
// get joined here to keep the display to a single request per update. Each
// light carries its own gamut, which the client needs to clamp colors properly.
app.post('/app/hue/api/lights', async (req, res) => {
  let { accessToken, username } = hueCredentials(req);
  let selected = (req.body.rooms || '').split(',').filter(room => room);

  let results = await Promise.all([
    hueRequest(accessToken, username, 'room'),
    hueRequest(accessToken, username, 'device'),
    hueRequest(accessToken, username, 'light')
  ]);
  let failed = results.find(result => result.error);

  if (failed) {
    sendHueError(res, failed.error);
    return;
  }

  let [rooms, devices, lights] = results.map(result => result.data);

  let deviceIds = new Set();
  for (let room of rooms)
    if (selected.includes(room.id))
      for (let child of room.children || [])
        if (child.rtype === 'device')
          deviceIds.add(child.rid);

  let lightIds = new Set();
  for (let device of devices)
    if (deviceIds.has(device.id))
      for (let service of device.services || [])
        if (service.rtype === 'light')
          lightIds.add(service.rid);

  // White-only bulbs reject a color payload but still take a color temperature,
  // so report each light's gamut and mirek range and let the display pick
  res.json(lights.filter(light => lightIds.has(light.id) && (light.color || light.color_temperature))
    .map(light => {
      let schema = light.color_temperature ? light.color_temperature.mirek_schema : undefined;

      return {
        id: light.id,
        gamut: light.color ? light.color.gamut : undefined,
        mirek: schema ? { min: schema.mirek_minimum, max: schema.mirek_maximum } : undefined
      };
    }));
});

app.post('/app/hue/api/light', async (req, res) => {
  let body;

  if (req.body.mirek !== undefined) {
    let mirek = parseInt(req.body.mirek);

    if (!Number.isFinite(mirek)) {
      console.warn(`Error setting Hue light: Invalid color temperature (${req.body.mirek})`);
      res.status(400).json([]);
      return;
    }

    body = { color_temperature: { mirek } };
  } else {
    let colorX = parseFloat(req.body.colorX);
    let colorY = parseFloat(req.body.colorY);

    if (!Number.isFinite(colorX) || !Number.isFinite(colorY)) {
      console.warn(`Error setting Hue light: Invalid color (${req.body.colorX}, ${req.body.colorY})`);
      res.status(400).json([]);
      return;
    }

    body = { color: { xy: { x: colorX, y: colorY } } };
  }

  let path = `light/${encodeURIComponent(req.body.id)}`;
  let { accessToken, username } = hueCredentials(req);
  let result = await hueRequest(accessToken, username, path, body);

  if (result.error) {
    sendHueError(res, result.error);
    return;
  }

  res.json(result.data);
});

/* Spotify functionality */

// Art now arrives with the track from the Last.fm proxy. These two are what
// pages from before 2.13.0 still ask, until they reload.
app.post('/app/spotify/track', async (req, res) => {
  let track = await spotify.searchTrack(String(req.body.artist || ''), String(req.body.title || ''),
    String(req.body.album || ''));

  res.json(track ? { ...track, success: true } : { success: false });
});

app.post('/app/spotify/artist', async (req, res) => {
  let id = queryString(req.body.artist, 64);
  let artist = id ? await spotify.getArtist(id) : null;

  res.json(artist ? { ...artist, success: true } : { success: false });
});

/* Weather (OpenWeatherMap) functionality */

if (!process.env.OPENWEATHERMAP_KEY)
  console.warn('No OpenWeatherMap key set, so weather will not show');

let weather = createWeather({ key: process.env.OPENWEATHERMAP_KEY });

app.post('/app/weather', async (req, res) => {
  res.json(await weather.get(req.body.latitude, req.body.longitude, req.body.units));
});

/* Application runtime */

app.listen(process.env.DESCENT_PORT || process.env.PORT || 3000);
