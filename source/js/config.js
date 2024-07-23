/* global Cookies */
/* global cookieEnabled, cookieExists */

$(() => {
  processBackground();
  setScrobbleMode();
  processLocation();
  processUnits();
  processDatetime();
});

function processBackground() {
  let selected = Cookies.get('background') || 'artist';
  $(`#bg-${selected}`).addClass('selected');

  $('.selectGroup.groupBg').on('click', function() {
    $('.selectGroup.groupBg.selected').each(function() { $(this).removeClass('selected'); });
    $(this).addClass('selected');
    Cookies.set('background', this.id.substring(this.id.lastIndexOf('-') + 1), { expires: 3650, secure: true });
  });

  selected = !cookieExists('blur') || cookieEnabled('blur');
  $('#bgopt-blur').toggleClass('selected', selected).on('click', function() {
    selected = !selected;
    $(this).toggleClass('selected');
    Cookies.set('blur', selected, { expires: 3650, secure: true });
  });

  $('#bgopt-default').val(Cookies.get('defaultBackground'));
  $('#bgopt-default').on('input propertychange paste', () => {
    $('.backgroundInputSave').show();
  });

  $('a.backgroundInputSave').on('click', function() {
    $(this).hide();

    Cookies.set('defaultBackground', $('#bgopt-default').val(), { expires: 3650, secure: true });
  });
}

function setScrobbleMode() {
  let selected = Cookies.get('scrobbleMode') || 'currentlyPlaying';
  $(`#scrobbleMode-${selected}`).addClass('selected');

  $('.selectGroup.groupScrobbleMode').on('click', function() {
    $('.selectGroup.groupScrobbleMode.selected').each(function() { $(this).removeClass('selected'); });
    $(this).addClass('selected');
    Cookies.set('scrobbleMode', this.id.substring(this.id.lastIndexOf('-') + 1), { expires: 3650, secure: true });
  });

}

function validateCoordinate(coordinate) {
  return /^(-?\d+\.\d+)?$/.test(coordinate);
}

function showHideLocationSave() {
  let latitude = $('#loc-latitude').val();
  let longitude = $('#loc-longitude').val();

  if (!latitude == !longitude &&
      validateCoordinate(latitude) && validateCoordinate(longitude)) {
    $('a.locationInputSave').show();
  } else {
    $('a.locationInputSave').hide();
  }
}

function processLocation() {
  $('#loc-latitude').val(Cookies.get('latitude'));
  $('#loc-longitude').val(Cookies.get('longitude'));

  $('#loc-latitude').on('input propertychange paste', () => {
    showHideLocationSave();
  });

  $('#loc-longitude').on('input propertychange paste', () => {
    showHideLocationSave();
  });

  $('a.locationInputSave').on('click', function() {
    $(this).hide();

    Cookies.set('latitude', $('#loc-latitude').val(), { expires: 3650, secure: true });
    Cookies.set('longitude', $('#loc-longitude').val(), { expires: 3650, secure: true });
  });
}

function processUnits() {
  let selected = Cookies.get('units') || 'imperial';
  $(`#units-${selected}`).addClass('selected');

  $('.selectGroup.groupUnits').on('click', function() {
    $('.selectGroup.groupUnits.selected').each(function() { $(this).removeClass('selected'); });
    $(this).addClass('selected');
    Cookies.set('units', this.id.substring(this.id.lastIndexOf('-') + 1), { expires: 3650, secure: true });
  });
}

function processDatetime() {
  let options = ['24hr', 'weekday', 'seconds'];
  options.forEach(option => {
    let selected = cookieEnabled(option);
    $(`#datetime-${option}`).toggleClass('selected', selected);

    $(`#datetime-${option}`).on('click', function() {
      selected = !selected;
      $(this).toggleClass('selected');
      Cookies.set(option, selected, { expires: 3650, secure: true });
    });
  });
}
