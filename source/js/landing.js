import { getCookie } from './utility/cookies.js';

let form = document.querySelector('.userInputForm');
let input = form.querySelector('.userInput');
let defaultUser = form.querySelector('[name="defaultUser"]');

input.focus();

// Prefer whoever was last viewed here over the random sample user
let user = getCookie('lastUser');

if (user !== undefined)
  defaultUser.value = user;
else
  user = defaultUser.value;

input.setAttribute('placeholder', user);

form.querySelector('.userSubmit').addEventListener('click', event => {
  event.preventDefault();
  form.submit();
});
