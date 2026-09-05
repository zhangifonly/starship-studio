import { chromium, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { mkdir } from 'node:fs/promises';
const base=process.env.STARSHIP_TEST_URL||'http://127.0.0.1:3016';
await mkdir('artifacts/engine',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByTestId('part-booster-engines').click();
  await page.getByRole('button',{name:'单台发动机精查'}).click();
  const canvas=page.getByTestId('rocket-canvas');
  await expect(canvas).toHaveAttribute('data-components','8');
  const checkPixels=async(name)=>{
    await page.waitForTimeout(1200);
    const buffer=await canvas.screenshot(), png=PNG.sync.read(buffer);let bright=0;
    for(let i=0;i<png.data.length;i+=4)if(png.data[i]>85&&png.data[i+1]>85&&png.data[i+2]>85)bright++;
    expect(bright).toBeGreaterThan(700);
    await page.screenshot({path:`artifacts/engine/${name}.png`});
  };
  await checkPixels('assembled');
  await page.getByRole('slider',{name:'发动机拆解程度'}).fill('75');
  await checkPixels('exploded');
  const components=page.locator('.engine-parts button');
  expect(await components.count()).toBe(8);
  await page.getByRole('button',{name:'甲烷涡轮泵',exact:false}).click();
  await page.getByRole('checkbox',{name:'仅显示选中组件'}).check();
  await expect(canvas).toHaveAttribute('data-visible-components','1');
  await page.getByRole('checkbox',{name:'内部剖面'}).check();
  await checkPixels('pump-section');
  await page.getByRole('checkbox',{name:'仅显示选中组件'}).uncheck();
  await page.getByRole('button',{name:'真空型',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-engine','vacuum');
  await page.getByRole('slider',{name:'发动机拆解程度'}).fill('0');
  await checkPixels('vacuum-section');
  for(const width of [390,360,768]) {
    await page.setViewportSize({width,height:844});await checkPixels(`mobile-${width}`);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.getByRole('button',{name:'返回箭体'}).click();
  await expect(page.getByRole('region',{name:'猛禽发动机精查'})).toHaveCount(0);
  expect(errors).toEqual([]);console.log('Passed: engine detail, eight assemblies, explosion, pump isolation, section, vacuum, desktop/mobile pixels, return.');
} finally {await browser.close();}
