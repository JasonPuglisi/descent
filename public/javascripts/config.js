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

  selected = !cookieExists('blur') || cookieEnabled('blur');
  $('#select-group-bgopt-blur').toggleClass('selected', selected).on('click', function() {
    selected = !selected;
    $(this).toggleClass('selected');
    Cookies.set('blur', selected, { expires: 365 });
  });

  $('#defaultBackground').val(Cookies.get('defaultBackground'));
  $('#defaultBackground').on('input propertychange paste', function() {
    $('#defaultBackgroundSave').show();
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
    $(`#select-group-datetime-${option}`).toggleClass('selected', selected);

    $(`#select-group-datetime-${option}`).on('click', function() {
      selected = !selected;
      $(this).toggleClass('selected');
      Cookies.set(option, selected, { expires: 3650 });
    });
  });
}

function saveDefaultBackground() {
  $('#defaultBackgroundSave').hide();

  Cookies.set('defaultBackground', $('#defaultBackground').val(), { expires: 3650 });
}
