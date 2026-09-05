import { chromium, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
await mkdir('artifacts/launch', { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], report = [];
function pixels(buffer) {
  const png = PNG.sync.read(buffer);
  const colors = new Set();
  let bright = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i] > 160 && png.data[i + 1] > 160 && png.data[i + 2] > 160) bright++;
    colors.add(`${png.data[i] >> 4},${png.data[i + 1] >> 4},${png.data[i + 2] >> 4}`);
  }
  return { bright, colors: colors.size };
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${base}/#launch`, { waitUntil: 'networkidle' });
  const canvas = page.getByTestId('launch-canvas');
  const slider = page.getByRole('slider', { name: '发射演示进度' });
  await expect(page.getByRole('button', { name: '播放发射演示', exact: true })).toBeEnabled();
  await expect(canvas).toHaveAttribute('data-textures', 'ready');
  async function seek(time) {
    await slider.fill(String(time));
    await expect(canvas).toHaveAttribute('data-time', time.toFixed(2));
    await page.waitForTimeout(180);
  }
  if (process.argv.includes('--mobile-globe')) {
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await seek(103);
      await page.getByRole('combobox', { name: '发射视角' }).selectOption('earth');
      await expect(canvas).toHaveAttribute('data-camera', 'earth');
      const sample = pixels(await canvas.screenshot());
      expect(sample.colors).toBeGreaterThan(100);
      await page.screenshot({ path: `artifacts/launch/viewport-${width}-earth.png` });
      report.push({ test: `mobile globe ${width}`, ...sample });
    }
  } else {
  let initial;
  for (const time of (process.argv.includes('--visual-only') ? [0, 58, 90, 103, 122, 159] : [0, 9, 18, 34, 46, 58, 76, 90, 103, 122, 147, 159, 166])) {
    await seek(time);
    const buffer = await canvas.screenshot(), sample = pixels(buffer);
    expect(sample.colors).toBeGreaterThan(30);
    expect(sample.bright).toBeGreaterThan(120);
    if (time === 0) initial = buffer;
    await page.screenshot({ path: `artifacts/launch/desktop-${time}.png` });
    report.push({ test: `phase at ${time}s`, ...sample });
  }
  if (!process.argv.includes('--visual-only')) {
  await expect(canvas).toHaveAttribute('data-separated', 'true');
  await expect(canvas).toHaveAttribute('data-captured', 'true');
  await expect(canvas).toHaveAttribute('data-landed', 'true');
  await page.getByRole('button', { name: '重播发射演示', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '暂停发射演示', exact: true }).click();
  expect(Number(await slider.inputValue())).toBeLessThan(5);
  const paused = await slider.inputValue();
  await page.waitForTimeout(350);
  expect(await slider.inputValue()).toBe(paused);
  await page.getByRole('button', { name: '从头开始发射演示' }).click();
  await seek(0);
  await expect(canvas).toHaveAttribute('data-separated', 'false');
  await expect(canvas).toHaveAttribute('data-captured', 'false');
  await expect(canvas).toHaveAttribute('data-landed', 'false');
  expect(Buffer.compare(initial, await canvas.screenshot())).toBe(0);
  for (const rate of ['0.5', '2']) {
    await seek(10);
    await page.getByRole('combobox', { name: '发射演示播放速度' }).selectOption(rate);
    const started = await page.evaluate(() => performance.now());
    await page.getByRole('button', { name: '播放发射演示', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: '暂停发射演示', exact: true }).click();
    const elapsed = Number(await slider.inputValue()) - 10;
    const wallSeconds = ((await page.evaluate(() => performance.now())) - started) / 1000;
    expect(elapsed / wallSeconds).toBeGreaterThan(Number(rate) * .5);
    expect(elapsed / wallSeconds).toBeLessThan(Number(rate) * 1.3);
    report.push({ test: `playback ${rate}x`, elapsed });
  }
  await page.getByRole('button', { name: '跳转到热分离', exact: true }).click();
  await expect(page.getByTestId('launch-phase-title')).toHaveText('热分离');
  await expect(slider).toHaveValue('40');
  await page.getByRole('button', { name: '上一发射阶段' }).click();
  await expect(slider).toHaveValue('24');
  await page.getByRole('button', { name: '下一发射阶段' }).click();
  await expect(slider).toHaveValue('40');
  await seek(103);
  for (const mode of ['earth', 'ship', 'booster', 'ground', 'cinematic']) {
    await page.getByRole('combobox', { name: '发射视角' }).selectOption(mode);
    await expect(canvas).toHaveAttribute('data-camera', mode);
    const sample = pixels(await canvas.screenshot());
    expect(sample.colors).toBeGreaterThan(30);
    await page.screenshot({ path: `artifacts/launch/camera-${mode}.png` });
    report.push({ test: `camera ${mode}`, ...sample });
  }
  await page.getByRole('button', { name: '解说字幕' }).click();
  await expect(page.locator('.with-narration')).toContainText('镜头回到星舰');
  await page.getByRole('button', { name: '解说字幕' }).click();
  await seek(165.5);
  await page.getByRole('button', { name: '播放发射演示', exact: true }).click();
  await expect(page.getByRole('button', { name: '重播发射演示', exact: true })).toBeVisible();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 20, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('checkbox', { name: '跟随镜头' })).not.toBeChecked();
  await page.getByRole('button', { name: '重置发射视角' }).click();
  await expect(page.getByRole('checkbox', { name: '跟随镜头' })).toBeChecked();
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 768, height: 1024 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const time of [0, 90, 122, 159]) {
      await seek(time);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const controls = await page.getByRole('button', { name: '从头开始发射演示' }).boundingBox();
      expect(controls.y + controls.height).toBeLessThanOrEqual(viewport.height);
      const sample = pixels(await canvas.screenshot());
      expect(sample.colors).toBeGreaterThan(30);
      expect(sample.bright).toBeGreaterThan(40);
      await page.screenshot({ path: `artifacts/launch/viewport-${viewport.width}-${time}.png` });
    }
    report.push({ test: `viewport ${viewport.width}x${viewport.height}`, passed: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('link', { name: '结构探索' }).click();
  await expect(page.getByTestId('rocket-canvas')).toBeVisible();
  await page.getByRole('button', { name: '全部展开', exact: true }).click();
  await page.getByRole('link', { name: '发射演示' }).click();
  await expect(canvas).toBeVisible();
  await page.getByRole('link', { name: '结构探索' }).click();
  await expect(page.getByTestId('explosion-value')).toHaveText('100%');
  } else {
    await seek(103);
    await page.getByRole('combobox', { name: '发射视角' }).selectOption('earth');
    await page.screenshot({ path: 'artifacts/launch/camera-earth.png' });
    await page.getByRole('combobox', { name: '发射视角' }).selectOption('cinematic');
    await page.setViewportSize({ width: 390, height: 844 });
    await seek(122);
    await page.screenshot({ path: 'artifacts/launch/viewport-390-122.png' });
    await seek(159);
    await page.screenshot({ path: 'artifacts/launch/viewport-390-159.png' });
  }
  }
  expect(errors).toEqual([]);
  const reportFile = process.argv.includes('--mobile-globe') ? 'mobile-globe' : 'verification';
  await writeFile(`artifacts/launch/${reportFile}.json`, JSON.stringify({ base, errors, report }, null, 2));
  console.log(JSON.stringify({ errors, report }, null, 2));
} finally { await browser.close(); }
