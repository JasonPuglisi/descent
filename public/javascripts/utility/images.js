function fetchImages() {
  // Reset display if not playing
  if (!nowPlaying()) {
    resetCover();
    resetBackground();
    return;
  }

  // Stop if track has not changed
  if (!newTrack())
    return;

  // Check for cover from Last.fm, and fallback to Spotify
  if (resources.track.current.cover)
    setCover(`/now/app/cover?url=${resources.track.current.cover}`);
  else {
    let query = `${resources.track.current.artist} - ${resources.track.current.title}`;
    let url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;
    $.get(url, data => {
      // Set cover image if one is found
      if (data.tracks.total > 0)
        setCover(data.tracks.items[0].album.images[0].url);
      else
        resetCover();
    }).fail(resetCover);
  }

  // Stop if track has changed and background type is not artist
  if (resources.state.background !== 'artist')
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
  resources.images.cover = cover;
  updateCover();
}

function resetCover() {
  // Clear/reset cover image
  $('#music #cover')[0].crossOrigin = null;
  resources.images.cover = '';
  updateCover();
}

function updateCover() {
  // Determine cover image url
  var url = resources.images.cover || resources.images.blank;

  // Load image before setting it in visible places
  resources.state.cover.onload = () => {
    // Apply cover image to background if required
    if (resources.state.background == 'album')
      $('#background').css('background-image', `url(${url}`);

    // Apply cover image to preview if it exists
    if (hasCover())
      $('#music #cover').show();
    else
      $('#music #cover').hide();
    $('#music #cover').attr('src', url);
  };
  resources.state.cover.src = url;
}

function resetBackground() {
  $('#background').css('background-image', `url(${resources.images.blank})`);
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
