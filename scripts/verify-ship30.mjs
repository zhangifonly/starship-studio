import { chromium, webkit, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
const engine = process.argv.includes('--webkit') ? webkit : chromium;
const smoke = process.argv.includes('--smoke'), visualOnly = process.argv.includes('--visual-only');
const powered = process.argv.includes('--powered'), start = powered ? 60 : 120, directory = powered ? 'ship30-powered' : 'ship30';
const sizes = smoke ? [[1440, 1000], [390, 844]] : [[1440, 1000], [390, 844], [768, 1024], [320, 568], [844, 390]];
await mkdir(`artifacts/${directory}`, { recursive: true });
const browser = await engine.launch({ headless: true });
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 900 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', r => { if (!(/\/narration\/.*\.mp3$/.test(r.url()) && ['net::ERR_ABORTED', 'cancelled'].includes(r.failure()?.errorText))) errors.push(`${r.failure()?.errorText} ${r.url()}`); });
    await page.goto(`${base}/#mission/flight-5/overview?t=${start}&camera=ship-close`, { waitUntil: 'networkidle' });
    const canvas = page.getByTestId('flight-globe'), slider = page.getByRole('slider', { name: '全程复盘进度' }), select = page.getByRole('combobox', { name: '航迹视角' });
    await expect(canvas).toHaveAttribute('data-ready', 'true'); await expect(canvas).toHaveAttribute('data-ship-near', 'true');
    await canvas.evaluate(el => { el.dataset.identity = 'persistent'; });
    const frame = () => canvas.evaluate(el => { const r = el.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.width, r.height, el.width, el.height]; });
    const stableFrame = await frame();
    const pixels = async () => Buffer.from(await canvas.evaluate(el => el.toDataURL().split(',')[1]), 'base64');
    for (const camera of ['ship-close', 'ship-heat']) {
      await select.selectOption(camera); await expect(canvas).toHaveAttribute('data-camera', camera);
      let initial, splash;
      for (const t of powered ? [60, 75, 90, 100, 110, 119, 119.5, 119.9, 120, 121, 60] : [120, 130, 140, 146, 155, 160, 164, 170, 179, 180, 200, 120]) {
        await slider.fill(String(t)); await expect(canvas).toHaveAttribute('data-time', t.toFixed(2));
        await expect(canvas).toHaveAttribute('data-ship-near', 'true'); await expect(canvas).toHaveAttribute('data-ship-local', '0,0,0');
        await expect(canvas).toHaveAttribute('data-ship-engines', '6'); await expect(canvas).toHaveAttribute('data-ship-splash', String(t >= 180));
        if (t < 164 || t >= 180) expect(Number(await canvas.getAttribute('data-ship-power'))).toBe(0);
        if (t === 146) expect(Number(await canvas.getAttribute('data-ship-heat'))).toBeGreaterThan(.9);
        if (powered) {
          const power = Number(await canvas.getAttribute('data-ship-ascent-power'));
          if (t <= 119) expect(power).toBe(1);
          else if (t < 120) { expect(power).toBeGreaterThan(0); expect(power).toBeLessThan(1); }
          else expect(power).toBe(0);
          for (const [x, y] of JSON.parse(await canvas.getAttribute('data-ship-envelope'))) {
            expect(x).toBeGreaterThan(.01); expect(x).toBeLessThan(.99); expect(y).toBeGreaterThan(.01); expect(y).toBeLessThan(.99);
          }
        }
        const buffer = await pixels(), png = PNG.sync.read(buffer), colors = new Set();
        for (let y = Math.floor(png.height * .27); y < png.height * .78; y++) for (let x = Math.floor(png.width * .3); x < png.width * .65; x++) {
          const i = (y * png.width + x) * 4; colors.add(`${png.data[i] >> 3},${png.data[i + 1] >> 3},${png.data[i + 2] >> 3}`);
        }
        await page.screenshot({ path: `artifacts/${directory}/${engine.name()}-${width}-${camera}-${t}.png`, fullPage: true });
        expect(colors.size, `${camera} at ${t}s / ${width}px main-view pixels`).toBeGreaterThan(30);
        if (t === start) { if (initial) expect(Buffer.compare(initial, buffer)).toBe(0); else initial = buffer; }
        if (t === 180) splash = buffer; if (t === 200) expect(Buffer.compare(splash, buffer)).toBe(0);
      }
    }
    await slider.fill(powered ? '90' : '146'); await expect(canvas).toHaveAttribute('data-time', powered ? '90.00' : '146.00');
    const ship = await canvas.getAttribute('data-ship'), booster = await canvas.getAttribute('data-booster');
    for (const camera of ['global', 'return', 'ship-heat', 'ground', 'ship-close']) {
      await select.selectOption(camera); await expect(canvas).toHaveAttribute('data-camera', camera);
      expect(await canvas.getAttribute('data-ship')).toBe(ship); expect(await canvas.getAttribute('data-booster')).toBe(booster);
      await expect(canvas).toHaveAttribute('data-identity', 'persistent');
    }
    const before = await pixels(); await page.getByRole('button', { name: '航迹放大', exact: true }).click();
    await expect.poll(async () => Buffer.compare(before, await pixels())).not.toBe(0);
    await page.getByRole('button', { name: '重置航迹视角', exact: true }).click(); await expect.poll(async () => Buffer.compare(before, await pixels())).toBe(0);
    await slider.fill('59.9'); await expect(canvas).toHaveAttribute('data-ship-near', 'false');
    await slider.fill('120'); await expect(canvas).toHaveAttribute('data-ship-near', 'true');
    if (!visualOnly) {
      await slider.fill(powered ? '119.5' : '159.5'); await page.getByRole('button', { name: '播放全程复盘', exact: true }).click();
      await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(powered ? 120.4 : 160.4);
      await expect(page.getByTestId('overview-audio')).toHaveAttribute('src', powered ? /flight5-overview-7-/ : /flight5-overview-9-/);
      await expect.poll(() => page.getByTestId('overview-audio').evaluate(el => !el.paused && el.currentTime > .1)).toBe(true);
      await page.getByRole('button', { name: '暂停全程复盘', exact: true }).click();
    }
    expect(await frame()).toEqual(stableFrame); await expect(canvas).toHaveAttribute('data-identity', 'persistent');
    expect(await page.locator('canvas').count()).toBe(1); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]); console.log(JSON.stringify({ engine: engine.name(), width, height, errors })); await page.close();
  }
} finally { await browser.close(); }
