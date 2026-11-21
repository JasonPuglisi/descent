// Loaded into the server with `node --import`, this answers every upstream
// API call from memory, so the real server can run in a browser test without
// keys or network. A small control server lets the test change what's playing.
//
//   POST /track   { title, artist, album, playing }   change the track
//   POST /delay   { spotify }                          slow Spotify down, up to 10 s
//   GET  /calls                                       upstream calls so far

import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';

let state = {
  track: { artist: 'Taio Cruz', title: 'Higher', album: 'Rokstarr', playing: true },
  spotifyDelay: 0,
  calls: []
};

// A solid square as a PNG data URL. The page's CSP allows data: images, and
// Color Thief can read them without CORS, so the colors come through.
function png(r, g, b, size = 16) {
  let crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++)
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = buffer => {
    let c = 0xffffffff;
    for (let byte of buffer)
      c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  let chunk = (type, data) => {
    let length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    let body = Buffer.concat([Buffer.from(type), data]);
    let check = Buffer.alloc(4);
    check.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, check]);
  };

  let header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;

  let row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(size).fill([r, g, b]).flat())]);
  let pixels = deflateSync(Buffer.concat(Array(size).fill(row)));

  let file = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', pixels), chunk('IEND', Buffer.alloc(0))]);

  return `data:image/png;base64,${file.toString('base64')}`;
}

let albumArt = png(220, 40, 60);
let artistArt = png(40, 90, 220);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function lastfm(url) {
  let method = url.searchParams.get('method');
  let { track } = state;

  if (method === 'user.getrecenttracks') {
    return json({
      recenttracks: {
        'track': [{
          'artist': { '#text': track.artist },
          'album': { '#text': track.album },
          'name': track.title,
          'url': `https://www.last.fm/music/${encodeURIComponent(track.artist)}/_/${encodeURIComponent(track.title)}`,
          ...(track.playing ? { '@attr': { nowplaying: 'true' } } : {})
        }],
        '@attr': { user: url.searchParams.get('user'), total: '287137' }
      }
    });
  }

  if (method === 'artist.getInfo')
    return json({ artist: { stats: { userplaycount: '120' } } });

  return json({ track: { userplaycount: '7', userloved: '1' } });
}

async function spotify(url) {
  if (state.spotifyDelay)
    await new Promise(resolve => setTimeout(resolve, state.spotifyDelay));

  if (url.hostname === 'accounts.spotify.com')
    return json({ 'access_token': 'fake', 'expires_in': 3600 });

  if (url.pathname === '/v1/search') {
    return json({ tracks: { items: [{
      name: state.track.title,
      artists: [{ name: state.track.artist, id: 'artist' }],
      album: { name: state.track.album, images: [{ url: albumArt }] }
    }] } });
  }

  return json({ id: 'artist', images: [{ url: artistArt }] });
}

function weather() {
  return json({ weather: [{ description: 'clear sky', icon: '01d' }], main: { 'temp': 71.6, 'feels_like': 72.4 }, wind: { speed: 5 } });
}

let realFetch = globalThis.fetch;

globalThis.fetch = async (input, options) => {
  let url = new URL(typeof input === 'string' ? input : input.url);
  let handlers = {
    'ws.audioscrobbler.com': lastfm,
    'accounts.spotify.com': spotify,
    'api.spotify.com': spotify,
    'api.openweathermap.org': weather
  };

  if (!handlers[url.hostname])
    return realFetch(input, options);

  state.calls.push(`${url.hostname}${url.pathname} ${url.searchParams.get('method') || ''}`.trim());
  return handlers[url.hostname](url);
};

// Every upstream needs a key to be called at all. Hue isn't faked, since the
// tests never connect an account, but its page needs a client ID to render.
process.env.LASTFM_API_KEY ||= 'fake';
process.env.SPOTIFY_CLIENT ||= 'fake';
process.env.SPOTIFY_SECRET ||= 'fake';
process.env.OPENWEATHERMAP_KEY ||= 'fake';
process.env.HUE_CLIENT ||= 'fake';
process.env.HUE_SECRET ||= 'fake';

createServer((req, res) => {
  let body = '';
  req.on('data', data => { body += data; });
  req.on('end', () => {
    let fields = body ? JSON.parse(body) : {};

    if (req.url === '/track')
      Object.assign(state.track, fields);
    else if (req.url === '/delay')
      state.spotifyDelay = Math.min(Math.max(Number(fields.spotify) || 0, 0), 10000);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/calls' ? state.calls : state.track));
  });
// Only this machine, since anything that can reach it can change what the
// server thinks is playing
}).listen(process.env.DESCENT_FAKE_PORT || 3999, '127.0.0.1');
