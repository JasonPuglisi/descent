/* global chroma */

import { cookieEnabled, cookieExists, getCookie } from './cookies.js';
import { postForm } from './request.js';
import { resources } from './state.js';

// CIE xy corners of the Hue Gamut C triangle, which covers every current color
// bulb. Values come from the v2 API reference rather than the color conversion
// page, which transposes the red y coordinate. Each light reports its own gamut
// and that wins when present, so this is only the fallback.
let hueGamut = {
  red: { x: 0.6915, y: 0.3083 },
  green: { x: 0.1700, y: 0.7000 },
  blue: { x: 0.1532, y: 0.0475 }
};

export function getHueColors() {
  // Convert each color to a point the lights can actually reproduce
  let colors = resources.colors.regular;

  return colors.map(getHuePoint);
}

// Philips' documented RGB to xy conversion: undo sRGB gamma, convert with the
// sRGB D65 matrix, then pull anything outside the gamut onto the triangle.
// Their iOS sample uses a wide gamut matrix instead, which oversaturates and
// shifts hue because album art is sRGB.
function getHuePoint(color) {
  // Undo sRGB gamma encoding to get linear light
  let rgb = chroma(color).gl().slice(0, 3).map(channel =>
    channel > 0.04045 ? Math.pow((channel + 0.055) / 1.055, 2.4) : channel / 12.92);

  // Convert linear RGB to CIE XYZ
  let x = rgb[0] * 0.4124 + rgb[1] * 0.3576 + rgb[2] * 0.1805;
  let y = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  let z = rgb[0] * 0.0193 + rgb[1] * 0.1192 + rgb[2] * 0.9505;

  let sum = x + y + z;

  // Black has no chromaticity, so anchor it to the D65 white point instead of
  // dividing by zero and sending the bridge a NaN it can't parse
  if (sum === 0)
    return { x: 0.3127, y: 0.3290 };

  return { x: x / sum, y: y / sum };
}

// Colors outside the gamut get clamped by the bridge in ways we don't control,
// so pick the nearest reproducible point ourselves
function clampToGamut(point, gamut) {
  gamut = gamut || hueGamut;

  if (inGamut(point, gamut))
    return point;

  let edges = [
    closestPointOnEdge(gamut.red, gamut.green, point),
    closestPointOnEdge(gamut.green, gamut.blue, point),
    closestPointOnEdge(gamut.blue, gamut.red, point)
  ];

  return edges.reduce((closest, edge) =>
    getDistance(point, edge) < getDistance(point, closest) ? edge : closest);
}

function inGamut(point, gamut) {
  let v1 = { x: gamut.green.x - gamut.red.x, y: gamut.green.y - gamut.red.y };
  let v2 = { x: gamut.blue.x - gamut.red.x, y: gamut.blue.y - gamut.red.y };
  let q = { x: point.x - gamut.red.x, y: point.y - gamut.red.y };

  let divisor = getCrossProduct(v1, v2);
  let s = getCrossProduct(q, v2) / divisor;
  let t = getCrossProduct(v1, q) / divisor;

  return s >= 0 && t >= 0 && s + t <= 1;
}

function getCrossProduct(a, b) {
  return a.x * b.y - a.y * b.x;
}

function closestPointOnEdge(start, end, point) {
  let toPoint = { x: point.x - start.x, y: point.y - start.y };
  let edge = { x: end.x - start.x, y: end.y - start.y };
  let length = edge.x * edge.x + edge.y * edge.y;
  let position = Math.min(1, Math.max(0, (toPoint.x * edge.x + toPoint.y * edge.y) / length));

  return { x: start.x + edge.x * position, y: start.y + edge.y * position };
}

function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Planckian locus chromaticity, using Kim et al.'s cubic approximation
function getPlanckianPoint(temperature) {
  let x = temperature <= 4000 ?
    -0.2661239e9 / Math.pow(temperature, 3) - 0.2343589e6 / Math.pow(temperature, 2) +
      0.8776956e3 / temperature + 0.179910 :
    -3.0258469e9 / Math.pow(temperature, 3) + 2.1070379e6 / Math.pow(temperature, 2) +
      0.2226347e3 / temperature + 0.240390;
  let y;

  if (temperature <= 2222)
    y = -1.1063814 * Math.pow(x, 3) - 1.34811020 * Math.pow(x, 2) + 2.18555832 * x - 0.20219683;
  else if (temperature <= 4000)
    y = -0.9549476 * Math.pow(x, 3) - 1.37418593 * Math.pow(x, 2) + 2.09137015 * x - 0.16748867;
  else
    y = 3.0817580 * Math.pow(x, 3) - 5.87338670 * Math.pow(x, 2) + 3.75112997 * x - 0.37001483;

  return { x, y };
}

// Color temperature is defined by distance to the Planckian locus in CIE 1960
// UCS, so distances have to be measured there rather than in xy
function getUcsPoint(point) {
  let divisor = -2 * point.x + 12 * point.y + 3;

  return { u: 4 * point.x / divisor, v: 6 * point.y / divisor };
}

// Pick the white this bulb can actually produce that sits closest to the color.
// CIE only treats a color temperature as meaningful within 0.05 of the locus in
// UCS, and saturated artwork sits far outside that, so this is deliberately
// nearest-producible-white rather than a claim about the color's temperature.
// Searching the bulb's own range also avoids closed-form fits like McCamy's,
// which hold only from roughly 2856K to 6500K near the locus and return negative
// temperatures for the colors album art routinely produces.
function getMirek(point, range) {
  let target = getUcsPoint(point);
  let closest = range.min;
  let shortest = Infinity;

  for (let mirek = range.min; mirek <= range.max; mirek++) {
    let candidate = getUcsPoint(getPlanckianPoint(1000000 / mirek));
    let distance = Math.hypot(candidate.u - target.u, candidate.v - target.v);

    if (distance < shortest) {
      shortest = distance;
      closest = mirek;
    }
  }

  return closest;
}

function colorsChanged(last, current) {
  if (last === undefined)
    return true;

  if (last.length !== current.length)
    return true;

  return last.some((color, i) => color.x !== current[i].x || color.y !== current[i].y);
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
