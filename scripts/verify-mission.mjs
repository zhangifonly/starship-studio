import { chromium, webkit, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { mkdir, readFile } from 'node:fs/promises';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
const visualOnly = process.argv.includes('--visual-only');
const manifest = JSON.parse(await readFile('src/capture-audio.json', 'utf8'));
await mkdir('artifacts/mission', { recursive: true });
for (const engine of process.argv.includes('--webkit') ? [webkit] : [chromium]) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const [width, height] of process.argv.includes('--compact') ? [[320, 568], [844, 390]] : [[1440, 1000], [390, 844], [768, 1024]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 900 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/#mission/flight-5`, { waitUntil: 'networkidle' });
      const canvas = page.getByTestId('mission-canvas'), slider = page.getByRole('slider', { name: '捕获片段进度' });
      await expect(canvas).toHaveAttribute('data-ready', 'true');
      await expect(canvas).toHaveAttribute('data-gridfins', '4');
      await expect(canvas).toHaveAttribute('data-hotstage', 'absent');
      const original = await canvas.screenshot();
      for (const t of [0, 8, 16, 23, 28, 35, 0]) {
        await slider.fill(String(t)); await expect(canvas).toHaveAttribute('data-time', t.toFixed(2));
        const buffer = await canvas.screenshot(), png = PNG.sync.read(buffer), colors = new Set();
        for (let i = 0; i < png.data.length; i += 4) colors.add(`${png.data[i] >> 4},${png.data[i + 1] >> 4},${png.data[i + 2] >> 4}`);
        expect(colors.size).toBeGreaterThan(40);
        if (t === 0) expect(Buffer.compare(original, buffer)).toBe(0);
        await page.screenshot({ path: `artifacts/mission/${engine.name()}-${width}-${t}.png`, fullPage: true });
      }
      for (const camera of ['tracking', 'overhead', 'site']) {
        await page.getByRole('combobox', { name: '任务主视角' }).selectOption(camera);
        await slider.fill('28'); await expect(canvas).toHaveAttribute('data-camera', camera);
        await page.screenshot({ path: `artifacts/mission/${engine.name()}-${width}-${camera}.png`, fullPage: true });
      }
      await page.getByRole('button', { name: '双机位', exact: true }).click();
      await expect(canvas).toHaveAttribute('data-dual', 'false');
      await page.getByRole('button', { name: '双机位', exact: true }).click();
      await page.getByRole('button', { name: '突出承力点' }).click();
      const rect = await canvas.boundingBox();
      const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, footer: document.querySelector('.status-bar').getBoundingClientRect().top, controls: document.querySelector('.mission-transport').getBoundingClientRect().bottom }));
      expect(layout.width).toBeLessThanOrEqual(layout.viewport);
      expect(layout.controls).toBeLessThanOrEqual(layout.footer + 1);
      await page.getByRole('button', { name: '复盘返回末段', exact: true }).click();
      if (!visualOnly) {
        const audio = page.getByTestId('mission-audio');
        await expect(page.getByRole('button', { name: '任务中文解说', exact: true })).toHaveAttribute('aria-pressed', 'true');
        for (const voice of ['yunxi', 'xiaoxiao']) {
          await page.getByRole('combobox', { name: '任务解说音色' }).selectOption(voice);
          for (const t of [0, 8, 16, 23, 28]) {
            await slider.fill(String(t));
            await expect(audio).toHaveAttribute('src', new RegExp(`/narration/${voice}/flight5-capture-`));
            await page.getByRole('button', { name: '播放任务复盘', exact: true }).click();
            await expect.poll(() => audio.evaluate(el => !el.paused && el.currentTime > .1)).toBe(true);
            await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(t + .2);
            expect(await canvas.boundingBox()).toEqual(rect);
            await page.getByRole('button', { name: '暂停任务复盘', exact: true }).click();
          }
        }
        // Cross an actual cue boundary without seeking between cues.
        await slider.fill('7.5');
        const identity = await canvas.evaluate(element => { element.dataset.identity = 'persistent'; return element.dataset.identity; });
        await page.getByRole('button', { name: '播放任务复盘', exact: true }).click();
        await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(8.4);
        await expect(audio).toHaveAttribute('src', /flight5-capture-2-/);
        expect(await canvas.boundingBox()).toEqual(rect);
        await expect(canvas).toHaveAttribute('data-identity', identity);
        await page.getByRole('button', { name: '暂停任务复盘', exact: true }).click();
        if (width === 1440) {
          const decoded = await page.evaluate(async manifest => {
            const context = new AudioContext(), result = [];
            try {
              for (const cues of Object.values(manifest.audio)) for (const cue of cues) {
                const response = await fetch(cue.src); if (!response.ok) throw Error(cue.src);
                const buffer = await context.decodeAudioData(await response.arrayBuffer());
                const samples = buffer.getChannelData(0); let energy = 0, peak = 0;
                for (const sample of samples) { energy += sample * sample; peak = Math.max(peak, Math.abs(sample)); }
                result.push({ difference: Math.abs(buffer.duration - cue.duration), rms: Math.sqrt(energy / samples.length), peak });
              }
              return result;
            } finally { await context.close(); }
          }, manifest);
          expect(decoded).toHaveLength(10);
          for (const cue of decoded) { expect(cue.difference).toBeLessThan(.15); expect(cue.rms).toBeGreaterThan(.005); expect(cue.peak).toBeGreaterThan(.05); }
        }
        await page.getByRole('combobox', { name: '任务播放速度' }).selectOption('2');
        await slider.fill('34');
        await page.getByRole('button', { name: '播放任务复盘', exact: true }).click();
        await expect(page.getByRole('button', { name: '重播任务复盘', exact: true })).toBeVisible();
        await page.getByRole('button', { name: '重播任务复盘', exact: true }).click();
        await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeLessThan(5);
        await page.getByRole('button', { name: '暂停任务复盘', exact: true }).click();
      }
      if (width < 900) await page.getByRole('button', { name: '查看任务资料' }).click();
      const evidence = width < 900 ? page.locator('.mission-evidence-dialog') : page.getByRole('complementary', { name: '任务证据' });
      await evidence.getByRole('tab', { name: '参考证据', exact: true }).click();
      await expect(evidence.getByRole('link', { name: 'Spaceflight Now · 捕获回顾' })).toHaveAttribute('href', /spaceflightnow.com/);
      await evidence.getByRole('tab', { name: '重建边界', exact: true }).click();
      await expect(evidence.getByText('哪些是重建？')).toBeVisible();
      await evidence.getByRole('tab', { name: '任务记录', exact: true }).click();
      await evidence.getByRole('button', { name: '查看返回末段参考照片' }).click();
      await expect(page.locator('.mission-photo-dialog')).toBeVisible();
      expect(await page.locator('.mission-photo-dialog > img').evaluate(image => image.complete && image.naturalWidth > 500)).toBe(true);
      await page.getByRole('button', { name: '关闭参考照片' }).click();
      if (width < 900) await page.getByRole('button', { name: '关闭任务资料' }).click();
      await page.goto(`${base}/#mission/flight-5?t=24.3&camera=overhead&dual=0`, { waitUntil: 'commit' });
      await expect(canvas).toHaveAttribute('data-time', '24.30'); await expect(canvas).toHaveAttribute('data-camera', 'overhead'); await expect(canvas).toHaveAttribute('data-dual', 'false');
      if (!visualOnly && width === 390) {
        await page.getByRole('link', { name: '结构探索', exact: true }).click();
        await page.route('**/narration/**/flight5-*.mp3', route => route.abort());
        await page.getByRole('link', { name: '任务复盘', exact: true }).click();
        await expect(page.locator('.mission-audio-status')).toHaveText('解说播放失败，字幕与三维仍可用。');
        await page.getByRole('button', { name: '任务中文解说', exact: true }).click();
        await page.getByRole('button', { name: '播放任务复盘', exact: true }).click();
        await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(.2);
      }
      expect(errors).toEqual([]);
      console.log(JSON.stringify({ engine: engine.name(), width, height, canvas: rect, errors }));
      await page.close();
    }
  } finally { await browser.close(); }
}
