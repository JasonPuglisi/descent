import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { cookieEnabled, cookieExists, getCookie, removeCookie, setCookie, toggleCookie } from '../source/js/utility/cookies.js';

// Enough of a browser cookie jar to read back what was written: assigning sets
// or expires one cookie, and reading lists them all
function fakeJar() {
  let jar = new Map();

  return {
    jar,
    get cookie() {
      return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    },
    set cookie(header) {
      let [pair, ...attributes] = header.split('; ');
      let separator = pair.indexOf('=');
      let name = pair.substring(0, separator);
      let expires = attributes.find(attribute => attribute.startsWith('expires='));

      if (expires && new Date(expires.substring(8)) < new Date())
        jar.delete(name);
      else
        jar.set(name, pair.substring(separator + 1));
    }
  };
}

let document;

beforeEach(() => {
  document = fakeJar();
  globalThis.document = document;
});

describe('cookies', () => {
  it('round-trips values that need encoding', () => {
    for (let value of ['a b', 'x;y', 'https://example.com/a.png?x=1&y=2', 'ünïcödé', '100%']) {
      setCookie('value', value);
      assert.equal(getCookie('value'), value);
    }
  });

  it('reads cookies the server wrote', () => {
    // Express encodes cookie values with encodeURIComponent
    document.jar.set('hueUsername', encodeURIComponent('abc/def=='));

    assert.equal(getCookie('hueUsername'), 'abc/def==');
  });

  it('returns a raw value that is not valid percent-encoding', () => {
    document.jar.set('broken', '50%off');

    assert.equal(getCookie('broken'), '50%off');
  });

  it('keeps a value containing an equals sign whole', () => {
    document.jar.set('token', 'abc=def=');

    assert.equal(getCookie('token'), 'abc=def=');
  });

  it('does not confuse names that share a prefix', () => {
    document.jar.set('blurry', 'yes');

    assert.equal(getCookie('blur'), undefined);
    assert.equal(cookieExists('blur'), false);
  });

  it('writes the attributes the server expects', () => {
    let header;
    globalThis.document = { set cookie(value) { header = value; } };

    setCookie('units', 'metric');

    assert.match(header, /^units=metric; expires=[^;]+; path=\/; secure$/);
  });

  it('removes and toggles', () => {
    setCookie('weekday', true);
    assert.equal(cookieEnabled('weekday'), true);

    toggleCookie('weekday');
    assert.equal(getCookie('weekday'), 'false');

    toggleCookie('weekday');
    assert.equal(cookieEnabled('weekday'), true);

    removeCookie('weekday');
    assert.equal(cookieExists('weekday'), false);
  });

  it('treats a missing toggle as off', () => {
    toggleCookie('seconds');

    assert.equal(getCookie('seconds'), 'true');
  });
});
