import { chromium, webkit, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { mkdir } from 'node:fs/promises';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
await mkdir('artifacts/platform', { recursive: true });
for (const [engine, width, height] of [[chromium, 1440, 1000], [chromium, 390, 844], [webkit, 390, 844]]) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}/#launch`, { waitUntil: 'networkidle' });
    const canvas = page.getByTestId('launch-canvas'), slider = page.getByRole('slider', { name: '发射演示进度' });
    await expect(canvas).toHaveAttribute('data-textures', 'ready');
    const captures = new Map();
    for (const [camera, times] of [['landing', [0, 150, 154, 166, 0]], ['cinematic', [150, 159]]]) {
      await page.getByRole('combobox', { name: '发射视角' }).selectOption(camera);
      await expect(canvas).toHaveAttribute('data-camera', camera);
      for (const time of times) {
        await slider.fill(String(time)); await expect(canvas).toHaveAttribute('data-time', time.toFixed(2));
        if (time >= 150) await expect(canvas).toHaveAttribute('data-legs', '1.00');
        const buffer = await canvas.screenshot(), png = PNG.sync.read(buffer), colors = new Set();
        let paint = 0;
        for (let i = 0; i < png.data.length; i += 4) {
          const [r, g, b] = png.data.subarray(i, i + 3); colors.add(`${r >> 4},${g >> 4},${b >> 4}`);
          if (r > 100 && g > 90 && r > b * 1.3 && g > b * 1.2) paint++;
        }
        expect(colors.size).toBeGreaterThan(80); expect(paint).toBeGreaterThan(30);
        const key = `${camera}-${time}`;
        if (captures.has(key)) expect(Buffer.compare(captures.get(key), buffer)).toBe(0);
        captures.set(key, buffer);
        await page.screenshot({ path: `artifacts/platform/${engine.name()}-${width}-${key}.png` });
      }
    }
    await slider.fill('153.5'); await page.getByRole('button', { name: '播放发射演示', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-landed', 'true', { timeout: 15000 });
    await expect(page.getByTestId('launch-phase-title')).toHaveText('平台着陆');
    await page.getByRole('button', { name: '暂停发射演示', exact: true }).click();
    const audio = page.getByTestId('narration-audio');
    await expect.poll(() => audio.evaluate(a => a.currentSrc)).toContain('phase-12');
    expect(errors).toEqual([]);
    console.log(JSON.stringify({ browser: engine.name(), width, screenshots: captures.size, errors }));
  } finally { await browser.close(); }
}
