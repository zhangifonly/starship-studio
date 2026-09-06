import { chromium, webkit, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
const engine = process.argv.includes('--webkit') ? webkit : chromium;
await mkdir('artifacts/grid-fins', { recursive: true });
const browser = await engine.launch({ headless: true });
try {
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 568], [768, 1024], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}/#mission/flight-5/overview?t=75&camera=return`, { waitUntil: 'networkidle' });
    const canvas = page.getByTestId('flight-globe'), slider = page.getByRole('slider', { name: '全程复盘进度' });
    await expect(canvas).toHaveAttribute('data-ready', 'true');
    const frame = () => canvas.evaluate(el => { const r = el.getBoundingClientRect(); return [r.width, r.height, el.width, el.height]; });
    const originalFrame = await frame();
    await canvas.evaluate(el => { el.dataset.identity = 'fin-test'; });
    const angles = () => canvas.getAttribute('data-fin-angles').then(JSON.parse);
    const image = () => canvas.evaluate(el => el.toDataURL());
    const initial = await angles(), pixels = await image();
    expect(new Set(initial).size).toBe(4);
    const png = PNG.sync.read(Buffer.from(pixels.split(',')[1], 'base64')), colors = new Set();
    for (let y = Math.floor(png.height * .27); y < png.height * .78; y++) for (let x = Math.floor(png.width * .35); x < png.width * .65; x++) {
      const i = (y * png.width + x) * 4; colors.add(`${png.data[i] >> 3},${png.data[i + 1] >> 3},${png.data[i + 2] >> 3}`);
    }
    expect(colors.size).toBeGreaterThan(35);
    await page.screenshot({ path: `artifacts/grid-fins/${engine.name()}-${width}-descent.png`, fullPage: true });
    await slider.fill('77'); await expect(canvas).toHaveAttribute('data-time', '77.00');
    expect(await angles()).not.toEqual(initial); expect(await image()).not.toBe(pixels);
    await slider.fill('75'); await expect(canvas).toHaveAttribute('data-time', '75.00');
    expect(await angles()).toEqual(initial); expect(await image()).toBe(pixels);
    const select = page.getByRole('combobox', { name: '航迹视角' });
    await select.selectOption('ground'); await expect(canvas).toHaveAttribute('data-camera', 'ground');
    expect(await angles()).toEqual(initial);
    await select.selectOption('return'); await expect(canvas).toHaveAttribute('data-camera', 'return');
    expect(await image()).toBe(pixels);
    await select.selectOption('fins'); await expect(canvas).toHaveAttribute('data-camera', 'fins');
    expect(await angles()).toEqual(initial);
    const finPixels = await image(); expect(finPixels).not.toBe(pixels);
    for (const [x, y] of JSON.parse(await canvas.getAttribute('data-fin-centers'))) {
      expect(x).toBeGreaterThan(.12); expect(x).toBeLessThan(.88);
      expect(y).toBeGreaterThan(.25); expect(y).toBeLessThan(.82);
    }
    await page.screenshot({ path: `artifacts/grid-fins/${engine.name()}-${width}-detail.png`, fullPage: true });
    await page.getByRole('button', { name: '航迹放大', exact: true }).click();
    await expect.poll(async () => (await image()) !== finPixels).toBe(true);
    await page.getByRole('button', { name: '重置航迹视角', exact: true }).click();
    await expect.poll(image).toBe(finPixels);
    await slider.fill('77'); await expect(canvas).toHaveAttribute('data-time', '77.00');
    await slider.fill('75'); await expect(canvas).toHaveAttribute('data-time', '75.00');
    expect(await image()).toBe(finPixels);
    const overviewAngles = new Map();
    for (const time of [80, 90, 100]) {
      await slider.fill(String(time)); await expect(canvas).toHaveAttribute('data-time', `${time}.00`);
      overviewAngles.set((time - 80) * 1.15, await angles());
    }
    if (!process.argv.includes('--visual-only')) {
      await slider.fill('99.5');
      await page.getByRole('button', { name: '播放全程复盘', exact: true }).click();
      await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(100.4);
      const audio = page.getByTestId('overview-audio');
      await expect(audio).toHaveAttribute('src', /flight5-overview-6-/);
      await expect.poll(() => audio.evaluate(el => !el.paused && el.currentTime > .1)).toBe(true);
      await page.getByRole('button', { name: '暂停全程复盘', exact: true }).click();
    }
    expect(await frame()).toEqual(originalFrame);
    await slider.fill('10'); await select.selectOption('ascent');
    await expect(canvas).toHaveAttribute('data-ascent-near', 'true');
    expect(await angles()).toEqual([0, 0, 0, 0]);
    await expect(canvas).toHaveAttribute('data-identity', 'fin-test');
    await page.goto(`${base}/#mission/flight-5?t=0&camera=tracking&dual=1`, { waitUntil: 'networkidle' });
    const capture = page.getByTestId('mission-canvas');
    await expect(capture).toHaveAttribute('data-ready', 'true');
    const captureSlider = page.getByRole('slider', { name: '捕获片段进度' });
    for (const [time, expected] of overviewAngles) {
      await captureSlider.fill(String(time)); await expect(capture).toHaveAttribute('data-time', time.toFixed(2));
      const actual = JSON.parse(await capture.getAttribute('data-fin-angles'));
      actual.forEach((angle, i) => expect(angle).toBeCloseTo(expected[i], 10));
    }
    await page.screenshot({ path: `artifacts/grid-fins/${engine.name()}-${width}-captured.png`, fullPage: true });
    expect(await page.locator('canvas').count()).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    console.log(JSON.stringify({ engine: engine.name(), width, height, angles: initial, errors }));
    await page.close();
  }
} finally { await browser.close(); }
