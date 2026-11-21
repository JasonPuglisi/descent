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

  let rooms = (getCookie('hueRooms') || '').split(',').filter(room => room);

  if (!rooms.length)
    return;

  // Get the color-capable lights in the selected rooms, each with its own gamut
  let lights = await postForm('/app/hue/api/lights', { rooms: rooms.join(',') }, 5000);

  if (!Array.isArray(lights))
    return;

  lights.forEach((light, i) => {
    let color = colors[i % colors.length];
    let url = '/app/hue/api/light';

    if (light.gamut) {
      // Clamp against this light's gamut rather than one assumed for all of them
      let point = clampToGamut(color, light.gamut);

      postForm(url, { id: light.id, colorX: point.x, colorY: point.y }, 5000);
    } else if (light.mirek) {
      // White-only bulbs can still follow the warmth of the artwork
      postForm(url, { id: light.id, mirek: getMirek(color, light.mirek) }, 5000);
    }
  });
}

// The Hue tokens are in httpOnly cookies the page can't read, which the
// server uses on every Hue request. These two say whether there's a current
// access token and whether there's a refresh token to get a new one with.
export function hueAuthorized() {
  return cookieExists('hueAccess');
}

// Cookies from before 2.13.2 were readable, so a refresh token the page can
// see is one that still needs reissuing as httpOnly
export function hueRefreshable() {
  return cookieExists('hueLinked') || cookieExists('hueRefreshToken');
}

// Trade the refresh token for a new access token. The server reads the
// refresh token and bridge username from their cookies and sets new ones, so
// nothing secret goes through the page. The username matters: without it the
// server would register another application key on the bridge, which the now
// playing page used to do on every refresh.
export async function refreshHueToken() {
  if (!hueRefreshable())
    return false;

  let result = await postForm('/app/hue/authorize', {}, 10000);

  return Boolean(result && result.success) && hueAuthorized();
}
