import { expect, test } from '@playwright/test';
import { fakePort } from '../../playwright.config.js';

let fake = `http://127.0.0.1:${fakePort}`;

async function setTrack(request, track) {
  await request.post(`${fake}/track`, { data: track });
}

// Console errors include CSP violations and modules that fail to load, which
// is most of what goes wrong on a page with no bundler
function watchErrors(page) {
  let errors = [];

  page.on('console', message => {
    if (message.type() === 'error')
      errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));

  return errors;
}

test.beforeEach(async ({ request }) => {
  await setTrack(request, { artist: 'Taio Cruz', title: 'Higher', album: 'Rokstarr', playing: true });
  await request.post(`${fake}/hue`, { data: { failure: 0, times: 0 } });
});

test('the landing page offers a user to try', async ({ page }) => {
  let errors = watchErrors(page);

  await page.goto('/');

  await expect(page.locator('input[name=defaultUser]')).toHaveValue(/.+/);
  expect(errors).toEqual([]);
});

test('the now playing page shows the track, art, counts and weather', async ({ page }) => {
  let errors = watchErrors(page);

  await page.goto('/djryan');

  await expect(page.locator('.music .title')).toHaveText('Higher');
  await expect(page.locator('.music .artist')).toHaveText('Taio Cruz');
  await expect(page).toHaveTitle('"Higher" by Taio Cruz');
  await expect(page.locator('.music .cover')).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.locator('.artistScrobbleCount')).toHaveText('120');

  // Colors come from the art through Color Thief, so this fails if it didn't
  // load or the CSP blocked it. The fake album art is a solid red.
  await expect(page.locator('.music .title')).toHaveCSS('color', /^rgb\(2\d\d, \d+, \d+\)$/);
  await expect(page.locator('.music .title')).not.toHaveCSS('color', 'rgb(246, 245, 247)');
  await expect(page.locator('.weather .temperature')).toHaveText('72');
  await expect(page.locator('.weather .apparentTemperature')).toHaveText(/^\d+$/);
  expect(errors).toEqual([]);
});

test('a track change reaches an open page within a few seconds', async ({ page, request }) => {
  await page.goto('/djryan');
  await expect(page.locator('.music .title')).toHaveText('Higher');

  await setTrack(request, { title: 'Dynamite' });

  // The server polls every three seconds and answers the held request at once
  await expect(page.locator('.music .title')).toHaveText('Dynamite', { timeout: 6000 });
});

test('the page goes idle when nothing is playing', async ({ page, request }) => {
  await page.goto('/djryan');
  await expect(page.locator('.music .title')).toHaveText('Higher');

  await setTrack(request, { playing: false });

  // Idle waits out a short timeout in case the next track is about to start
  await expect(page.locator('.music .artist')).toHaveText('Nothing in the air...', { timeout: 20000 });
  await expect(page).toHaveTitle('Descent');
});

test('shortcuts toggle parts of the display', async ({ page }) => {
  await page.goto('/djryan');
  await expect(page.locator('.weather')).toBeVisible();

  await page.keyboard.press('w');
  await expect(page.locator('.weather')).toBeHidden();

  await page.keyboard.press('w');
  await expect(page.locator('.weather')).toBeVisible();
});

test('settings save to cookies', async ({ page, context }) => {
  let errors = watchErrors(page);

  await page.goto('/app/config');
  await page.locator('#bg-album').click();
  await expect(page.locator('#bg-album')).toHaveClass(/selected/);
  await expect(page.locator('#bg-artist')).not.toHaveClass(/selected/);

  let cookies = await context.cookies();
  expect(cookies.find(cookie => cookie.name === 'background')?.value).toBe('album');
  expect(errors).toEqual([]);
});

test('the Hue page loads without an account connected', async ({ page }) => {
  let errors = watchErrors(page);

  await page.goto('/app/hue');

  await expect(page.locator('#connect')).toBeVisible();
  await expect(page.locator('.appAuth')).toHaveAttribute('href', /api\.meethue\.com/);
  expect(errors).toEqual([]);
});

// Cookies the way pages before 2.13.2 left them, readable by the page
async function addOldHueCookies(context, baseURL) {
  let url = baseURL;
  await context.addCookies([
    { name: 'hueAccessToken', value: 'access-1', url },
    { name: 'hueRefreshToken', value: 'refresh-1', url },
    { name: 'hueUsername', value: 'bridge-key', url }
  ]);
}

async function hueRequests(request) {
  return (await request.get(`${fake}/hue`)).json();
}

test('the Hue page reissues old readable tokens as httpOnly and lists rooms', async ({ page, context, request, baseURL }) => {
  let errors = watchErrors(page);
  await addOldHueCookies(context, baseURL);

  await page.goto('/app/hue');

  let room = page.locator('#select-groups-rooms button', { hasText: 'Living Room' });
  await expect(room).toBeVisible();

  let cookies = Object.fromEntries((await context.cookies()).map(cookie => [cookie.name, cookie]));
  expect(cookies.hueAccessToken).toMatchObject({ value: 'access-2', httpOnly: true });
  expect(cookies.hueRefreshToken.httpOnly).toBe(true);
  expect(cookies.hueUsername.httpOnly).toBe(true);
  expect(cookies.hueAccess.httpOnly).toBe(false);

  // Nothing secret is left for the page to read
  let readable = await page.evaluate('document.cookie');
  expect(readable).not.toMatch(/access-|refresh-|bridge-key/);

  // The rooms came from the server using the reissued cookies
  let calls = await hueRequests(request);
  expect(calls.filter(call => call.path.endsWith('/room')).at(-1)).toMatchObject({ authorization: 'Bearer access-2', key: 'bridge-key' });

  await room.click();
  await expect(room).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('lights follow the art once Hue is on', async ({ page, context, request, baseURL }) => {
  let errors = watchErrors(page);
  await addOldHueCookies(context, baseURL);
  await context.addCookies([
    { name: 'hueRooms', value: 'room-1', url: baseURL },
    { name: 'hueEnabled', value: 'true', url: baseURL }
  ]);

  await page.goto('/djryan');
  await expect(page.locator('.hueIndicator')).toHaveText('on');

  await expect.poll(async () => (await hueRequests(request))
    .filter(call => call.method === 'put' && call.path.endsWith('/light/light-1')).length).toBeGreaterThan(0);

  let put = (await hueRequests(request)).filter(call => call.method === 'put').at(-1);
  expect(put).toMatchObject({ authorization: 'Bearer access-2', key: 'bridge-key' });
  expect(JSON.parse(put.body).color.xy.x).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('the Hue page asks to connect again when Hue rejects the saved bridge key', async ({ page, context, request, baseURL }) => {
  let errors = watchErrors(page);
  await addOldHueCookies(context, baseURL);
  await request.post(`${fake}/hue`, { data: { failure: 403, times: 100 } });

  await page.goto('/app/hue');

  await expect(page.locator('#connect-again')).toBeVisible();
  await expect(page.locator('.appAuth')).toBeVisible();
  await expect(page.locator('#hue-options')).toBeHidden();
  // The rejection shows up as a failed request, which isn't a page error
  expect(errors.filter(error => !error.includes('401'))).toEqual([]);
});

test('the Hue page refreshes an access token Hue says has expired', async ({ page, context, request, baseURL }) => {
  await addOldHueCookies(context, baseURL);
  await context.addCookies([{ name: 'hueAccess', value: 'true', url: baseURL }]);
  await request.post(`${fake}/hue`, { data: { failure: 401, times: 1 } });

  await page.goto('/app/hue');

  await expect(page.locator('#select-groups-rooms button', { hasText: 'Living Room' })).toBeVisible();
  await expect(page.locator('#connect-again')).toBeHidden();
});
