/* global resources, chroma, Cookies */
/* global cookieEnabled, fetchHexColors, hasCover */

function fetchHueColors() {
  // Stop if cover is not present
  if (!hasCover()) {
    resetHueColors();
    return;
  }

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

  // Set colors from calculations
  setHueColors(hueColors);
}

function setHueColors(colors) {
  // Set Hue colors
  resources.colors.hue = colors;
  fetchHexColors();
}

function resetHueColors() {
  // Clear/reset Hue colors
  resources.colors.hue = [];
  fetchHexColors();
}

function updateHue() {
  // Stop if Hue functionality not enabled
  if (!cookieEnabled('hueEnabled'))
    return;

  // Set Hue credentials
  let ip = Cookies.get('hueIp');
  let username = Cookies.get('hueUsername');
  let rooms = Cookies.get('hueRooms').split(',');

  // Get light information from Hue
  let urlIp = encodeURIComponent(ip);
  let urlUsername = encodeURIComponent(username);
  let url = `http://${urlIp}/api/${urlUsername}/groups`;
  $.get(url, data => {
    // Loop through lights and colors for selected groups
    let lights = [];
    for (let i in rooms) {
      let room = data[rooms[i]];
      for (let j in room.lights) {
        lights.push(parseInt(room.lights[j]));
      }
    }

    let colors = resources.colors.hue;
    let colorIteration = 0;
    for (let k in lights) {
      let color = colors[colorIteration % colors.length];
      colorIteration++;

      // Prepare and send update message for each Hue light
      let id = lights[k];
      let urlId = encodeURIComponent(id);
      let url = encodeURI(`http://${urlIp}/api/${urlUsername}/lights/${urlId}/state`);
      let body = `{"xy": [${color.x},${color.y}]}`;
      $.ajax({
        url,
        type: 'PUT',
        data: body
      });
    }
  });

}
