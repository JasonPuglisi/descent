import { cookieEnabled, cookieExists, getCookie } from './cookies.js';
import { toggleDisplay } from './general.js';
import { postForm } from './request.js';
import { resources } from './state.js';

let refreshMinutes = 5;

export async function initWeather() {
  let coords = await getCoordinates();

  if (!coords)
    return;

  updateWeather(coords);
  setInterval(() => { updateWeather(coords); }, refreshMinutes * 60000);
}

// Coordinates saved on the settings page win over asking the browser
function getCoordinates() {
  let latitude = getCookie('latitude');
  let longitude = getCookie('longitude');

  if (latitude && longitude)
    return Promise.resolve({ latitude, longitude });

  if (!navigator.geolocation)
    return Promise.resolve(undefined);

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(undefined));
  });
}

async function updateWeather(coords) {
  let units = cookieExists('units') ? getCookie('units') : 'imperial';
  let data = await postForm('/app/weather', { ...coords, units }, 5000);

  if (!data || !data.success)
    return;

  resources.features.weather = true;

  let weather = document.querySelector('.weather');
  weather.querySelector('.summary').textContent = data.summary;
  weather.querySelector('.conditions .temperature').textContent = data.temperature;
  weather.querySelector('.conditions .apparentTemperature').textContent = data.apparentTemperature;

  for (let unit of weather.querySelectorAll('.conditions .unit'))
    unit.textContent = data.unit;

  // Replace the icon classes outright. This used to remove the classes of
  // `this`, which inside an arrow function was never the icon, so every
  // condition seen since the page loaded stayed on the element.
  weather.querySelector('.conditions .icon').className = `icon ${data.icon}`;

  if (cookieEnabled('weatherOn') || !cookieExists('weatherOn'))
    toggleDisplay('.weather', true);
}
