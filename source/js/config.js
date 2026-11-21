import { cookieEnabled, cookieExists, getCookie, setCookie } from './utility/cookies.js';
import { hide, setPressed, show } from './utility/general.js';

processBackground();
processScrobbleMode();
processLocation();
processUnits();
processDatetime();

// A row of mutually exclusive options, each with an ID ending in its value,
// like #bg-artist, saved to one cookie
function processChoice(group, name, fallback) {
  let options = document.querySelectorAll(`.selectGroup.${group}`);
  let selected = getCookie(name) || fallback;

  for (let option of options) {
    let value = option.id.substring(option.id.lastIndexOf('-') + 1);

    setPressed(option, value === selected);
    option.addEventListener('click', () => {
      for (let other of options)
        setPressed(other, other === option);

      setCookie(name, value);
    });
  }
}

// A single on/off option saved to its own cookie
function processToggle(element, name, enabled) {
  setPressed(element, enabled);
  element.addEventListener('click', () => {
    enabled = !enabled;
    setPressed(element, enabled);
    setCookie(name, enabled);
  });
}

function processBackground() {
  processChoice('groupBg', 'background', 'artist');
  processToggle(document.querySelector('#bgopt-blur'), 'blur', !cookieExists('blur') || cookieEnabled('blur'));

  let input = document.querySelector('#bgopt-default');
  input.value = getCookie('defaultBackground') || '';
  input.addEventListener('input', () => show('.backgroundInputSave'));

  document.querySelector('.backgroundInputSave').addEventListener('click', () => {
    hide('.backgroundInputSave');
    setCookie('defaultBackground', input.value);
  });
}

function processScrobbleMode() {
  processChoice('groupScrobbleMode', 'scrobbleMode', 'currentlyPlaying');
}

function validateCoordinate(coordinate) {
  return /^(-?\d+\.\d+)?$/.test(coordinate);
}

function processLocation() {
  let latitude = document.querySelector('#loc-latitude');
  let longitude = document.querySelector('#loc-longitude');

  latitude.value = getCookie('latitude') || '';
  longitude.value = getCookie('longitude') || '';

  // Only offer to save a pair that's either both set and valid, or both empty
  let updateSave = () => {
    let valid = !latitude.value === !longitude.value &&
      validateCoordinate(latitude.value) && validateCoordinate(longitude.value);

    show('.locationInputSave', valid);
  };

  latitude.addEventListener('input', updateSave);
  longitude.addEventListener('input', updateSave);

  document.querySelector('.locationInputSave').addEventListener('click', () => {
    hide('.locationInputSave');
    setCookie('latitude', latitude.value);
    setCookie('longitude', longitude.value);
  });
}

function processUnits() {
  processChoice('groupUnits', 'units', 'imperial');
}

function processDatetime() {
  for (let option of ['24hr', 'weekday', 'seconds'])
    processToggle(document.querySelector(`#datetime-${option}`), option, cookieEnabled(option));
}
