function fetchImages() {
  // Reset display if not playing
  if (!nowPlaying()) {
    resetCover();
    resetBackground();
    newTrack();
    return;
  }

  // Stop if track has not changed
  if (!newTrack())
    return;

  // Check for cover from Last.fm, and fallback to Spotify
  if (resources.track.current.cover)
    setCover(`/now/app/cover?url=${resources.track.current.cover}`);
  else {
    let url = '/now/app/spotify/track';
    let body = `artist=${resources.track.current.artist}&title=${resources.track.current.title}`;

    $.post(url, body, data => {
      // Perform no action if unsuccessful
      if (!data.success) {
        resetCover();
        return;
      }

      // Set cover image if one is found
      setCover(data.album.images[0].url);
    }).fail(resetCover);
  }

  // Stop if track has changed and background type is not artist
  if (getBackgroundType() !== 'artist')
    return;

  // Query Last.fm for artist information
  let artistId = resources.track.current.artistId;
  let key = 'c1797de6bf0b7e401b623118120cd9e1';
  let url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&mbid=${artistId}&api_key=${key}&format=json`;
  $.get(url, data => {
    // Set artist image if one is found
    if (data.artist) {
      let img = data.artist.image[data.artist.image.length - 1]['#text'];
      $('#background').css('background-image', `url(${img})`);
    } else
      resetBackground();
  }).fail(resetBackground);
}

function setCover(cover) {
  // Set cover image
  $('#music #cover')[0].crossOrigin = 'Anonymous';
  updateCover(cover);
}

function resetCover() {
  // Clear/reset cover image
  $('#music #cover')[0].crossOrigin = null;
  updateCover('');
}

function updateCover(cover) {
  // Determine cover image url
  var url = cover || getBlankImageData();

  // Load image before setting it in visible places
  resources.cover.onload = () => {
    // Apply cover image to background if required
    if (getBackgroundType() == 'album')
      $('#background').css('background-image', `url(${url}`);

    // Apply cover image to preview if it exists
    if (cover !== '')
      $('#music #cover').show();
    else
      $('#music #cover').hide();
    $('#music #cover').attr('src', url);
  };
  resources.cover.src = url;
}

function resetBackground() {
  $('#background').css('background-image', `url(${getBlankImageData()})`);
}

function getBackgroundType() {
  return cookieExists('background') ? Cookies.get('background') : 'album';
}

function hasCover() {
  // Determine if there's currently a cover image loaded
  return $('#cover')[0].src !== getBlankImageData();
}

function fetchColors() {
  // Stop if there's no cover image
  if (!hasCover()) {
    resetColors();
    return;
  }

  // Get colors from Color Thief
  let colorThief = new ColorThief();
  let colors = colorThief.getPalette($('#music #cover')[0], 2);

  // Set colors from Color Thief
  setColors(colors);
}

function fetchHexColors() {
  // Stop if cover image not present
  if (!hasCover()) {
    resetHexColors();
    return;
  }

  // Get regular colors
  let colors = resources.colors.regular;
  let hexColors = [];

  // Loop through regular colors
  for (let i = 0; i < colors.length; i++) {
    // Brighten and get hex values
    let color = colors[i];
    let brightenFactor = 3 * (1 - chroma(color).luminance());
    let hex = chroma(color).brighten(brightenFactor).hex();

    // Add retreived value to hex color array
    hexColors.push(hex);
  }

  // Set hex colors
  setHexColors(hexColors);
}

function setHexColors(colors) {
  // Set hex colors
  resources.colors.hex = colors;
  updateColors();
}

function resetHexColors() {
  // Clear/reset hex colors
  resources.colors.hex = [];
  updateColors();
}

function updateColors() {
  // Set color arrays
  let hexColors;
  let hueColors;

  if (hasCover()) {
    // Update color arrays with determined values
    hexColors = resources.colors.hex;
  } else {
    // Update color arrays with default values
    hexColors = [ '#f6f5f7', '#f6f5f7' ];
    hueColors = [ { x: (1 / 3), y: (1 / 3) } ];

    resources.colors.hex = hexColors;
    resources.colors.hue = hueColors;
  }

  // Update text colors
  $('#music #title').css('color', hexColors[0]);
  $('#music #artist').css('color', hexColors[1]);

  // Update Hue lights
  updateHue();
}

function setColors(colors) {
  // Set colors
  resources.colors.regular = colors;
  fetchHueColors();
}

function resetColors() {
  // Clear/reset colors
  resources.colors.regular = [];
  fetchHueColors();
}

function getBlankImageData() {
  return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
}
