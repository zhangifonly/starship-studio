import { chromium, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { mkdir } from 'node:fs/promises';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
const grip = process.argv.includes('--grip');
await mkdir('artifacts/launch-site', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of [[1440, 1000], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}/#launch`, { waitUntil: 'networkidle' });
    const canvas = page.getByTestId('launch-canvas');
    await expect(canvas).toHaveAttribute('data-textures', 'ready');
    const slider = page.getByRole('slider', { name: '发射演示进度' });
    const captures = new Map();
    for (const [camera, times] of (grip ? [['cinematic', [0, 5, 89, 0]]] : [['cinematic', [0, 5, 14, 18, 82, 86, 89]], ['ground', [0, 89]], ['booster', [89, 82, 0, 89]]])) {
      await page.getByRole('combobox', { name: '发射视角' }).selectOption(camera);
      await expect(canvas).toHaveAttribute('data-camera', camera);
      for (const time of times) {
        await slider.fill(String(time)); await expect(canvas).toHaveAttribute('data-time', time.toFixed(2));
        const buffer = await canvas.screenshot(), png = PNG.sync.read(buffer), colors = new Set();
        for (let i = 0; i < png.data.length; i += 4) colors.add(`${png.data[i] >> 4},${png.data[i + 1] >> 4},${png.data[i + 2] >> 4}`);
        expect(colors.size).toBeGreaterThan(30);
        const key = `${camera}-${time}`;
        if (captures.has(key)) expect(Buffer.compare(captures.get(key), buffer)).toBe(0);
        captures.set(key, buffer);
        await page.screenshot({ path: `artifacts/launch-site/${width}-${key}.png` });
        if (grip) {
          const rect = await canvas.boundingBox();
          const x = rect.x + rect.width * .72, y = rect.y + rect.height * .42;
          await page.mouse.move(x, y); await page.mouse.down();
          await page.mouse.move(x - Math.min(rect.height * .215, rect.width * .65), y + rect.height * .075, { steps: 12 });
          await page.mouse.up();
          await expect(page.getByRole('checkbox', { name: '跟随镜头' })).not.toBeChecked();
          await canvas.screenshot({ path: `artifacts/launch-site/${width}-grip-${time}.png` });
        }
      }
    }
    const playFrom = Number(await canvas.getAttribute('data-time'));
    await page.getByRole('button', { name: '播放发射演示', exact: true }).click();
    await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(playFrom + .2);
    await page.getByRole('button', { name: '暂停发射演示', exact: true }).click();
    const rect = await canvas.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down(); await page.mouse.move(rect.x + rect.width / 2 + 90, rect.y + rect.height / 2, { steps: 8 }); await page.mouse.up();
    await expect(page.getByRole('checkbox', { name: '跟随镜头' })).not.toBeChecked();
    await page.screenshot({ path: `artifacts/launch-site/${width}-orbit.png` });
    expect(errors).toEqual([]);
    console.log(JSON.stringify({ width, height, screenshots: captures.size + 1, errors }));
    await page.close();
  }
} finally { await browser.close(); }
