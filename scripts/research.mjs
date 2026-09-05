import { chromium } from '@playwright/test';

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({ headless: true, ...(proxy ? { proxy: { server: proxy } } : {}) });
try {
  const page = await browser.newPage();
  await page.goto('https://www.spacex.com/vehicles/starship/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByText('SUPER HEAVY', { exact: true }).first().waitFor({ timeout: 20000 });
  console.log((await page.locator('body').innerText()).slice(0, 18000));
  console.log(JSON.stringify(await page.locator('img').evaluateAll(nodes => nodes.map(n => ({ alt: n.alt, src: n.src }))), null, 2));
} finally {
  await browser.close();
}
