import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3017';
await mkdir('artifacts/public', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [], privateRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => { if (/\/references\/|\.mp3(?:\?|$)/.test(request.url())) privateRequests.push(request.url()); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '参考图纸', exact: true }).click();
  await expect(page.locator('dialog a[href="https://www.faa.gov/media/27236#page=39"]')).toBeVisible();
  await expect(page.locator('dialog img')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByTestId('part-booster-engines').click();
  await page.getByRole('button', { name: '单台发动机精查' }).click();
  await expect(page.getByTestId('rocket-canvas')).toHaveAttribute('data-components', '8');
  await page.getByRole('button', { name: '返回箭体' }).click();
  await page.getByRole('link', { name: '发射演示' }).click();
  await expect(page.getByTestId('launch-canvas')).toHaveAttribute('data-textures', 'ready');
  await expect(page.getByRole('button', { name: '中文语音解说', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '播放发射演示', exact: true }).click();
  await expect.poll(async () => Number(await page.getByTestId('launch-canvas').getAttribute('data-time'))).toBeGreaterThan(.3);
  await page.getByRole('button', { name: '暂停发射演示' }).click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const png = PNG.sync.read(await page.getByTestId('launch-canvas').screenshot());
    const colors = new Set();
    for (let i = 0; i < png.data.length; i += 4) colors.add(`${png.data[i] >> 4},${png.data[i + 1] >> 4},${png.data[i + 2] >> 4}`);
    expect(colors.size).toBeGreaterThan(30);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/public/${width}.png` });
  }
  expect(privateRequests).toEqual([]); expect(errors).toEqual([]);
  console.log('Passed: clean public build, external reference links, Raptor viewer, Earth imagery, working silent flight, no missing/private asset requests, desktop/mobile canvas pixels.');
} finally { await browser.close(); }
