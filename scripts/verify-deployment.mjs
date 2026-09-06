import { chromium, webkit, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
const engine = process.argv.includes('--webkit') ? webkit : chromium, smoke = process.argv.includes('--smoke'), visualOnly = process.argv.includes('--visual-only');
const sizes = smoke ? [[1440, 1000], [390, 844]] : [[1440, 1000], [390, 844], [320, 568], [768, 1024], [844, 390]];
const manifest = JSON.parse(await readFile('src/deployment-audio.json', 'utf8'));
await mkdir('artifacts/deployment', { recursive: true });
const browser = await engine.launch({ headless: true });
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 900 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${base}/#mission/deployment`, { waitUntil: 'networkidle' });
    const canvas = page.getByTestId('deployment-canvas'), slider = page.getByRole('slider', { name: '卫星部署进度' }), camera = page.getByRole('combobox', { name: '部署视角' });
    await expect(canvas).toHaveAttribute('data-ready', 'true');
    await expect(canvas).toHaveAttribute('data-orbit-kind', 'synthetic-sgp4');
    expect(await page.locator('.deployment-events').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(width <= 700 ? 3 : 6);
    await canvas.evaluate(el => { el.dataset.identity = 'persistent'; });
    const frame = () => canvas.evaluate(el => { const r = el.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.width, r.height, el.width, el.height]; });
    const initialFrame = await frame(), pixels = () => canvas.evaluate(el => el.toDataURL());
    for (const mode of ['ship', 'bay', 'satellite']) {
      await camera.selectOption(mode); await expect(canvas).toHaveAttribute('data-camera', mode);
      let openingPixels;
      for (const t of [0, 26, 40, 60, 76, 96, 120, 26]) {
        await slider.fill(String(t)); await expect(canvas).toHaveAttribute('data-time', t.toFixed(2));
        await expect(canvas).toHaveAttribute('data-engines', 'off');
        await expect(canvas).toHaveAttribute('data-released', String([34, 46, 58].filter(release => t >= release).length));
        const image = await pixels(), png = PNG.sync.read(Buffer.from(image.split(',')[1], 'base64')), colors = new Set();
        for (let y = Math.floor(png.height * .25); y < png.height * .85; y++) for (let x = Math.floor(png.width * .25); x < png.width * .75; x++) {
          const i = (y * png.width + x) * 4; colors.add(`${png.data[i] >> 3},${png.data[i + 1] >> 3},${png.data[i + 2] >> 3}`);
        }
        expect(colors.size, `${mode} ${t} ${width} central pixels`).toBeGreaterThan(35);
        if (t === 26) { if (openingPixels) expect(image).toBe(openingPixels); else openingPixels = image; }
        if ([0, 40, 96, 120].includes(t)) await page.screenshot({ path: `artifacts/deployment/${engine.name()}-${width}-${mode}-${t}.png`, fullPage: true });
      }
    }
    await slider.fill('104'); await expect(canvas).toHaveAttribute('data-panels', '[1,1,1]');
    const positions = await canvas.getAttribute('data-positions'), orbit = await canvas.getAttribute('data-orbit');
    for (const target of ['0', '1', '2']) {
      await page.getByRole('combobox', { name: '跟随卫星' }).selectOption(target); await expect(canvas).toHaveAttribute('data-satellite', target);
      const centers = JSON.parse(await canvas.getAttribute('data-centers'));
      expect(centers[Number(target)][0]).toBeCloseTo(.5, 6); expect(centers[Number(target)][1]).toBeCloseTo(.5, 6);
      expect(await canvas.getAttribute('data-positions')).toBe(positions); expect(await canvas.getAttribute('data-orbit')).toBe(orbit);
    }
    const before = await pixels(); await page.getByRole('button', { name: '部署放大', exact: true }).click();
    await expect.poll(async () => (await pixels()) !== before).toBe(true);
    await page.getByRole('button', { name: '重置部署视角', exact: true }).click(); await expect.poll(pixels).toBe(before);
    if (!visualOnly) {
      await expect(page.getByRole('button', { name: '部署中文解说', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const audio = page.getByTestId('deployment-audio');
      for (const voice of ['yunxi', 'xiaoxiao']) {
        await page.getByRole('combobox', { name: '部署解说音色' }).selectOption(voice);
        await slider.fill('15.5'); await page.getByRole('button', { name: '播放卫星部署', exact: true }).click();
        await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(16.4);
        await expect(audio).toHaveAttribute('src', new RegExp(`/narration/${voice}/deployment-2-`));
        await expect.poll(() => audio.evaluate(el => !el.paused && el.currentTime > .1)).toBe(true);
        await page.getByRole('button', { name: '暂停卫星部署', exact: true }).click();
      }
      if (width === 1440) {
        const decoded = await page.evaluate(async manifest => {
          const context = new AudioContext(), results = [];
          try { for (const cues of Object.values(manifest.audio)) for (const cue of cues) {
            const response = await fetch(cue.src); if (!response.ok) throw Error(cue.src);
            const decoded = await context.decodeAudioData(await response.arrayBuffer()), samples = decoded.getChannelData(0);
            let sum = 0; for (const sample of samples) sum += sample * sample;
            results.push({ difference: Math.abs(decoded.duration - cue.duration), rms: Math.sqrt(sum / samples.length) });
          } return results; } finally { await context.close(); }
        }, manifest);
        expect(decoded).toHaveLength(12); decoded.forEach(cue => { expect(cue.difference).toBeLessThan(.15); expect(cue.rms).toBeGreaterThan(.005); });
      }
    } else await expect(page.getByRole('button', { name: '部署中文解说', exact: true })).toBeDisabled();
    await slider.fill('119.8'); await page.getByRole('button', { name: '播放卫星部署', exact: true }).click();
    await expect(page.getByRole('button', { name: '重播卫星部署', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '重播卫星部署', exact: true }).click();
    await expect.poll(async () => { const t = Number(await canvas.getAttribute('data-time')); return t > .2 && t < 10; }).toBe(true);
    await page.getByRole('button', { name: '暂停卫星部署', exact: true }).click();
    await page.getByRole('button', { name: '部署解说字幕', exact: true }).click();
    expect(await page.evaluate(() => document.querySelector('.mission-audio-status').getBoundingClientRect().bottom <= document.querySelector('.status-bar').getBoundingClientRect().top)).toBe(true);
    expect(await frame()).toEqual(initialFrame); await expect(canvas).toHaveAttribute('data-identity', 'persistent');
    expect(await page.locator('canvas').count()).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(`${base}/#mission/deployment?t=96&camera=satellite&satellite=2`, { waitUntil: 'networkidle' });
    await expect(canvas).toHaveAttribute('data-time', '96.00'); await expect(canvas).toHaveAttribute('data-camera', 'satellite'); await expect(canvas).toHaveAttribute('data-satellite', '2');
    const picker = page.getByRole('combobox', { name: '任务选择' });
    await picker.selectOption('overview'); await expect(page.getByTestId('flight-globe')).toHaveAttribute('data-ready', 'true');
    await picker.selectOption('deployment'); await expect(canvas).toHaveAttribute('data-ready', 'true');
    await picker.selectOption('capture'); await expect(page.getByTestId('mission-canvas')).toHaveAttribute('data-ready', 'true');
    await picker.selectOption('deployment'); await expect(canvas).toHaveAttribute('data-ready', 'true');
    if (width <= 900) await page.getByRole('button', { name: '查看部署资料' }).click();
    const evidence = width <= 900 ? page.locator('.mission-evidence-dialog') : page.getByRole('complementary', { name: '卫星部署资料' });
    await expect(evidence.getByRole('heading', { name: '到达太空，不等于入轨' })).toBeVisible();
    if (width <= 900) await page.getByRole('button', { name: '关闭部署资料' }).click();
    expect(errors).toEqual([]); console.log(JSON.stringify({ engine: engine.name(), width, height, errors }));
    await page.close();
  }
} finally { await browser.close(); }
