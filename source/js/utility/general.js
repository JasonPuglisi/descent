let wakeLock;

// Kiosks running this full screen shouldn't let the display sleep. The browser
// drops the lock whenever the page is hidden and never restores it on its own,
// so it has to be taken again on the way back rather than just once at startup.
export function initWakeLock() {
  if (!('wakeLock' in navigator))
    return;

  requestWakeLock();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
      requestWakeLock();
  });
}

async function requestWakeLock() {
  if (wakeLock || document.visibilityState !== 'visible')
    return;

  try {
    wakeLock = await navigator.wakeLock.request('screen');

    // The system can drop the lock on its own, usually on low battery
    wakeLock.addEventListener('release', () => {
      wakeLock = undefined;
    });
  } catch (e) {
    console.warn(`Error requesting wake lock: ${e.name}, ${e.message}`);
  }
}

let cursorDelay = 3;
let cursorTimeout = cursorDelay;

// Hide the cursor after a few idle seconds so it doesn't sit over the display
export function initCursor() {
  for (let event of ['click', 'contextmenu', 'mousemove'])
    document.body.addEventListener(event, showCursor);

  checkCursor();
  setInterval(checkCursor, 1000);
}

function checkCursor() {
  if (cursorTimeout > 0)
    cursorTimeout--;
  else
    document.body.style.cursor = 'none';
}

function showCursor() {
  cursorTimeout = cursorDelay;
  document.body.style.cursor = 'auto';
}

export function show(selector, visible = true) {
  for (let element of document.querySelectorAll(selector))
    element.classList.toggle('hide', !visible);
}

export function hide(selector) {
  show(selector, false);
}

let fadeDuration = 750;
let fades = new WeakMap();

// Fade elements in or out, or flip them when show is left undefined. Each
// element remembers where its last fade was headed, so toggling mid-fade
// reverses it from wherever the opacity has got to rather than reading the
// element as still visible and fading it out a second time.
export function toggleDisplay(selector, show) {
  for (let element of document.querySelectorAll(selector)) {
    let fade = fades.get(element);
    // Only the element's own display counts, as with jQuery. Going by layout
    // would read a child of a hidden parent as already hidden and leave it
    // showing for whenever the parent comes back. The hide class counts even
    // before the stylesheet that defines it applies, which Safari doesn't wait
    // for before running modules, or a fast first answer read as already
    // showing and never faded in.
    let visible = fade ? fade.visible :
      !element.classList.contains('hide') && getComputedStyle(element).display !== 'none';
    let target = show === undefined ? !visible : Boolean(show);

    if (fade && fade.visible === target)
      continue;

    if (!fade && visible === target)
      continue;

    fadeElement(element, target);
  }
}

function fadeElement(element, visible) {
  let fade = fades.get(element);
  let from = visible ? 0 : 1;

  if (fade) {
    from = parseFloat(getComputedStyle(element).opacity);
    fade.animation.cancel();
  }

  element.classList.remove('hide');

  let animation = element.animate([{ 'opacity': from }, { 'opacity': visible ? 1 : 0 }],
    { 'duration': fadeDuration * Math.abs((visible ? 1 : 0) - from), 'easing': 'linear', 'fill': 'forwards' });

  fades.set(element, { animation, visible });

  // Hold the final opacity until the class has flipped, then let go of it so
  // the stylesheet is back in charge
  animation.finished.then(() => {
    fades.delete(element);
    element.classList.toggle('hide', !visible);
    animation.cancel();
  }, () => {});
}

// Options on the settings pages are buttons that stay pressed while they're
// on, so the state goes in aria-pressed as well as the class that styles it
export function setPressed(element, pressed) {
  element.classList.toggle('selected', pressed);
  element.setAttribute('aria-pressed', String(pressed));
}
