function initDatetime() {
  // Call the update once so the time fades in properly
  updateDatetime();
  setInterval(updateDatetime, 1000);

  if (cookieEnabled('datetimeEnabled'))
    toggleDisplay('#datetime', true);
}

function updateDatetime() {
  $('#datetime #date').text(getCurrentDate());
  $('#datetime #time').text(getCurrentTime());
}

function getCurrentDate() {
  let months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  let date = new Date();
  let month = months[date.getMonth()];

  return `${month} ${date.getDate()}, ${date.getFullYear()}`;
}

function getCurrentTime() {
  let date = new Date();
  let hours = date.getHours().toString();
  let minutes = date.getMinutes().toString();

  if (hours.length === 1)
    hours = `0${hours}`;
  if (minutes.length === 1)
    minutes = `0${minutes}`;

  return `${hours}:${minutes}`;
}
