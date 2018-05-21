/* global cookieEnabled, toggleDisplay */

function initDatetime() {
  // Update immediately and sync with system clock for next update
  let nextUpdate = 1000 - new Date().getMilliseconds();
  setTimeout(() => { updateDatetime(); setInterval(updateDatetime, 1000); }, nextUpdate);
  updateDatetime();

  if (cookieEnabled('datetimeOn'))
    toggleDisplay('.datetime', true);
}

function updateDatetime() {
  let date = new Date();

  $('.datetime .date').text(getCurrentDate(date));
  $('.datetime .time').text(getCurrentTime(date));
}

function getCurrentDate(date) {
  let modeWeekday = cookieEnabled('weekday');

  let options = {
    weekday: modeWeekday ? 'long' : undefined,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };

  return date.toLocaleDateString('en-US', options);
}

function getCurrentTime(date) {
  let mode24 = cookieEnabled('24hr');
  let modeSeconds = cookieEnabled('seconds');

  let options = {
    hour12: !mode24,
    hour: mode24 ? '2-digit' : 'numeric',
    minute: '2-digit',
    second: modeSeconds ? '2-digit' : undefined
  };

  return date.toLocaleTimeString('en-US', options);
}
