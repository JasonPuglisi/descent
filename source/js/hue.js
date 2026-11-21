import { cookieEnabled, getCookie, removeCookie, setCookie } from './utility/cookies.js';
import { hide, setPressed, show } from './utility/general.js';
import { hueAuthorized, hueRefreshable, refreshHueToken } from './utility/hue.js';
import { postForm } from './utility/request.js';

let roomPrefix = 'select-group-rooms-';

loadAuthorization();
processOptions();

async function loadAuthorization() {
  // A failed refresh leaves no access token behind, and trying again would
  // just fail again, so fall through to connecting from scratch. This used to
  // retry with no limit, which left the page loading forever.
  // Cookies from before 2.13.2 have no access flag, so they get refreshed
  // here too, which is what reissues them as httpOnly
  if (!hueAuthorized() && hueRefreshable())
    await refreshHueToken();

  hide('#loading');

  if (hueAuthorized()) {
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
  let rooms = await postForm('/app/hue/api/rooms', {}, 10000);

  hide('#select-groups-loading-rooms');

  let container = document.querySelector('#select-groups-rooms');

  for (let existing of container.querySelectorAll('.groupRooms'))
    existing.remove();

  for (let room of rooms || []) {
    // Room names come from the user's Hue account, so they go in as text
    let element = document.createElement('button');
    element.type = 'button';
    element.className = 'selectGroup groupRooms';
    element.id = `${roomPrefix}${room.id}`;
    element.textContent = room.name;
    setPressed(element, false);
    element.addEventListener('click', () => {
      setPressed(element, !element.classList.contains('selected'));
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

  for (let room of rooms) {
    let element = document.getElementById(`${roomPrefix}${room}`);

    if (element)
      setPressed(element, true);
  }

  if (rooms.length)
    show('#hue-step-done');
}

function processOptions() {
  for (let option of ['shuffle']) {
    let element = document.querySelector(`#hue-${option}`);
    let selected = cookieEnabled(option);

    setPressed(element, selected);
    element.addEventListener('click', () => {
      selected = !selected;
      setPressed(element, selected);
      setCookie(option, selected);
    });
  }
}
