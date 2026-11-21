// Small stand-in for js-cookie, covering the handful of calls Descent makes.
// Values are percent-encoded the same way Express encodes the cookies the
// server sets, so either side can read what the other wrote.

let tenYears = 3650 * 24 * 60 * 60 * 1000;

export function getCookie(name) {
  for (let pair of document.cookie.split('; ')) {
    let separator = pair.indexOf('=');

    if (pair.substring(0, separator) !== name)
      continue;

    let value = pair.substring(separator + 1);

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}

export function setCookie(name, value) {
  let expires = new Date(Date.now() + tenYears).toUTCString();

  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; secure`;
}

export function removeCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure`;
}

export function cookieExists(name) {
  return getCookie(name) !== undefined;
}

export function cookieEnabled(name) {
  return getCookie(name) === 'true';
}

export function toggleCookie(name) {
  setCookie(name, cookieEnabled(name) ? 'false' : 'true');
}
