/* global Cookies */

$(() => {
  $('#user').focus();

  let user = Cookies.get('lastUser');
  if (user !== undefined)
    $('[name="defaultUser"]').val(user);
  else
    user = $('[name="defaultUser"]').val();

  $('#user').attr('placeholder', user);
});

function submitUser() {
  $('#userInput').submit();
}
