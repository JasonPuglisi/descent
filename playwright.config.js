import { defineConfig, devices } from '@playwright/test';

// Browser smoke tests against the real server, with every upstream API faked
// by test/browser/upstreams.js. They catch what unit tests can't: a module that
// fails to import, a template that doesn't render, or the CSP blocking
// something. Run `yarn gulp build` first, since the server serves public/.
let serverPort = 3124;
let port = 3125;
let fakePort = 3998;

export default defineConfig({
  testDir: 'test/browser',
  timeout: 30000,
  expect: { timeout: 10000 },
  // One fake Last.fm is shared by every test, so they take turns with it
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `https://localhost:${port}`,
    // The HTTPS front uses a throwaway self-signed certificate
    ignoreHTTPSErrors: true,
    // Weather needs a location, and a fixed one keeps the page from asking
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ['geolocation']
  },
  // Safari has caught things Chromium didn't, like the CSP blocking Cloudflare's
  // iframe script, and kiosks are often iPads
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  webServer: [
    {
      command: 'node --import ./test/browser/upstreams.js server.js',
      url: `http://localhost:${serverPort}/`,
      env: { DESCENT_PORT: String(serverPort), DESCENT_FAKE_PORT: String(fakePort) },
      reuseExistingServer: !process.env.CI
    },
    {
      command: `node test/browser/https.js ${port} ${serverPort}`,
      url: `https://localhost:${port}/`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env.CI
    }
  ]
});

export { fakePort };
