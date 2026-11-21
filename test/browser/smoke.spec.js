import { expect, test } from '@playwright/test';
import { fakePort } from '../../playwright.config.js';

let fake = `http://localhost:${fakePort}`;

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
