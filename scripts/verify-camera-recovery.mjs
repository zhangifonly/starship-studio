import { chromium, webkit, expect } from '@playwright/test';

const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3018';
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: true, isMobile: width < 700 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/#launch`, { waitUntil: 'networkidle' });
      const canvas = page.getByTestId('launch-canvas');
      const select = page.getByRole('combobox', { name: '发射视角' });
      const follow = page.getByRole('checkbox', { name: '跟随镜头' });
      const slider = page.getByRole('slider', { name: '发射演示进度' });
      await expect(canvas).toHaveAttribute('data-textures', 'ready');
      await slider.fill('18');
      await expect(canvas).toHaveAttribute('data-time', '18.00');
      await canvas.evaluate(el => { el.dataset.identity = 'persistent'; });
      const pixels = () => canvas.evaluate(el => el.toDataURL());
      async function drag(touch = false) {
        const box = await canvas.boundingBox();
        const x = box.x + box.width * .5, y = box.y + box.height * .45;
        if (touch && engine === chromium) {
          const client = await page.context().newCDPSession(page);
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
          for (let i = 1; i <= 5; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 12, y: y + i * 4 }] });
          await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await client.detach();
        } else if (touch) {
          await page.touchscreen.tap(x, y);
        } else {
          await page.mouse.move(x, y); await page.mouse.down();
          await page.mouse.move(x + 60, y + 20, { steps: 5 }); await page.mouse.up();
        }
        await expect(follow).not.toBeChecked();
        await expect(select).toHaveValue('manual');
      }
      for (const mode of ['cinematic', 'ground']) {
        await select.selectOption(mode);
        await expect(canvas).toHaveAttribute('data-camera', mode);
        const original = await pixels();
        for (const touch of [false, true]) {
          await drag(touch);
          if (!touch || engine === chromium) expect(await pixels()).not.toBe(original);
          await select.selectOption(mode);
          await expect(follow).toBeChecked();
          await expect(select).toHaveValue(mode);
          await expect.poll(pixels).toBe(original);
          await expect(canvas).toHaveAttribute('data-time', '18.00');
          await expect(canvas).toHaveAttribute('data-identity', 'persistent');
        }
      }
      await select.selectOption('cinematic');
      await drag();
      await page.getByRole('button', { name: '重置发射视角', exact: true }).click();
      await expect(select).toHaveValue('cinematic'); await expect(follow).toBeChecked();
      await follow.uncheck(); await expect(select).toHaveValue('manual');
      await follow.check(); await expect(select).toHaveValue('cinematic');
      const audio = page.getByRole('button', { name: '中文语音解说', exact: true });
      if (await audio.getAttribute('aria-pressed') === 'true') await audio.click();
      await page.getByRole('button', { name: '播放发射演示', exact: true }).click();
      await drag(); await select.selectOption('cinematic');
      const resumed = Number(await canvas.getAttribute('data-time'));
      await expect.poll(async () => Number(await canvas.getAttribute('data-time'))).toBeGreaterThan(resumed + .5);
      await expect(follow).toBeChecked(); await expect(select).toHaveValue('cinematic');
      await expect(canvas).toHaveAttribute('data-identity', 'persistent');
      expect(errors).toEqual([]);
      console.log(JSON.stringify({ engine: engine.name(), width, mouseAndTouchRecovery: true, errors }));
      await page.close();
    }
  } finally { await browser.close(); }
}
