/* global chroma, ColorThief */

import { cookieEnabled, cookieExists, getCookie } from './cookies.js';
import { hide, show } from './general.js';
import { getHueColors, updateHue } from './hue.js';
import { clearColors, updateMetadata, updateTextColors } from './metadata.js';
import { postForm } from './request.js';
import { resources } from './state.js';

let blankImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function loadImage(src, crossOrigin) {
  return new Promise((resolve, reject) => {
    let image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;

    if (crossOrigin)
      image.crossOrigin = crossOrigin;

    image.src = src;
  });
}

// Resolves to the URL once the image has loaded, so it's in the cache before
// it's shown, or to the blank image if it can't be found or won't load
async function preloadImage(url) {
  if (!url)
    return blankImage;

  try {
    await loadImage(url);
    return url;
  } catch {
    return blankImage;
  }
}

async function findAlbumImage() {
  let { artist, title, album } = resources.track.current;
  let track = await postForm('/app/spotify/track', { artist, title, album }, 5000);

  if (!track || !track.success)
    return {};

  return { albumUrl: track.album?.images?.[0]?.url, artistId: track.artists?.[0]?.id };
}

async function findArtistImage(artistId) {
  if (!artistId)
    return undefined;

  let artist = await postForm('/app/spotify/artist', { 'artist': artistId }, 5000);

  return artist && artist.success ? artist.images?.[0]?.url : undefined;
}

export async function cacheImages(current) {
  let track = resources.track.current;

  track.albumImage = blankImage;
  track.artistImage = blankImage;
  track.albumImageLoaded = false;
  track.artistImageLoaded = false;

  // The artist lookup needs the ID from the track lookup, but the album image
  // can start loading as soon as its URL is known
  let { albumUrl, artistId } = await findAlbumImage();
  let [albumImage, artistImage] = await Promise.all([
    preloadImage(albumUrl),
    findArtistImage(artistId).then(preloadImage)
  ]);

  if (!current())
    return;

  Object.assign(track, { albumImage, artistImage, albumImageLoaded: true, artistImageLoaded: true });

  updateColors(current);
  updateCover();
  updateBackground();
  updateMetadata();
}

export function clearImages() {
  resources.track.current.artistImage = blankImage;
  resources.track.current.albumImage = blankImage;

  updateCover();
  updateBackground();
}

async function updateColors(current) {
  let { albumImage, artistImage } = resources.track.current;
  let url = albumImage !== blankImage ? albumImage : artistImage;

  if (url === blankImage) {
    clearColors();
    updateHue();
    return;
  }

  let image;

  try {
    image = await loadImage(url, 'anonymous');
  } catch {
    if (current()) {
      clearColors();
      updateHue();
    }

    return;
  }

  let source = await maskBackground(image);

  if (!current())
    return;

  let colors = new ColorThief().getPalette(source, 3);

  resources.colors.regular = colors;
  resources.colors.hex = getHexColors();
  resources.colors.hue = getHueColors();

  updateTextColors();
  updateHue();
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

async function maskBackground(image) {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (!width || !height)
    return image;

  let canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  let context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);

  let pixels;

  try {
    pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    // Cross-origin art without CORS headers taints the canvas
    return image;
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
  if (kept < (data.length / 4) * maskMinimumFraction)
    return image;

  context.putImageData(pixels, 0, 0);

  return loadImage(canvas.toDataURL()).catch(() => image);
}

function getHexColors() {
  return resources.colors.regular.map(color => {
    let brightenFactor = 3 * (1 - chroma(color).luminance());

    return chroma(color).brighten(brightenFactor).hex();
  });
}

function updateCover() {
  let albumImage = resources.track.current.albumImage;
  let url = albumImage && albumImage !== blankImage ? albumImage : blankImage;

  if (url !== blankImage)
    show('.music .cover');
  else
    hide('.music .cover');

  document.querySelector('.music .cover').setAttribute('src', url);
}

function updateBackground() {
  let blur = !cookieExists('blur') || cookieEnabled('blur');
  document.querySelector('.background').classList.toggle('blur', blur);

  let backgroundType = getBackgroundType();
  let { albumImage, artistImage } = resources.track.current;

  // Each type falls back through the other image before the default
  let order = {
    'artist': [artistImage, albumImage],
    'album': [albumImage, artistImage]
  }[backgroundType];

  if (backgroundType === 'transparent')
    setBackground(blankImage);
  else if (order)
    setBackground(order.find(image => image && image !== blankImage) || getDefaultBackground());
  else
    setBackground(getDefaultBackground());
}

export function getBackgroundType() {
  return getCookie('background') || 'artist';
}

function setBackground(background) {
  document.querySelector('.background').style.backgroundImage = `url("${background}")`;
}

function getDefaultBackground() {
  return getCookie('defaultBackground') || blankImage;
}
