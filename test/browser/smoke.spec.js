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

// Each font face, as family and weight, that has finished loading
async function expectFonts(page, fonts) {
  let loaded = () => page.evaluate(`document.fonts.ready.then(() =>
    [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family.replace(/"/g, '') + ' ' + face.weight))`);

  for (let font of fonts)
    await expect.poll(loaded, font).toContain(font);
}

test.beforeEach(async ({ request }) => {
  await setTrack(request, { artist: 'Taio Cruz', title: 'Higher', album: 'Rokstarr', playing: true });
  await request.post(`${fake}/hue`, { data: { failure: 0, times: 0 } });
});

test('the landing page offers a user to try', async ({ page }) => {
  let errors = watchErrors(page);

  await page.goto('/');

  await expect(page.locator('input[name=defaultUser]')).toHaveValue(/.+/);
  await expectFonts(page, ['Noto Serif 400', 'Open Sans 400', 'Oswald 700', 'Font Awesome 7 Brands 400']);
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

  // Every font comes from this server now, so make sure the ones this page
  // uses loaded
  await expectFonts(page, ['Open Sans 300', 'Source Code Pro 400', 'Font Awesome 7 Free 900', 'weathericons normal']);
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

// Cookies the way pages before 2.13.2 left them: readable by the page, but
// host-only and Secure like the server set them. WebKit keeps a cookie that
// differs in either beside the server's replacement instead of replacing it,
// so these go in through the page rather than Playwright's addCookies.
async function addOldHueCookies(page, extra = {}) {
  let cookies = { hueAccessToken: 'access-1', hueRefreshToken: 'refresh-1', hueUsername: 'bridge-key', ...extra };

  await page.goto('/app/config');

  for (let [name, value] of Object.entries(cookies))
    await page.evaluate(`document.cookie = '${name}=${value}; path=/; secure'`);
}

async function hueRequests(request) {
  return (await request.get(`${fake}/hue`)).json();
}

test('the Hue page reissues old readable tokens as httpOnly and lists rooms', async ({ page, context, request }) => {
  let errors = watchErrors(page);
  await addOldHueCookies(page);

  await page.goto('/app/hue');

  let room = page.locator('#select-groups-rooms button', { hasText: 'Living Room' });
  await expect(room).toBeVisible();

  let cookies = Object.fromEntries((await context.cookies()).map(cookie => [cookie.name, cookie]));
  expect(cookies.hueAccessToken).toMatchObject({ value: 'access-2', httpOnly: true });
  expect(cookies.hueRefreshToken.httpOnly).toBe(true);
  expect(cookies.hueUsername.httpOnly).toBe(true);
  expect(cookies.hueAccess.httpOnly).toBe(false);

  // The new access token never reaches the page. WebKit's in-page cookie
  // cache can keep returning the old values it had already read, even though
  // its cookie store, checked above, has only the httpOnly ones, so the old
  // values aren't what this checks.
  expect(await page.evaluate('document.cookie')).not.toContain('access-2');

  // The rooms came from the server using the reissued cookies
  let calls = await hueRequests(request);
  expect(calls.filter(call => call.path.endsWith('/room')).at(-1)).toMatchObject({ authorization: 'Bearer access-2', key: 'bridge-key' });

  await room.click();
  await expect(room).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('lights follow the art once Hue is on', async ({ page, request }) => {
  let errors = watchErrors(page);
  await addOldHueCookies(page, { hueRooms: 'room-1', hueEnabled: 'true' });

  await page.goto('/djryan');
  await expect(page.locator('.hueIndicator')).toHaveText('on');

  await expect.poll(async () => (await hueRequests(request))
    .filter(call => call.method === 'put' && call.path.endsWith('/light/light-1')).length).toBeGreaterThan(0);

  let put = (await hueRequests(request)).filter(call => call.method === 'put').at(-1);
  expect(put).toMatchObject({ authorization: 'Bearer access-2', key: 'bridge-key' });
  expect(JSON.parse(put.body).color.xy.x).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('the Hue page asks to connect again when Hue rejects the saved bridge key', async ({ page, request }) => {
  let errors = watchErrors(page);
  await request.post(`${fake}/hue`, { data: { failure: 403, times: 100 } });
  await addOldHueCookies(page);

  await page.goto('/app/hue');

  await expect(page.locator('#connect-again')).toBeVisible();
  await expect(page.locator('.appAuth')).toBeVisible();
  await expect(page.locator('#hue-options')).toBeHidden();
  // The rejection shows up as a failed request, which isn't a page error
  expect(errors.filter(error => !error.includes('401'))).toEqual([]);
});

test('the Hue page refreshes an access token Hue says has expired', async ({ page, request }) => {
  await addOldHueCookies(page, { hueAccess: 'true' });
  await request.post(`${fake}/hue`, { data: { failure: 401, times: 1 } });

  await page.goto('/app/hue');

  await expect(page.locator('#select-groups-rooms button', { hasText: 'Living Room' })).toBeVisible();
  await expect(page.locator('#connect-again')).toBeHidden();
});

// The page has to hold its own ETag. The smoke tests reach the server through
// a self-signed certificate, which browsers won't cache responses from, so
// this is also what a browser with its cache off sees.
test('an open page waits on the server instead of asking over and over', async ({ page }) => {
  let asked = 0;
  page.on('request', request => {
    if (request.url().includes('/app/lastfm/recent'))
      asked++;
  });

  await page.goto('/djryan');
  await expect(page.locator('.music .title')).toHaveText('Higher');
  await page.waitForTimeout(8000);

  // The first answer, maybe a second once the art and counts come in, and then
  // one request held open
  expect(asked).toBeLessThanOrEqual(4);
});

// Headless browsers never grant a wake lock, which is the case this covers: a
// refusal waits for the first key press, tries once more, and then stops
// rather than asking on every key press after
test('the wake lock asks again once after a key press, then gives up', async ({ page }) => {
  let messages = [];
  page.on('console', message => messages.push(message.text()));

  await page.goto('/djryan');
  await expect(page.locator('.music .title')).toHaveText('Higher');

  let waiting = () => messages.filter(text => text.includes('until the page is tapped')).length;
  let refused = () => messages.filter(text => text.includes('Error requesting wake lock')).length;
  let held = () => messages.filter(text => text.includes('Keeping the screen awake')).length;

  // A browser that grants it straight away has nothing to retry
  test.skip(held() > 0, 'This browser granted the wake lock without a gesture');

  await expect.poll(waiting).toBe(1);
  await page.keyboard.press('x');
  await expect.poll(() => refused() + held()).toBe(1);

  await page.keyboard.press('x');
  await page.keyboard.press('x');
  await page.waitForTimeout(500);
  expect(waiting()).toBe(1);
  expect(refused() + held()).toBe(1);
});
