/* global Cookies */
/* global cookieEnabled, cookieExists */

$(() => {
  processBackground();
  processUnits();
  processDatetime();
});

function processBackground() {
  let selected = Cookies.get('background') || 'artist';
  $(`#bg-${selected}`).addClass('selected');

  $('.selectGroup.groupBg').on('click', function() {
    $('.selectGroup.groupBg.selected').each(function() { $(this).removeClass('selected'); });
    $(this).addClass('selected');
    Cookies.set('background', this.id.substring(this.id.lastIndexOf('-') + 1), { expires: 3650 });
  });

  selected = !cookieExists('blur') || cookieEnabled('blur');
  $('#bgopt-blur').toggleClass('selected', selected).on('click', function() {
    selected = !selected;
    $(this).toggleClass('selected');
    Cookies.set('blur', selected, { expires: 365 });
  });

  $('#bgopt-default').val(Cookies.get('defaultBackground'));
  $('#bgopt-default').on('input propertychange paste', () => {
    $('.backgroundInputSave').show();
  });

  $('a.backgroundInputSave').on('click', function() {
    $(this).hide();

    Cookies.set('defaultBackground', $('#bgopt-default').val(), { expires: 3650 });
  });
}

function processUnits() {
  let selected = Cookies.get('units') || 'imperial';
  $(`#units-${selected}`).addClass('selected');

  $('.selectGroup.groupUnits').on('click', function() {
    $('.selectGroup.groupUnits.selected').each(function() { $(this).removeClass('selected'); });
    $(this).addClass('selected');
    Cookies.set('units', this.id.substring(this.id.lastIndexOf('-') + 1), { expires: 3650 });
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
      Cookies.set(option, selected, { expires: 3650 });
    });
  });
}
