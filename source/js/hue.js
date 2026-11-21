import { cookieEnabled, getCookie, removeCookie, setCookie } from './utility/cookies.js';
import { hide, show } from './utility/general.js';
import { refreshHueToken } from './utility/hue.js';
import { postForm } from './utility/request.js';

let roomPrefix = 'select-group-rooms-';

loadAuthorization();
processOptions();

async function loadAuthorization() {
  // A failed refresh leaves no access token behind, and trying again would
  // just fail again, so fall through to connecting from scratch. This used to
  // retry with no limit, which left the page loading forever.
  if (!getCookie('hueAccessToken') && getCookie('hueRefreshToken'))
    await refreshHueToken();

  hide('#loading');

  if (getCookie('hueAccessToken')) {
    show('#hue-step-rooms');
    show('#hue-options');
    getRooms();
  } else {
    show('#connect');
    authorizeApplication();
  }
}

function authorizeApplication() {
  let clientId = document.querySelector('[data-hue-client-id]').dataset.hueClientId;
  let params = new URLSearchParams({ 'client_id': clientId, 'response_type': 'code' });

  document.querySelector('.appAuth').setAttribute('href', `https://api.meethue.com/v2/oauth2/authorize?${params}`);
}

async function getRooms() {
  let accessToken = getCookie('hueAccessToken');
  let username = getCookie('hueUsername');
  let rooms = await postForm('/app/hue/api/rooms', { accessToken, username }, 10000);

  hide('#select-groups-loading-rooms');

  let container = document.querySelector('#select-groups-rooms');

  for (let existing of container.querySelectorAll('.groupRooms'))
    existing.remove();

  for (let room of rooms || []) {
    // Room names come from the user's Hue account, so they go in as text
    let element = document.createElement('div');
    element.className = 'selectGroup groupRooms';
    element.id = `${roomPrefix}${room.id}`;
    element.textContent = room.name;
    element.addEventListener('click', () => {
      element.classList.toggle('selected');
      saveRooms();
    });

    container.append(element);
  }

  restoreRooms();
}

function saveRooms() {
  let selected = [...document.querySelectorAll('.groupRooms.selected')]
    .map(room => room.id.substring(roomPrefix.length));

  if (selected.length) {
    show('#hue-step-done');
    setCookie('hueRooms', selected.join(','));
  } else {
    hide('#hue-step-done');
    removeCookie('hueRooms');
    removeCookie('hueEnabled');
  }
}

function restoreRooms() {
  let rooms = (getCookie('hueRooms') || '').split(',').filter(room => room);

  for (let room of rooms)
    document.getElementById(`${roomPrefix}${room}`)?.classList.add('selected');

  if (rooms.length)
    show('#hue-step-done');
}

function processOptions() {
  for (let option of ['shuffle']) {
    let element = document.querySelector(`#hue-${option}`);
    let selected = cookieEnabled(option);

    element.classList.toggle('selected', selected);
    element.addEventListener('click', () => {
      selected = !selected;
      element.classList.toggle('selected', selected);
      setCookie(option, selected);
    });
  }
}
