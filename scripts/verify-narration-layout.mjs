import { chromium, webkit, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
const reproduce = process.argv.includes('--reproduce');
await mkdir('artifacts/narration-layout', { recursive: true });
const reports = [];
const cases = reproduce ? [[chromium, 390, 844]] : [[chromium, 390, 844], [chromium, 360, 740], [chromium, 844, 390], [chromium, 1280, 900], [webkit, 390, 844]];
for (const [engine, width, height] of cases) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/narration/**/*phase-02*.mp3', async route => {
      await new Promise(resolve => setTimeout(resolve, 900));
      await route.continue();
    });
    await page.goto(`${base}/#launch`, { waitUntil: 'networkidle' });
    const canvas = page.getByTestId('launch-canvas'), audio = page.getByTestId('narration-audio');
    await expect(canvas).toHaveAttribute('data-textures', 'ready');
    await expect.poll(() => audio.evaluate(a => a.readyState)).toBeGreaterThanOrEqual(3);
    await page.getByRole('slider', { name: '发射演示进度' }).fill('5.8');
    await expect(canvas).toHaveAttribute('data-time', '5.80');
    await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="launch-canvas"]');
      const samples = [], mutations = [];
      const observer = new MutationObserver(records => mutations.push(...records.map(record => record.attributeName)));
      observer.observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
      let frame;
      const sample = () => {
        const rect = canvas.getBoundingClientRect();
        samples.push({ width: rect.width, height: rect.height, top: rect.top, bitmapWidth: canvas.width, bitmapHeight: canvas.height, scrollY });
        frame = requestAnimationFrame(sample);
      };
      sample();
      window.__layoutAudit = { samples, mutations, stop: () => { cancelAnimationFrame(frame); observer.disconnect(); } };
    });
    await page.getByRole('button', { name: '播放发射演示', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '解说音频缓冲中' })).toBeVisible();
    const pausedTime = Number(await canvas.getAttribute('data-time'));
    const png = PNG.sync.read(await canvas.screenshot());
    expect(png.data.some((value, i) => i % 4 !== 3 && value > 60)).toBe(true);
    await page.screenshot({ path: `artifacts/narration-layout/${engine.name()}-${width}-buffering.png` });
    await expect.poll(() => audio.evaluate(a => a.currentTime), { timeout: 15000 }).toBeGreaterThan(.3);
    await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(pausedTime + .25);
    if (!reproduce && width === 390) {
      // Continue naturally through another cue, including the changing phase chip.
      await page.getByRole('combobox', { name: '发射演示播放速度' }).selectOption('2');
      await expect.poll(() => audio.evaluate(a => a.currentSrc), { timeout: 15000 }).toContain('phase-03');
      await expect.poll(() => audio.evaluate(a => a.currentTime)).toBeGreaterThan(.3);
    }
    await page.getByRole('button', { name: '暂停发射演示', exact: true }).click();
    if (!reproduce) {
      await page.route('**/narration/xiaoxiao/*.mp3', route => route.abort());
      await page.getByRole('combobox', { name: '解说音色' }).selectOption('xiaoxiao');
      await expect(page.getByRole('status').filter({ hasText: '解说音频未能播放' })).toBeVisible();
      await page.screenshot({ path: `artifacts/narration-layout/${engine.name()}-${width}-failed.png` });
      await page.getByRole('button', { name: '关闭解说', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: '解说音频未能播放' })).toHaveCount(0);
    }
    const result = await page.evaluate(() => {
      window.__layoutAudit.stop();
      return { samples: window.__layoutAudit.samples, mutations: window.__layoutAudit.mutations };
    });
    const shapes = [...new Set(result.samples.map(sample => JSON.stringify(sample)))];
    const report = { browser: engine.name(), width, height, shapes: shapes.map(shape => JSON.parse(shape)), bitmapResizes: result.mutations.length, errors };
    reports.push(report); console.log(JSON.stringify(report));
    if (!reproduce) { expect(shapes).toHaveLength(1); expect(result.mutations).toHaveLength(0); }
    expect(errors).toEqual([]);
    await page.screenshot({ path: `artifacts/narration-layout/${engine.name()}-${width}-ready.png` });
  } finally { await browser.close(); }
}
await writeFile(`artifacts/narration-layout/${reproduce ? 'before' : 'after'}.json`, JSON.stringify(reports, null, 2));
