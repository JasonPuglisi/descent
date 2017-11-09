$(function() {
  processUnits();
  processBackground();
});

function processUnits() {
  var selected = Cookies.get('units') || 'imperial';
  $('#select-group-units-' + selected).addClass('selected');

  $('.select-group.group-units').on('click', function() {
    $('.select-group.group-units.selected').each(function() {
      $(this).removeClass('selected');
    });
    $(this).addClass('selected');
    Cookies.set('units', this.id.substring(this.id.lastIndexOf('-') + 1),
      { expires: 3650 });
  });
}

function processBackground() {
  var selected = Cookies.get('background') || 'album';
  $('#select-group-bg-' + selected).addClass('selected');

  $('.select-group.group-bg').on('click', function() {
    $('.select-group.group-bg.selected').each(function() {
      $(this).removeClass('selected');
    });
    $(this).addClass('selected');
    Cookies.set('background', this.id.substring(this.id.lastIndexOf('-') + 1),
      { expires: 3650 });
  });
}
