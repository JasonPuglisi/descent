$(() => {
  processBackground();
  processUnits();
  processDatetime();
});

function processBackground() {
  let selected = Cookies.get('background') || 'artist';
  $(`#select-group-bg-${selected}`).addClass('selected');

  $('.select-group.group-bg').on('click', function() {
    $('.select-group.group-bg.selected').each(function() { $(this).removeClass('selected'); });
    $(this).addClass('selected');
    Cookies.set('background', this.id.substring(this.id.lastIndexOf('-') + 1), { expires: 3650 });
  });
}

function processUnits() {
  let selected = Cookies.get('units') || 'imperial';
  $(`#select-group-units-${selected}`).addClass('selected');

  $('.select-group.group-units').on('click', function() {
    $('.select-group.group-units.selected').each(function() { $(this).removeClass('selected'); });
    $(this).addClass('selected');
    Cookies.set('units', this.id.substring(this.id.lastIndexOf('-') + 1), { expires: 3650 });
  });
}

function processDatetime() {
  let options = ['24hr', 'weekday', 'seconds'];
  options.forEach(option => {
    let selected = cookieEnabled(option);
    if (selected)
      $(`#select-group-datetime-${option}`).addClass('selected');

    $(`#select-group-datetime-${option}`).on('click', function() {
      selected = !selected;
      $(this).toggleClass('selected');
      Cookies.set(option, selected, { expires: 3650 });
    });
  });
}
