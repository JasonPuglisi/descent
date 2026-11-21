import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readCookies } from '../lib/cookies.js';

describe('readCookies', () => {
  it('reads and decodes each cookie', () => {
    assert.deepEqual(readCookies('hueRooms=a%2Cb; hueAccessToken=abc123; blur=true'),
      { hueRooms: 'a,b', hueAccessToken: 'abc123', blur: 'true' });
  });

  it('keeps an equals sign inside a value', () => {
    assert.equal(readCookies('token=abc==').token, 'abc==');
  });

  it('copes with no header, stray separators and quoted values', () => {
    assert.deepEqual(readCookies(undefined), {});
    assert.deepEqual(readCookies(';; noValue; a="quoted" '), { a: 'quoted' });
  });

  it('skips a value that won\'t decode', () => {
    assert.deepEqual(readCookies('bad=%E0%A4%A; good=1'), { good: '1' });
  });

  it('takes the first of two cookies with the same name', () => {
    assert.equal(readCookies('a=first; a=second').a, 'first');
  });
});
