/* global resources, chroma, Cookies */
/* global cookieEnabled, fetchHexColors, hasCover */

// CIE xy corners of the Hue Gamut C triangle, which covers every current
// color bulb. API v2 reports the real gamut per light, which would beat
// assuming this one for older Gamut A/B hardware.
let hueGamut = {
  red: { x: 0.6915, y: 0.3038 },
  green: { x: 0.1700, y: 0.7000 },
  blue: { x: 0.1532, y: 0.0475 }
};

function getHueColors() {
  // Get regular colors
  let colors = resources.colors.regular;
  let hueColors = [];

  // Convert each color to a point the lights can actually reproduce
  for (let i in colors)
    hueColors.push(getHuePoint(colors[i]));

  // Return hue colors
  return hueColors;
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

  return clampToGamut({ x: x / sum, y: y / sum });
}

// Colors outside the gamut get clamped by the bridge in ways we don't control,
// so pick the nearest reproducible point ourselves
function clampToGamut(point) {
  if (inGamut(point))
    return point;

  let edges = [
    closestPointOnEdge(hueGamut.red, hueGamut.green, point),
    closestPointOnEdge(hueGamut.green, hueGamut.blue, point),
    closestPointOnEdge(hueGamut.blue, hueGamut.red, point)
  ];

  return edges.reduce((closest, edge) =>
    getDistance(point, edge) < getDistance(point, closest) ? edge : closest);
}

function inGamut(point) {
  let v1 = { x: hueGamut.green.x - hueGamut.red.x, y: hueGamut.green.y - hueGamut.red.y };
  let v2 = { x: hueGamut.blue.x - hueGamut.red.x, y: hueGamut.blue.y - hueGamut.red.y };
  let q = { x: point.x - hueGamut.red.x, y: point.y - hueGamut.red.y };

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

function colorsChanged(last, current) {
  if (last == undefined)
    return true;

  if (last.length !== current.length)
    return true;

  return last.some((color, i) => color.x !== current[i].x || color.y !== current[i].y);
}

function updateHue() {
  // Stop if Hue functionality not enabled
  if (!cookieEnabled('hueEnabled'))
    return;

  // Stop if colors have not changed, or prepare and shuffle colors
  let colors = resources.colors.hue;
  let lastColors = resources.colors.last;
  if (!colorsChanged(lastColors, colors)) {
    return;
  } else {
    resources.colors.last = colors;
    if (cookieEnabled('shuffle')) {
      colors = colors
        .map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value);
    }
  }

  // Set Hue credentials
  let accessToken = Cookies.get('hueAccessToken');
  let username = Cookies.get('hueUsername');
  let rooms = (Cookies.get('hueRooms') || '').split(',').filter(room => room);

  if (!rooms.length)
    return;

  // Get light information from Hue
  let url = '/app/hue/api/groups';
  $.post(url, { accessToken, username }, data => {
    // Loop through lights and colors for selected groups
    let lights = [];
    for (let i in rooms) {
      let room = data[rooms[i]];
      for (let j in room.lights) {
        lights.push(parseInt(room.lights[j]));
      }
    }

    let colorIteration = 0;
    for (let k in lights) {
      let color = colors[colorIteration % colors.length];
      colorIteration++;

      // Prepare and send update message for each Hue light
      let id = lights[k];
      let colorX = color.x;
      let colorY = color.y;

      // Send state request
      let url = '/app/hue/api/light';
      $.post(url, { accessToken, username, id, colorX, colorY });
    }
  });
}
