import { getPaletteSync } from '../vendor/colorthief/index.browser.js';
import { brightenHex, getLuminance } from './color.js';
import { cookieEnabled, cookieExists, getCookie } from './cookies.js';
import { hide, show } from './general.js';
import { getHueColors, updateHue } from './hue.js';
import { clearColors, updateTextColors } from './metadata.js';
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

// Both images in the cache before either is shown, with the blank image
// standing in for any that's missing or won't load
export async function loadImages({ albumImage, artistImage }) {
  let [album, artist] = await Promise.all([preloadImage(albumImage), preloadImage(artistImage)]);

  return { albumImage: album, artistImage: artist };
}

export function showImages(current) {
  updateColors(current);
  updateCover();
  updateBackground();
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

  let palette = getPaletteSync(source, { colorCount: 3 });

  if (!palette || !palette.length) {
    clearColors();
    updateHue();
    return;
  }

  let colors = palette.map(color => color.array());

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
  return resources.colors.regular.map(color => brightenHex(color, 3 * (1 - getLuminance(color))));
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
