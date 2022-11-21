/* global resources, chroma, ColorThief, Cookies */
/* global clearColors, cookieEnabled, cookieExists, getHueColors, newTrack, nowPlaying, updateHue, updateMetadata */

function cacheImages() {
  // Set blank images as default
  resources.track.current.albumImage = getBlankImageData();
  resources.track.current.artistImage = getBlankImageData();

  // Set load status to false
  resources.track.current.albumImageLoaded = false;
  resources.track.current.artistImageLoaded = false;

  // Query Spotify for track info
  let url = '/app/spotify/track';
  let urlArtist = encodeURIComponent(resources.track.current.artist);
  let urlTitle = encodeURIComponent(resources.track.current.title);
  let body = `artist=${urlArtist}&title=${urlTitle}`;

  $.ajax({
    method: 'POST',
    url: url,
    data: body,
    timeout: 5000,
    success: data => {
      if (data && data.success && data.album && data.album.images && data.album.images[0]) {
        // Track info found - set and cache album image
        let albumUrl = data.album.images[0].url;

        let albumCache = new Image();
        albumCache.onload = () => {
          // Album image successfully loaded - update URL
          resources.track.current.albumImage = albumUrl;
          resources.track.current.albumImageLoaded = true;
          checkLoadStatus();
        }
        albumCache.onerror = () => {
          // Album image failed to load - leave default image
          resources.track.current.albumImageLoaded = true;
          checkLoadStatus();
        }
        albumCache.src = albumUrl;

        // Query Spotify for artist image
        let artistUrl = '/app/spotify/artist';
        let urlArtistId = encodeURIComponent(data.artists[0].id);
        let artistBody = `artist=${urlArtistId}`;

        $.ajax({
          method: 'POST',
          url: artistUrl,
          data: artistBody,
          timeout: 5000,
          success: data => {
            if (data && data.success && data.images && data.images[0]) {
              // Artist image found - set and cache
              let artistUrl = data.images[0].url;

              let artistCache = new Image();
              artistCache.onload = () => {
                // Artist image successfully loaded - update URL
                resources.track.current.artistImage = artistUrl;
                resources.track.current.artistImageLoaded = true;
                checkLoadStatus();
              }
              artistCache.onerror = () => {
                // Artist image failed to load - leave default image
                resource.track.current.artistImageLoaded = true;
                checkLoadStatus();
              }
              artistCache.src = artistUrl;
            } else {
              // Artist image not found - leave default
              resources.track.current.artistImageLoaded = true;
              checkLoadStatus();
            }
          },
          error: () => {
            // API request failed - leave default artist image
            resources.track.current.artistImageLoaded = true;
            checkLoadStatus();
          }
        });
      } else {
        // Track info not found - leave default album and artist images
        resources.track.current.albumImageLoaded = true;
        resources.track.current.artistImageLoaded = true;
        checkLoadStatus();
      }
    },
    error: () => {
      // API request failed - leave default album and artist images
      resources.track.current.albumImageLoaded = true;
      resources.track.current.artistImageLoaded = true;
      checkLoadStatus();
    }
  });
}

function clearImages() {
  // Clear cover and background images
  resources.track.current.artistImage = getBlankImageData();
  resources.track.current.albumImage = getBlankImageData();

  updateCover();
  updateBackground();
}

function getBlankImageData() {
  // Return data for a blank
  return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
}

function checkLoadStatus() {
  // Process images once loaded - update colors, lights, images, text
  if (resources.track.current.albumImageLoaded && resources.track.current.artistImageLoaded) {
    updateColors();
    updateCover();
    updateBackground();
    updateMetadata();
  }
}

function updateColors() {
  // Determine which image to use for colors
  let url;
  let albumImage = resources.track.current.albumImage;
  let artistImage = resources.track.current.artistImage;
  if (albumImage && albumImage !== getBlankImageData())
    url = albumImage;
  else if (artistImage && artistImage !== getBlankImageData())
    url = artistImage;

  if (url) {
    // Create image to get colors
    let img = new Image();
    img.onload = () => {
      // Get colors from Color Thief
      let colorThief = new ColorThief();
      let colors = colorThief.getPalette(img, 3);

      // Set colors from Color Thief
      resources.colors.regular = colors;
      resources.colors.hex = getHexColors();
      resources.colors.hue = getHueColors();

      // Update text and lights
      updateTextColors();
      updateHue();
    }
    img.onerror = () => {
      clearColors();
      updateHue();
    }
    img.crossOrigin = 'Anonymous';
    img.src = url;
  } else {
    // Clear colors
    clearColors();
    updateHue();
  }
}

function getHexColors() {
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

  // Return hex colors
  return hexColors;
}

function updateCover() {
  // Determine cover image url
  let url = getBlankImageData();
  let albumImage = resources.track.current.albumImage;
  if (albumImage && albumImage !== getBlankImageData())
    url = albumImage;

  // Apply cover image to preview if it exists
  if (url !== getBlankImageData())
    $('.music .cover').show();
  else
    $('.music .cover').hide();
  $('.music .cover').attr('src', url);
}

function updateBackground() {
  // Enable or disable blur
  let blur = !cookieExists('blur') || cookieEnabled('blur');
  $('.background').toggleClass('blur', blur);

  backgroundType = getBackgroundType();
  let albumImage = resources.track.current.albumImage;
  let artistImage = resources.track.current.artistImage;
  if (backgroundType == 'artist') {
    if (artistImage !== getBlankImageData()) {
      setBackground(artistImage);
    } else if (albumImage !== getBlankImageData()) {
      setBackground(albumImage);
    } else {
      setBackground(getDefaultBackground());
    }
  } else if (backgroundType == 'album') {
    if (albumImage !== getBlankImageData()) {
      setBackground(albumImage);
    } else if (artistImage !== getBlankImageData()) {
      setBackground(artistImage);
    } else {
      setBackground(getDefaultBackground());
    }
  } else if (backgroundType == 'transparent') {
    setBackground(getBlankImageData());
  } else {
    setBackground(getDefaultBackground());
  }
}

function getBackgroundType() {
  return cookieExists('background') ? Cookies.get('background') : 'artist';
}

function setBackground(background) {
  // Set background image
  $('.background').css('background-image', `url(${background})`);
}

function getDefaultBackground() {
  return Cookies.get('defaultBackground') || getBlankImageData();
}
