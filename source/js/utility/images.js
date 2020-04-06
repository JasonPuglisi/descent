/* global resources, chroma, ColorThief, Cookies */
/* global cookieEnabled, cookieExists, fetchHueColors, newTrack, nowPlaying, updateHue */

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

  // Update cover and artist images
  fetchTrackInfo((coverImageUrl, artistId) => {
    setCover(coverImageUrl);

    // Update background if type is artist
    if (getBackgroundType() === 'artist')
      fetchArtistImage(artistId, setBackground);
  });
}

function fetchTrackInfo(callback) {
  // Query Spotify for track info
  let url = '/now/app/spotify/track';
  let urlArtist = encodeURIComponent(resources.track.current.artist);
  let urlTitle = encodeURIComponent(resources.track.current.title);
  let body = `artist=${urlArtist}&title=${urlTitle}`;

  $.post(url, body, data => {
    // Return track info if found
    if (data && data.success && data.album.images.length > 0)
      return callback(data.album.images[0].url, data.artists[0].id);

    resetCover();
  }).fail(resetCover);
}

function fetchArtistImage(artistId, callback) {
  // Query Spotify for artist image
  let url = '/now/app/spotify/artist';
  let urlArtistId = encodeURIComponent(artistId);
  let body = `artist=${urlArtistId}`;

  $.post(url, body, data => {
    // Set background image if one is found
    if (data && data.success && data.images.length > 0)
      return callback(data.images[0].url);

    resetBackground();
  }).fail(resetBackground);
}

function setCover(cover) {
  // Set cover image
  $('.music .cover')[0].crossOrigin = 'Anonymous';
  updateCover(cover);
}

function resetCover() {
  // Clear/reset cover image
  $('.music .cover')[0].crossOrigin = null;
  updateCover();
}

function updateCover(cover) {
  // Determine cover image url
  let url = cover || getBlankImageData();

  // Enable or disable blur
  let blur = !cookieExists('blur') || cookieEnabled('blur');
  $('.background').toggleClass('blur', blur);

  // Load image before setting it in visible places
  resources.cover.onload = () => {
    // Apply cover image to background if required
    if (getBackgroundType() == 'album') {
      url = cover || getDefaultBackground();
      setBackground(url);
    }

    // Apply cover image to preview if it exists
    if (cover !== '')
      $('.music .cover').show();
    else
      $('.music .cover').hide();
    $('.music .cover').attr('src', url);
  };
  resources.cover.src = url;
}

function getBackground() {
  // Get background image CSS property (includes "url()")
  return $('.background').css('background-image');
}

function setBackground(background) {
  // Set background image
  if (getBackground().indexOf(background) == -1)
    $('.background').css('background-image', `url(${background})`);
}

function resetBackground() {
  let url;
  if (nowPlaying() && resources.cover.src && resources.cover.src !== getBlankImageData())
    url = resources.cover.src;
  else
    url = getDefaultBackground();
  setBackground(url);
}

function getBackgroundType() {
  return cookieExists('background') ? Cookies.get('background') : 'artist';
}

function hasCover() {
  // Determine if there's currently a cover image loaded
  return $('.cover')[0].src !== getBlankImageData();
}

function fetchColors() {
  // Stop if there's no cover image
  if (!hasCover()) {
    resetColors();
    return;
  }

  // Get colors from Color Thief
  let colorThief = new ColorThief();
  let colors = colorThief.getPalette($('.music .cover')[0], 2);

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
  $('.music .title').css('color', hexColors[0]);
  $('.music .artist').css('color', hexColors[1]);

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

function getDefaultBackground() {
  return Cookies.get('defaultBackground') || getBlankImageData();
}

function getBlankImageData() {
  return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
}
