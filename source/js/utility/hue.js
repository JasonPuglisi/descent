/* global resources, chroma, Cookies */
/* global cookieEnabled, fetchHexColors, hasCover */

function getHueColors() {
  // Get regular colors
  let colors = resources.colors.regular;
  let hueColors = [];

  // Loop through regular colors
  for (let i in colors) {
    // Get GL values
    let color = chroma(colors[i]).gl();
    for (let j in color)
      color[j] = color[j] > 0.04045 ? Math.pow((color[j] + 0.055) / 1.055, 2.4) : color[j] / 12.92;

    // Calculate XYZ values for Hue
    let x = color[0] * 0.664511 + color[1] * 0.154324 + color[2] * 0.162028;
    let y = color[0] * 0.283881 + color[1] * 0.668433 + color[2] * 0.047685;
    let z = color[0] * 0.000088 + color[1] * 0.072310 + color[2] * 0.986039;

    // Calculate XY values
    let finalX = x / (x + y + z);
    let finalY = y / (x + y + z);

    // Add calculated values to Hue color array
    hueColors.push({ x: finalX, y: finalY });
  }

  // Return hue colors
  return hueColors;
}

function colorsChanged(last, current) {
  if (last == undefined)
    return true;

  return !(last[0].x == current[0].x && last[0].y == current[0].y &&
    last[1].x == current[1].x && last[1].y == current[1].y &&
    last[2].x == current[2].x && last[2].y == current[2].y);
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
  let rooms = Cookies.get('hueRooms').split(',');

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
