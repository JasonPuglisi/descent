// Reads the Cookie header, which is all the server needs now that Hue tokens
// live in cookies the page can't see. Values are decoded the way both
// Express's res.cookie and the page's setCookie encode them, and a value that
// won't decode is skipped rather than failing the request.
export function readCookies(header) {
  let cookies = {};

  for (let pair of (header || '').split(';')) {
    let split = pair.indexOf('=');

    if (split < 0)
      continue;

    let name = pair.slice(0, split).trim();
    let value = pair.slice(split + 1).trim();

    if (value.startsWith('"') && value.endsWith('"'))
      value = value.slice(1, -1);

    // The first one wins, which is the most specific path, matching browsers
    if (!name || name in cookies)
      continue;

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      continue;
    }
  }

  return cookies;
}
