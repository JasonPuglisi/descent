$(function() {
  $('#username').focus();

  var username = Cookies.get('lastUser');
  if (username !== undefined) {
    $('[name="defaultUsername"]').val(username);
  } else {
    username = $('[name="defaultUsername"]').val();
  }
  $('#username').attr('placeholder', username);
});

function submit() {
  $('#userInput').submit();
}
