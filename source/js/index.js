/* global Cookies */

$(() => {
  $('.userInput').focus();

  let user = Cookies.get('lastUser');
  if (user !== undefined)
    $('[name="defaultUser"]').val(user);
  else
    user = $('[name="defaultUser"]').val();

  $('.userInput').attr('placeholder', user);
});

function submitUser() {
  $('.userInputForm').submit();
}
