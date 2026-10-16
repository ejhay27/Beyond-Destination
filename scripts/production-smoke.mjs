import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { browserRuntime } from './browser-runtime.mjs';

const origin = process.env.GAME_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch(await browserRuntime());
const errors = [], externalRequests = [];
try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const listen = (page) => {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', (request) => { if (!request.url().startsWith(`${origin}/`)) externalRequests.push(request.url()); });
  };
  listen(desktop);
  await desktop.goto(`${origin}/?qa=1`);
  await desktop.waitForFunction(() => !document.getElementById('loadingScreen'));
  assert.equal(await desktop.evaluate(() => '__BD_QA__' in window), false, 'Production must not expose developer hooks');
  await desktop.locator('#fieldButton').click();
  let fullscreen = 'not exposed by this browser';
  if (await desktop.locator('#fullscreenButton').isVisible()) {
    await desktop.locator('#fullscreenButton').click();
    await desktop.waitForFunction(() => Boolean(document.fullscreenElement));
    fullscreen = 'entered and exited through the actual button';
    await desktop.locator('#fullscreenButton').click();
    await desktop.waitForFunction(() => !document.fullscreenElement);
  }
  await desktop.locator('#saveButton').click();
  const save = await desktop.evaluate(() => JSON.parse(localStorage.getItem('beyond-destination.v1.slot-1')));
  assert.equal(save.schemaVersion, 2); assert.equal(save.state.credits, 85);
  await desktop.close();
  const mobile = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  listen(mobile);
  await mobile.goto(origin);
  await mobile.waitForFunction(() => !document.getElementById('loadingScreen'));
  assert.equal(await mobile.locator('#touchControls').isVisible(), true);
  await mobile.locator('[data-input-action="phone"]').tap();
  await mobile.waitForFunction(() => document.getElementById('fieldTitle').textContent === 'A day by the bay.');
  assert.match(await mobile.locator('#fieldTitle').innerText(), /A day by the bay/);
  await mobile.locator('#resumeButton').tap();
  await mkdir('.artifacts', { recursive: true });
  await mobile.screenshot({ path: '.artifacts/production-mobile-landscape.png' });
  assert.deepEqual(externalRequests, [], 'The game must use no runtime CDN or network game server');
  assert.deepEqual(errors, []);
  const report = { browser: browser.version(), desktop: 'boot, save, no QA hooks', fullscreen, mobile: '844×390 touch boot, journal and resume', externalRequests, errors, apkBuilt: false };
  await writeFile('.artifacts/production-smoke.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
