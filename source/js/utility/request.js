// Fetch JSON with a timeout. Error bodies are parsed too, because Last.fm
// reports failures like rate limiting as JSON on a non-2xx status, and the
// caller needs the error code to react to it. Resolves to undefined when the
// request fails outright or the body isn't JSON.
export async function getJson(url, timeout = 2000) {
  return requestJson(url, { 'method': 'get' }, timeout);
}

// Posts as a form, which is what the server's urlencoded parser expects
export async function postForm(url, fields, timeout = 2000) {
  return requestJson(url, { 'method': 'post', 'body': new URLSearchParams(fields) }, timeout);
}

async function requestJson(url, options, timeout) {
  // AbortSignal.timeout would be shorter, but it's newer than the rest of
  // what the page needs, and kiosk browsers tend to lag behind
  let controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), timeout);

  try {
    let response = await fetch(url, { ...options, 'signal': controller.signal });

    return await response.json();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
