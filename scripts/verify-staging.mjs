import { chromium, webkit, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
const engine = process.argv.includes('--webkit') ? webkit : chromium;
const smoke = process.argv.includes('--smoke'), visualOnly = process.argv.includes('--visual-only');
const sizes = smoke ? [[1440, 1000], [390, 844]] : [[1440, 1000], [390, 844], [768, 1024], [320, 568], [844, 390]];
await mkdir('artifacts/staging', { recursive: true });
const browser = await engine.launch({ headless: true });
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 900 }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', r => { if (!(/\/narration\/.*\.mp3$/.test(r.url()) && ['net::ERR_ABORTED', 'cancelled'].includes(r.failure()?.errorText))) errors.push(`${r.failure()?.errorText} ${r.url()}`); });
    await page.goto(`${base}/#mission/flight-5/overview?t=19.2&camera=staging`, { waitUntil: 'networkidle' });
    const canvas = page.getByTestId('flight-globe'), slider = page.getByRole('slider', { name: '全程复盘进度' }), select = page.getByRole('combobox', { name: '航迹视角' });
    await expect(canvas).toHaveAttribute('data-ready', 'true'); await expect(canvas).toHaveAttribute('data-staging-detail', 'true');
    await canvas.evaluate(el => { el.dataset.identity = 'persistent'; });
    const frame = () => canvas.evaluate(el => { const r = el.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.width, r.height, el.width, el.height]; });
    const initialFrame = await frame(), pixels = async () => Buffer.from(await canvas.evaluate(el => el.toDataURL().split(',')[1]), 'base64');
    for (const camera of ['ascent', 'ascent-ground', 'staging']) {
      await select.selectOption(camera); await expect(canvas).toHaveAttribute('data-camera', camera);
      let initial, previousGap = 0;
      for (const t of [19.2, 19.9, 20, 22, 26, 30, 36, 39.9, 19.2]) {
        await slider.fill(String(t)); await expect(canvas).toHaveAttribute('data-time', t.toFixed(2));
        await expect(canvas).toHaveAttribute('data-ascent-near', 'true'); await expect(canvas).toHaveAttribute('data-ascent-ring', 'true');
        await expect(canvas).toHaveAttribute('data-staging-detail', String(camera === 'staging'));
        const gap = Number(await canvas.getAttribute('data-staging-gap')), power = Number(await canvas.getAttribute('data-staging-ship-power'));
        if (t >= 20) { expect(gap).toBeGreaterThanOrEqual(previousGap); expect(power).toBe(1); previousGap = gap; }
        if (t === 19.2) expect(power).toBe(0);
        if (t >= 19.9) await expect(canvas).toHaveAttribute('data-ascent-engines', '3');
        const b = JSON.parse(await canvas.getAttribute('data-ascent-local')), s = JSON.parse(await canvas.getAttribute('data-staging-ship-local'));
        expect(Math.hypot(s.x - b.x, s.y - b.y, s.z - b.z)).toBeCloseTo(7.01 + gap, 5);
        const buffer = await pixels(), png = PNG.sync.read(buffer), colors = new Set();
        for (let y = Math.floor(png.height * .25); y < png.height * .8; y++) for (let x = Math.floor(png.width * .25); x < png.width * .6; x++) {
          const i = (y * png.width + x) * 4; colors.add(`${png.data[i] >> 3},${png.data[i + 1] >> 3},${png.data[i + 2] >> 3}`);
        }
        expect(colors.size, `${camera}/${t}/${width} main pixels`).toBeGreaterThan(30);
        if (camera === 'staging') {
          const collar = (await canvas.getAttribute('data-staging-collar')).split(',').map(Number);
          expect(collar[0] > .03 && collar[0] < .63 && collar[1] > .04 && collar[1] < .94, 'collar remains visible clear of inset').toBe(true);
        }
        await page.screenshot({ path: `artifacts/staging/${engine.name()}-${width}-${camera}-${t}.png`, fullPage: true });
        if (t === 19.2) { if (initial) expect(Buffer.compare(initial, buffer)).toBe(0); else initial = buffer; }
      }
    }
    await slider.fill('26'); await expect(canvas).toHaveAttribute('data-time', '26.00');
    const ship = await canvas.getAttribute('data-ship'), booster = await canvas.getAttribute('data-booster');
    for (const camera of ['global', 'return', 'ship-close', 'ascent', 'staging']) {
      await select.selectOption(camera); await expect(canvas).toHaveAttribute('data-camera', camera);
      expect(await canvas.getAttribute('data-ship')).toBe(ship); expect(await canvas.getAttribute('data-booster')).toBe(booster);
    }
    const original = await pixels(); await page.getByRole('button', { name: '航迹放大', exact: true }).click();
    await expect.poll(async () => Buffer.compare(original, await pixels())).not.toBe(0);
    await page.getByRole('button', { name: '重置航迹视角', exact: true }).click(); await expect.poll(async () => Buffer.compare(original, await pixels())).toBe(0);
    await slider.fill('19.1'); await expect(canvas).toHaveAttribute('data-staging-detail', 'false');
    await slider.fill('40'); await expect(canvas).toHaveAttribute('data-ascent-near', 'false');
    if (!visualOnly) {
      await slider.fill('19.5'); await page.getByRole('button', { name: '播放全程复盘', exact: true }).click();
      await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(20.4);
      await expect(page.getByTestId('overview-audio')).toHaveAttribute('src', /flight5-overview-2-/);
      await expect.poll(() => page.getByTestId('overview-audio').evaluate(el => !el.paused && el.currentTime > .1)).toBe(true);
      await page.getByRole('button', { name: '暂停全程复盘', exact: true }).click();
    }
    await expect(canvas).toHaveAttribute('data-identity', 'persistent'); expect(await frame()).toEqual(initialFrame);
    expect(await page.locator('canvas').count()).toBe(1); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]); console.log(JSON.stringify({ engine: engine.name(), width, height, errors })); await page.close();
  }
} finally { await browser.close(); }
