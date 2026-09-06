import { chromium, webkit, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
const engine = process.argv.includes('--webkit') ? webkit : chromium;
const smoke = process.argv.includes('--smoke'), visualOnly = process.argv.includes('--visual-only');
const sizes = smoke ? [[1440, 1000], [390, 844]] : [[1440, 1000], [390, 844], [768, 1024], [320, 568], [844, 390]];
await mkdir('artifacts/return', { recursive: true });
const browser = await engine.launch({ headless: true });
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 900 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', r => {
      const cancelledAudio = /\/narration\/.*\.mp3$/.test(r.url()) && ['net::ERR_ABORTED', 'cancelled'].includes(r.failure()?.errorText);
      if (!cancelledAudio) errors.push(`${r.failure()?.errorText} ${r.url()}`);
    });
    await page.goto(`${base}/#mission/flight-5/overview?t=60&camera=return`, { waitUntil: 'networkidle' });
    const canvas = page.getByTestId('flight-globe'), slider = page.getByRole('slider', { name: '全程复盘进度' });
    const select = page.getByRole('combobox', { name: '航迹视角' });
    await expect(canvas).toHaveAttribute('data-ready', 'true');
    await expect(canvas).toHaveAttribute('data-near', 'true');
    await canvas.evaluate(el => { el.dataset.identity = 'persistent'; });
    const frame = () => canvas.evaluate(el => { const r = el.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.width, r.height, el.width, el.height]; });
    const stableFrame = await frame();
    const pixels = async () => Buffer.from(await canvas.evaluate(el => el.toDataURL().split(',')[1]), 'base64');
    for (const camera of ['return', 'ground']) {
      await select.selectOption(camera); await expect(canvas).toHaveAttribute('data-camera', camera);
      let initial, groundFov;
      for (const t of [60, 70, 80, 90, 99.9, 100, 101, 120, 60]) {
        await slider.fill(String(t)); await expect(canvas).toHaveAttribute('data-time', t.toFixed(2));
        await expect(canvas).toHaveAttribute('data-near', 'true');
        await expect(canvas).toHaveAttribute('data-near-contact', String(t >= 100));
        await expect(canvas).toHaveAttribute('data-near-plume', String(t >= 80 && t < 101));
        const fins = JSON.parse(await canvas.getAttribute('data-fin-angles'));
        expect(fins).toHaveLength(4);
        if (t === 60 || Number(await canvas.getAttribute('data-mission-time')) >= 412) expect(fins).toEqual([0, 0, 0, 0]);
        else expect(fins.some(angle => Math.abs(angle) > .00001)).toBe(true);
        if (camera === 'ground') {
          await expect(canvas).toHaveAttribute('data-near-camera', '30,1.8,100');
          const fov = Number(await canvas.getAttribute('data-near-fov'));
          if (t === 60) groundFov = fov;
          if (t === 100) expect(fov).toBeGreaterThan(groundFov * 10);
        }
        const buffer = await pixels(), png = PNG.sync.read(buffer), colors = new Set();
        // Inspect the central main view, excluding the Earth inset and DOM text.
        for (let y = Math.floor(png.height * .27); y < png.height * .78; y++) for (let x = Math.floor(png.width * .35); x < png.width * .65; x++) {
          const i = (y * png.width + x) * 4; colors.add(`${png.data[i] >> 3},${png.data[i + 1] >> 3},${png.data[i + 2] >> 3}`);
        }
        expect(colors.size, `${camera} at ${t}s / ${width}px main-view pixels`).toBeGreaterThan(35);
        if (t === 60) { if (initial) expect(Buffer.compare(initial, buffer)).toBe(0); else initial = buffer; }
        if (!smoke || [60, 80, 100, 120].includes(t)) await page.screenshot({ path: `artifacts/return/${engine.name()}-${width}-${camera}-${t}.png`, fullPage: true });
      }
    }
    await slider.fill('100'); await expect(canvas).toHaveAttribute('data-time', '100.00');
    const position = await canvas.getAttribute('data-booster');
    for (const camera of ['global', 'return', 'booster', 'ground']) {
      await select.selectOption(camera); await expect(canvas).toHaveAttribute('data-camera', camera);
      expect(await canvas.getAttribute('data-booster')).toBe(position);
      await expect(canvas).toHaveAttribute('data-identity', 'persistent');
    }
    const before = await pixels();
    await page.getByRole('button', { name: '航迹放大', exact: true }).click();
    await expect.poll(async () => Buffer.compare(before, await pixels())).not.toBe(0);
    await page.getByRole('button', { name: '重置航迹视角', exact: true }).click();
    await expect.poll(async () => Buffer.compare(before, await pixels())).toBe(0);
    await slider.fill('59.9'); await expect(canvas).toHaveAttribute('data-near', 'false');
    await slider.fill('60'); await expect(canvas).toHaveAttribute('data-near', 'true');
    if (!visualOnly) {
      await slider.fill('99.5');
      await page.getByRole('button', { name: '播放全程复盘', exact: true }).click();
      await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(100.4);
      await expect(page.getByTestId('overview-audio')).toHaveAttribute('src', /flight5-overview-6-/);
      await expect.poll(() => page.getByTestId('overview-audio').evaluate(el => !el.paused && el.currentTime > .1)).toBe(true);
      await page.getByRole('button', { name: '暂停全程复盘', exact: true }).click();
    }
    expect(await frame()).toEqual(stableFrame);
    await expect(canvas).toHaveAttribute('data-identity', 'persistent');
    expect(await page.locator('canvas').count()).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    console.log(JSON.stringify({ engine: engine.name(), width, height, errors }));
    await page.close();
  }
} finally { await browser.close(); }
