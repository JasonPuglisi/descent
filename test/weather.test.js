import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createWeather, formatWeather, placeKey } from '../lib/weather.js';

function owm({ temp = 71.6, feelsLike = 72.4, icon = '01d', description = 'clear sky' } = {}) {
  return { weather: [{ description, icon }], main: { 'temp': temp, 'feels_like': feelsLike }, wind: { speed: 9 } };
}

function fakeFetch(body = owm(), status = 200) {
  let calls = [];
  let fetch = async url => {
    calls.push(new URL(url));
    return { ok: status === 200, status, json: async () => body };
  };

  return { fetch, calls };
}

describe('formatWeather', () => {
  it('uses OpenWeatherMap\'s feels like temperature', () => {
    let weather = formatWeather(owm({ temp: 80.4, feelsLike: 83.6 }), 'imperial');

    assert.equal(weather.temperature, 80);
    assert.equal(weather.apparentTemperature, 84);
    assert.equal(weather.unit, 'F');
  });

  it('falls back to the temperature without a feels like', () => {
    let weather = formatWeather(owm({ temp: 21.2, feelsLike: null }), 'metric');

    assert.equal(weather.apparentTemperature, 21);
    assert.equal(weather.unit, 'C');
  });

  it('capitalizes the summary and maps the icon', () => {
    let weather = formatWeather(owm({ icon: '10n', description: 'light rain' }), 'metric');

    assert.equal(weather.summary, 'Light rain currently');
    assert.equal(weather.icon, 'wi wi-night-rain');
  });

  it('shows an unknown icon as not available', () => {
    assert.equal(formatWeather(owm({ icon: '99x' }), 'metric').icon, 'wi wi-na');
  });

  it('fails on a body without conditions', () => {
    assert.equal(formatWeather({ cod: 401 }, 'metric').success, false);
    assert.equal(formatWeather(undefined, 'metric').success, false);
  });
});

describe('placeKey', () => {
  it('rounds to about a kilometer', () => {
    assert.equal(placeKey('40.712776', '-74.005974', 'imperial'), '40.71,-74.01,imperial');
    assert.equal(placeKey(40.7149, -74.0102, 'imperial'), '40.71,-74.01,imperial');
  });

  it('rejects coordinates and units that aren\'t real', () => {
    assert.equal(placeKey('abc', '1', 'metric'), undefined);
    assert.equal(placeKey('91', '1', 'metric'), undefined);
    assert.equal(placeKey('1', '181', 'metric'), undefined);
    assert.equal(placeKey('1', '1', 'kelvin'), undefined);
    assert.equal(placeKey(undefined, undefined, undefined), undefined);
  });
});

describe('createWeather', () => {
  it('shares one lookup between nearby displays for the cache lifetime', async () => {
    let time = 0;
    let { fetch, calls } = fakeFetch();
    let weather = createWeather({ key: 'k', fetch, now: () => time });

    let first = await weather.get('40.7128', '-74.0060', 'imperial');
    time += 5 * 60 * 1000;
    let second = await weather.get('40.7131', '-74.0058', 'imperial');

    assert.equal(calls.length, 1);
    assert.deepEqual(second, first);
    assert.equal(calls[0].searchParams.get('lat'), '40.71');
    assert.equal(calls[0].searchParams.get('lon'), '-74.01');
  });

  it('looks again once the cache expires', async () => {
    let time = 0;
    let { fetch, calls } = fakeFetch();
    let weather = createWeather({ key: 'k', fetch, now: () => time });

    await weather.get('1', '1', 'metric');
    time += 10 * 60 * 1000;
    await weather.get('1', '1', 'metric');

    assert.equal(calls.length, 2);
  });

  it('keeps units apart', async () => {
    let { fetch, calls } = fakeFetch();
    let weather = createWeather({ key: 'k', fetch });

    await weather.get('1', '1', 'metric');
    await weather.get('1', '1', 'imperial');

    assert.equal(calls.length, 2);
  });

  it('coalesces lookups that arrive together', async () => {
    let { fetch, calls } = fakeFetch();
    let weather = createWeather({ key: 'k', fetch });

    await Promise.all([weather.get('1', '1', 'metric'), weather.get('1', '1', 'metric')]);

    assert.equal(calls.length, 1);
  });

  it('doesn\'t keep failures', async () => {
    let { fetch, calls } = fakeFetch({ cod: 429 }, 429);
    let weather = createWeather({ key: 'k', fetch });

    assert.equal((await weather.get('1', '1', 'metric')).success, false);
    assert.equal((await weather.get('1', '1', 'metric')).success, false);
    assert.equal(calls.length, 2);
  });

  it('survives OpenWeatherMap being unreachable', async () => {
    let weather = createWeather({ key: 'k', fetch: async () => { throw new TypeError('fetch failed'); } });

    assert.equal((await weather.get('1', '1', 'metric')).success, false);
  });

  it('never calls out without a key or with bad input', async () => {
    let { fetch, calls } = fakeFetch();

    assert.equal((await createWeather({ fetch }).get('1', '1', 'metric')).success, false);
    assert.equal((await createWeather({ key: 'k', fetch }).get('x', '1', 'metric')).success, false);
    assert.equal(calls.length, 0);
  });

  it('drops expired places as new ones arrive', async () => {
    let time = 0;
    let { fetch } = fakeFetch();
    let weather = createWeather({ key: 'k', fetch, now: () => time });

    await weather.get('1', '1', 'metric');
    await weather.get('2', '2', 'metric');
    time += 10 * 60 * 1000;
    await weather.get('3', '3', 'metric');

    assert.equal(weather.size(), 1);
  });
});
