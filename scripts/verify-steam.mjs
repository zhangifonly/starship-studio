import { chromium, webkit, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
const engine = process.argv.includes('--webkit') ? webkit : chromium;
const sizes = process.argv.includes('--smoke') ? [[1440, 1000], [390, 844]] : [[1440, 1000], [390, 844], [320, 568], [768, 1024], [844, 390]];
await mkdir('artifacts/steam', { recursive: true });
const browser = await engine.launch();
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 900 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    for (const historical of [false, true]) {
      await page.goto(`${base}/${historical ? '#mission/flight-5/overview?camera=ascent' : '#launch'}`, { waitUntil: 'networkidle' });
      const canvas = page.getByTestId(historical ? 'flight-globe' : 'launch-canvas');
      await expect(canvas).toHaveAttribute(historical ? 'data-ready' : 'data-textures', historical ? 'true' : 'ready');
      const slider = page.getByRole('slider', { name: historical ? '全程复盘进度' : '发射演示进度' });
      const camera = page.getByRole('combobox', { name: historical ? '航迹视角' : '发射视角' });
      const pixels = () => canvas.evaluate(el => el.toDataURL());
      for (const mode of historical ? ['ascent', 'ascent-ground'] : ['cinematic', 'ground', 'pad']) {
        await camera.selectOption(mode); await expect(canvas).toHaveAttribute('data-camera', mode);
        let first;
        for (const t of historical ? [.3, .8, 1.5, 3, 6, .3] : [5, 9, 12, 16, 28, 40, 5]) {
          await slider.fill(String(t)); await expect(canvas).toHaveAttribute('data-time', t.toFixed(2));
          const snapshot = await pixels(), png = PNG.sync.read(Buffer.from(snapshot.split(',')[1], 'base64'));
          let white = 0;
          for (let y = Math.floor(png.height * .35); y < png.height * .95; y++) for (let x = Math.floor(png.width * .12); x < png.width * .78; x++) {
            const i = (y * png.width + x) * 4, r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
            if (Math.min(r, g, b) > 185 && Math.max(r, g, b) - Math.min(r, g, b) < 18) white++;
          }
          if ((historical && t <= 1.5) || (!historical && t >= 9 && t <= 16)) {
            expect(white, `white cloud pixels ${width}/${mode}/${t}`).toBeGreaterThan(50);
            if (!historical) expect(Number(await canvas.getAttribute('data-steam'))).toBeGreaterThan(20);
          }
          if (!historical && [5, 40].includes(t)) await expect(canvas).toHaveAttribute('data-steam', '0');
          if (t === (historical ? .3 : 5)) { if (first) expect(snapshot).toBe(first); else first = snapshot; }
          await page.screenshot({ path: `artifacts/steam/${engine.name()}-${width}-${mode}-${t}.png`, fullPage: true });
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('canvas').count()).toBe(1);
    }
    expect(errors).toEqual([]); console.log(JSON.stringify({ engine: engine.name(), width, height, errors })); await page.close();
  }
} finally { await browser.close(); }
