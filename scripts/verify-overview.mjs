import { chromium, webkit, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
const visualOnly = process.argv.includes('--visual-only'), smoke = process.argv.includes('--smoke');
const engine = process.argv.includes('--webkit') ? webkit : chromium;
const viewports = smoke ? [[1440, 1000], [390, 844]] : [[1440, 1000], [390, 844], [768, 1024], [320, 568], [844, 390]];
const manifest = JSON.parse(await readFile('src/overview-audio.json', 'utf8'));
await mkdir('artifacts/overview', { recursive: true });
const browser = await engine.launch({ headless: true });
try {
  for (const [width, height] of viewports) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 900 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    const failedRequests = []; page.on('requestfailed', r => failedRequests.push({ url: r.url(), reason: r.failure()?.errorText }));
    await page.goto(`${base}/#mission/flight-5/overview`, { waitUntil: 'networkidle' });
    const canvas = page.getByTestId('flight-globe'), slider = page.getByRole('slider', { name: '全程复盘进度' });
    await expect(canvas).toHaveAttribute('data-ready', 'true');
    await expect(canvas).toHaveAttribute('data-position-kind', 'authored-interpolation');
    const rect = await canvas.boundingBox();
    const documentFrame = () => canvas.evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, left: r.left + scrollX, width: r.width, height: r.height, bufferWidth: el.width, bufferHeight: el.height }; });
    const stableFrame = await documentFrame();
    const pixels = async () => Buffer.from(await canvas.evaluate(el => el.toDataURL('image/png').split(',')[1]), 'base64');
    const first = await pixels();
    await canvas.evaluate(el => { el.dataset.identity = 'persistent'; });
    for (const t of smoke ? [0, 100, 140, 180] : [0, 20, 60, 100, 140, 180, 200, 0]) {
      await slider.fill(String(t)); await expect(canvas).toHaveAttribute('data-time', t.toFixed(2));
      await page.screenshot({ path: `artifacts/overview/${engine.name()}-${width}-${t}.png`, fullPage: true });
      const buffer = await pixels(), png = PNG.sync.read(buffer), colors = new Set(); let lit = 0;
      for (let i = 0; i < png.data.length; i += 4) { colors.add(`${png.data[i] >> 4},${png.data[i + 1] >> 4},${png.data[i + 2] >> 4}`); if (png.data[i] + png.data[i + 1] + png.data[i + 2] > 80) lit++; }
      expect(colors.size).toBeGreaterThan(40); expect(lit / (png.width * png.height)).toBeGreaterThan(.05);
      if (t === 0) expect(Buffer.compare(first, buffer)).toBe(0);
    }
    await slider.fill('90'); await expect(canvas).toHaveAttribute('data-time', '90.00');
    const ship = await canvas.getAttribute('data-ship'), booster = await canvas.getAttribute('data-booster');
    for (const camera of ['ship', 'booster', 'global']) {
      await page.getByRole('combobox', { name: '航迹视角' }).selectOption(camera); await expect(canvas).toHaveAttribute('data-camera', camera);
      expect(await canvas.getAttribute('data-ship')).toBe(ship); expect(await canvas.getAttribute('data-booster')).toBe(booster);
      const distance = Number(await canvas.getAttribute('data-camera-distance')); if (camera === 'global') expect(distance).toBeGreaterThan(15); else expect(distance).toBeLessThan(6);
      await page.screenshot({ path: `artifacts/overview/${engine.name()}-${width}-${camera}.png`, fullPage: true });
    }
    if (width === 1440) {
      const before = await pixels();
      await page.getByRole('button', { name: '航迹放大', exact: true }).click(); await expect.poll(async () => Buffer.compare(before, await pixels())).not.toBe(0);
      await page.getByRole('button', { name: '重置航迹视角', exact: true }).click();
      await expect.poll(async () => Buffer.compare(before, await pixels())).toBe(0);
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + box.width * .45, box.y + box.height * .4); await page.mouse.down(); await page.mouse.move(box.x + box.width * .65, box.y + box.height * .45, { steps: 8 }); await page.mouse.up();
      await expect.poll(async () => Buffer.compare(before, await pixels())).not.toBe(0);
      await page.getByRole('button', { name: '重置航迹视角', exact: true }).click();
      await expect.poll(async () => Buffer.compare(before, await pixels())).toBe(0);
    }
    const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, footer: document.querySelector('.status-bar').getBoundingClientRect().top, controls: document.querySelector('.mission-transport').getBoundingClientRect().bottom }));
    expect(layout.width).toBeLessThanOrEqual(layout.viewport); expect(layout.controls).toBeLessThanOrEqual(layout.footer + 1);
    if (!visualOnly && !smoke) {
      const audio = page.getByTestId('overview-audio');
      await expect(page.getByRole('button', { name: '全程中文解说', exact: true })).toHaveAttribute('aria-pressed', 'true');
      for (const voice of ['yunxi', 'xiaoxiao']) {
        await page.getByRole('combobox', { name: '全程解说音色' }).selectOption(voice);
        for (const t of [0, 100, 180]) {
          await slider.fill(String(t)); await page.getByRole('button', { name: '播放全程复盘', exact: true }).click();
          await expect.poll(() => audio.evaluate(el => !el.paused && el.currentTime > .2)).toBe(true);
          await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(t + .2);
          await page.getByRole('button', { name: '暂停全程复盘', exact: true }).click();
        }
      }
      await slider.fill('19.5'); await page.getByRole('button', { name: '播放全程复盘', exact: true }).click();
      await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(20.4);
      await expect(audio).toHaveAttribute('src', /flight5-overview-2-/);
      expect(await documentFrame()).toEqual(stableFrame); await expect(canvas).toHaveAttribute('data-identity', 'persistent');
      await page.getByRole('button', { name: '暂停全程复盘', exact: true }).click();
      await page.getByRole('button', { name: '全程中文解说', exact: true }).click();
      await page.getByRole('combobox', { name: '全程播放速度' }).selectOption('2');
      await slider.fill('199'); await page.getByRole('button', { name: '播放全程复盘', exact: true }).click();
      await expect(page.getByRole('button', { name: '重播全程复盘', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '重播全程复盘', exact: true }).click();
      await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeLessThan(5);
      await page.getByRole('button', { name: '暂停全程复盘', exact: true }).click();
      if (width === 1440) {
        const decoded = await page.evaluate(async manifest => {
          const context = new AudioContext(), results = [];
          try { for (const cues of Object.values(manifest.audio)) for (const cue of cues) { const res = await fetch(cue.src); if (!res.ok) throw Error(cue.src); const buffer = await context.decodeAudioData(await res.arrayBuffer()); let power = 0; for (const value of buffer.getChannelData(0)) power += value * value; results.push({ delta: Math.abs(buffer.duration - cue.duration), rms: Math.sqrt(power / buffer.length) }); } } finally { await context.close(); }
          return results;
        }, manifest);
        expect(decoded).toHaveLength(20); for (const cue of decoded) { expect(cue.delta).toBeLessThan(.15); expect(cue.rms).toBeGreaterThan(.005); }
      }
    }
    if (!smoke) {
      if (width <= 900) await page.getByRole('button', { name: '查看航迹资料' }).click();
      const evidence = width <= 900 ? page.locator('.mission-evidence-dialog') : page.getByRole('complementary', { name: '全程任务证据' });
      await expect(evidence.getByText('航迹证据等级', { exact: true })).toBeVisible();
      if (width <= 900) await page.getByRole('button', { name: '关闭航迹资料' }).click();
      await page.getByRole('link', { name: '捕获特写', exact: true }).click();
      await expect(page.getByTestId('mission-canvas')).toHaveAttribute('data-ready', 'true');
      await page.getByRole('combobox', { name: '任务选择', exact: true }).selectOption('overview');
      await expect(canvas).toHaveAttribute('data-ready', 'true');
      await page.goto(`${base}/#mission/flight-5/overview?t=88.8&camera=ship`, { waitUntil: 'commit' });
      await expect(canvas).toHaveAttribute('data-time', '88.80'); await expect(canvas).toHaveAttribute('data-camera', 'ship');
      await page.getByRole('button', { name: '跳转首次塔架捕获' }).click(); await expect(canvas).toHaveAttribute('data-caught', 'true');
    }
    // Changing the cue intentionally cancels its previous media download.
    // Retain HTTP errors and all other transport failures; real clips are decoded above.
    const cancelledAudio = r => /\/narration\/.*\.mp3$/.test(r.url) && (r.reason === 'net::ERR_ABORTED' || r.reason === 'cancelled');
    expect(errors).toEqual([]); expect(failedRequests.filter(r => !cancelledAudio(r))).toEqual([]);
    console.log(JSON.stringify({ engine: engine.name(), width, height, canvas: rect, errors, cancelledAudioRequests: failedRequests.filter(cancelledAudio).length })); await page.close();
  }
} finally { await browser.close(); }
