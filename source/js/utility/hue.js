import { clampToGamut, colorsChanged, getHuePoint, getMirek } from './color.js';
import { cookieEnabled, cookieExists, getCookie } from './cookies.js';
import { postForm } from './request.js';
import { resources } from './state.js';

export function getHueColors() {
  // Convert each color to a point the lights can actually reproduce
  let colors = resources.colors.regular;

  return colors.map(getHuePoint);
}

export async function updateHue() {
  if (!cookieEnabled('hueEnabled'))
    return;

  let colors = resources.colors.hue;

  if (!colorsChanged(resources.colors.last, colors))
    return;

  resources.colors.last = colors;

  if (cookieEnabled('shuffle')) {
    colors = colors
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
  }

  let accessToken = getCookie('hueAccessToken');
  let username = getCookie('hueUsername');
  let rooms = (getCookie('hueRooms') || '').split(',').filter(room => room);

  if (!rooms.length)
    return;

  // Get the color-capable lights in the selected rooms, each with its own gamut
  let lights = await postForm('/app/hue/api/lights', { accessToken, username, rooms: rooms.join(',') }, 5000);

  if (!Array.isArray(lights))
    return;

  lights.forEach((light, i) => {
    let color = colors[i % colors.length];
    let url = '/app/hue/api/light';

    if (light.gamut) {
      // Clamp against this light's gamut rather than one assumed for all of them
      let point = clampToGamut(color, light.gamut);

      postForm(url, { accessToken, username, id: light.id, colorX: point.x, colorY: point.y }, 5000);
    } else if (light.mirek) {
      // White-only bulbs can still follow the warmth of the artwork
      postForm(url, { accessToken, username, id: light.id, mirek: getMirek(color, light.mirek) }, 5000);
    }
  });
}

// Trade the refresh token for a new access token. The server answers with
// cookies and a redirect to the setup page, so the redirect isn't followed;
// whether it worked is down to whether an access token cookie came back.
//
// The username has to go along whenever there is one. Without it the server
// treats this as a first connection and registers another application key on
// the bridge, which the now playing page used to do on every refresh.
export async function refreshHueToken() {
  let refreshToken = getCookie('hueRefreshToken');
  let username = getCookie('hueUsername');

  if (!refreshToken)
    return false;

  let params = new URLSearchParams({ refreshToken });

  if (username)
    params.set('username', username);

  try {
    await fetch(`/app/hue/authorize?${params}`, { 'redirect': 'manual' });
  } catch {
    return false;
  }

  return cookieExists('hueAccessToken');
}
