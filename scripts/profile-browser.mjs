import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { browserRuntime } from './browser-runtime.mjs';

const browser = await chromium.launch(await browserRuntime());
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(`${process.env.GAME_URL ?? 'http://127.0.0.1:5173'}/?qa=1`);
  await page.waitForFunction(() => Boolean(window.__BD_QA__));
  const driver = await page.evaluate(() => {
    const gl = document.getElementById('gameCanvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  const samples = [];
  for (const quality of ['balanced', 'low']) {
    await page.locator('#fieldButton').click();
    await page.locator('#qualitySelect').selectOption(quality);
    await page.locator('#resumeButton').click();
    await page.waitForTimeout(2000); // Shader warm-up, not included in the sample.
    const sample = await page.evaluate(async () => {
      const start = performance.now(); const frames = window.__BD_QA__.snapshot().stats.renderedFrames;
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const ms = performance.now() - start;
      const stats = window.__BD_QA__.snapshot().stats;
      return { ...stats, sampleMilliseconds: Math.round(ms), sampleFrames: stats.renderedFrames - frames, fps: Math.round((stats.renderedFrames - frames) / ms * 10_000) / 10, jsHeapBytes: performance.memory?.usedJSHeapSize ?? null };
    });
    samples.push({ quality, ...sample });
  }
  await page.locator('#fieldButton').click(); await page.waitForTimeout(250);
  const framesBefore = await page.evaluate(() => window.__BD_QA__.snapshot().stats.renderedFrames);
  await page.waitForTimeout(1200);
  const framesAfter = await page.evaluate(() => window.__BD_QA__.snapshot().stats.renderedFrames);
  const result = { environment: 'Headless Chromium / sandbox software rendering, NOT N100 or Android hardware', browser: browser.version(), driver, viewport: '1280×720, DPR 1', samples, pausedFramesOver1200ms: framesAfter - framesBefore };
  await mkdir('.artifacts', { recursive: true });
  await writeFile('.artifacts/performance.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
