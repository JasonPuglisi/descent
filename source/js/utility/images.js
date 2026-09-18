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
  let urlAlbum = encodeURIComponent(resources.track.current.album);
  let body = `artist=${urlArtist}&title=${urlTitle}&album=${urlAlbum}`;

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
                resources.track.current.artistImageLoaded = true;
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
      maskBackground(img, source => {
        // Get colors from Color Thief
        let colorThief = new ColorThief();
        let colors = colorThief.getPalette(source, 3);

        // Set colors from Color Thief
        resources.colors.regular = colors;
        resources.colors.hex = getHexColors();
        resources.colors.hue = getHueColors();

        // Update text and lights
        updateTextColors();
        updateHue();
      });
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

// Album art usually sits on a white or black field, and those pixels drag the
// palette toward grey. Color Thief skips anything below 125 alpha, so masking
// the background out leaves it clustering only the artwork. Everything else
// about the extraction stays as it was.
let maskNearWhite = 230;
let maskNearBlack = 25;
let maskLuminanceFloor = 40;
let maskSaturatedChannelGap = 30;
let maskMinimumFraction = 0.01;

function maskBackground(image, callback) {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (!width || !height) {
    callback(image);
    return;
  }

  let canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  let context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);

  let pixels;

  try {
    pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  } catch (e) {
    // Cross-origin art without CORS headers taints the canvas
    callback(image);
    return;
  }

  let data = pixels.data;
  let kept = 0;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    let luminance = (r * 299 + g * 587 + b * 114) / 1000;

    // The luminance floor clears shadow that would otherwise skew the palette,
    // but it weights blue at only 114/1000, so a saturated deep blue reads as
    // shadow and would be thrown away with it. Colorful pixels are exempt.
    let channelGap = Math.max(r, g, b) - Math.min(r, g, b);

    if ((r > maskNearWhite && g > maskNearWhite && b > maskNearWhite) ||
        (r < maskNearBlack && g < maskNearBlack && b < maskNearBlack) ||
        (luminance < maskLuminanceFloor && channelGap <= maskSaturatedChannelGap))
      data[i + 3] = 0;
    else
      kept++;
  }

  // Very dark or very pale covers can lose almost everything, and clustering a
  // handful of survivors is worse than clustering the whole image
  if (kept < (data.length / 4) * maskMinimumFraction) {
    callback(image);
    return;
  }

  context.putImageData(pixels, 0, 0);

  let masked = new Image();
  masked.onload = () => callback(masked);
  masked.onerror = () => callback(image);
  masked.src = canvas.toDataURL();
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
