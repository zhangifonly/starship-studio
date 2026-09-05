import { chromium, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const report = [];
function pixels(buffer) {
  const png = PNG.sync.read(buffer);
  let bright = 0;
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i] > 70 && png.data[i + 1] > 70 && png.data[i + 2] > 65) bright++;
  return { bright, total: png.width * png.height };
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await expect(page.locator('.viewport-status').filter({ hasText: '三维就绪' })).toBeVisible();
  const canvas = page.getByTestId('rocket-canvas');
  await expect(canvas).toBeVisible();
  // Wait for the known camera interpolation to settle before comparing pixels.
  await page.waitForTimeout(1300);
  const assembled = await canvas.screenshot();
  expect(pixels(assembled).bright).toBeGreaterThan(1000);
  await page.screenshot({ path: 'artifacts/desktop.png' });
  report.push({ test: 'desktop canvas', ...pixels(assembled) });
  if (process.argv.includes('--screenshots-only')) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'artifacts/mobile.png' });
  } else {
    await page.getByRole('button', { name: '自动旋转', exact: true }).click();
    await page.waitForTimeout(600);
    const rotating = await canvas.screenshot();
    expect(Buffer.compare(assembled, rotating)).not.toBe(0);
    await page.getByRole('button', { name: '自动旋转', exact: true }).click();
    report.push({ test: 'auto rotation', passed: true });
    await page.getByRole('button', { name: '全部展开', exact: true }).click();
    await expect(page.getByTestId('explosion-value')).toHaveText('100%');
    await page.waitForTimeout(1400);
    expect(pixels(await canvas.screenshot()).bright).toBeGreaterThan(1000);
    await page.screenshot({ path: 'artifacts/exploded.png' });
    await page.getByLabel('内部剖面', { exact: true }).check();
    await page.waitForTimeout(1300);
    await page.screenshot({ path: 'artifacts/cutaway.png' });
    await page.getByLabel('内部剖面', { exact: true }).uncheck();
    await page.getByRole('button', { name: '完整组装', exact: true }).click();
    for (const id of ['nose', 'flaps', 'shield', 'ship-tank', 'ship-engines', 'hotstage', 'gridfins', 'booster-tank', 'booster-engines']) {
      await page.getByTestId(`part-${id}`).click();
      await page.getByRole('button', { name: '单独查看部件', exact: true }).click();
      await page.waitForTimeout(1300);
      const sample = pixels(await canvas.screenshot()); expect(sample.bright, `${id} isolation`).toBeGreaterThan(150);
      if (id === 'booster-engines') await page.screenshot({ path: 'artifacts/engines.png' });
      await page.getByRole('complementary', { name: '部件详情' }).getByRole('button', { name: '返回整体', exact: true }).click();
      report.push({ test: `isolate ${id}`, ...sample });
    }
    await page.getByRole('button', { name: '关闭部件详情', exact: true }).click();
    for (const mode of ['星舰', '助推器', '整箭']) {
      await page.getByRole('group', { name: '火箭级段' }).getByRole('button', { name: mode, exact: true }).click();
      await page.waitForTimeout(1300);
      expect(pixels(await canvas.screenshot()).bright).toBeGreaterThan(400);
    }
    await page.getByLabel('搜索部件', { exact: true }).fill('猛禽');
    await expect(page.locator('.part-row')).toHaveCount(1);
    await page.getByLabel('搜索部件', { exact: true }).fill('no-such-part');
    await expect(page.getByText('没有匹配的部件')).toBeVisible();
    await page.getByRole('button', { name: '清除搜索', exact: true }).click();
    await page.getByRole('button', { name: '参考图纸', exact: true }).click();
    await expect(page.locator('dialog')).toBeVisible();
    const referenceImage = page.locator('.reference-figure img');
    if (await referenceImage.count()) expect(await referenceImage.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
    else await expect(page.locator('dialog a[href="https://www.faa.gov/media/27236#page=39"]')).toBeVisible();
    await page.screenshot({ path: 'artifacts/references.png' });
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).not.toBeVisible();
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出图片', exact: true }).click();
    const download = await downloadEvent; expect(download.suggestedFilename()).toBe('starship-studio.png');
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1300);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(pixels(await canvas.screenshot()).bright).toBeGreaterThan(250);
      await page.screenshot({ path: `artifacts/viewport-${viewport.width}.png` });
      if (viewport.width === 390) {
        await page.getByRole('navigation', { name: '移动端面板' }).getByRole('button', { name: '部件目录', exact: true }).click();
        await page.getByTestId('part-gridfins').click();
        await expect(page.getByRole('heading', { name: '栅格翼', exact: true })).toBeVisible();
        await page.getByRole('button', { name: '单独查看部件', exact: true }).click();
        await page.getByRole('navigation', { name: '移动端面板' }).getByRole('button', { name: '部件详情', exact: true }).click();
        await page.waitForTimeout(1300);
        await page.screenshot({ path: 'artifacts/mobile-isolated.png' });
        await page.getByRole('button', { name: '返回整体', exact: true }).click();
      }
      report.push({ test: `viewport ${viewport.width}`, passed: true });
    }
  }
  expect(errors).toEqual([]);
  await writeFile('artifacts/verification.json', JSON.stringify({ errors, report }, null, 2));
  console.log(JSON.stringify({ errors, report }, null, 2));
} finally { await browser.close(); }
