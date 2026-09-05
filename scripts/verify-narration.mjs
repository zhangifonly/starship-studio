import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('src/narration-audio.json','utf8'));
const base = process.env.STARSHIP_TEST_URL || 'http://127.0.0.1:3016';
const browser = await chromium.launch({ headless: true });
const errors=[];
try {
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/#launch`,{waitUntil:'networkidle'});
  const audio = page.getByTestId('narration-audio');
  const state = () => audio.evaluate(a=>({paused:a.paused,time:a.currentTime,rate:a.playbackRate,src:a.currentSrc,ready:a.readyState}));
  await expect(page.getByRole('button',{name:'播放发射演示',exact:true})).toBeEnabled();
  expect((await state()).paused).toBe(true);
  await expect(page.getByRole('button',{name:'中文语音解说',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'跳转到星舰滑行'}).click();
  await expect.poll(async()=>(await state()).ready).toBeGreaterThanOrEqual(3);
  expect((await state()).paused).toBe(true);
  await page.getByRole('button',{name:'播放发射演示',exact:true}).click();
  await expect.poll(async()=>(await state()).time).toBeGreaterThan(.7);
  await page.getByRole('button',{name:'暂停发射演示'}).click();
  const paused=await state(); expect(paused.paused).toBe(true);
  await page.waitForTimeout(250); expect((await state()).time).toBeCloseTo(paused.time,1);
  await page.getByRole('button',{name:'播放发射演示',exact:true}).click();
  await expect.poll(async()=>(await state()).time).toBeGreaterThan(paused.time+.3);
  await page.getByRole('combobox',{name:'发射演示播放速度'}).selectOption('2');
  expect((await state()).rate).toBe(2);
  const beforeCamera=await state();
  await page.getByRole('combobox',{name:'发射视角'}).selectOption('ship');
  expect((await state()).src).toBe(beforeCamera.src);
  expect((await state()).time).toBeGreaterThanOrEqual(beforeCamera.time);
  await page.getByRole('combobox',{name:'解说音色'}).selectOption('xiaoxiao');
  await expect.poll(async()=>(await state()).src).toContain('/xiaoxiao/');
  await expect.poll(async()=>(await state()).paused).toBe(false);
  await page.getByRole('slider',{name:'发射演示进度'}).fill('115');
  await expect.poll(async()=>(await state()).time).toBeCloseTo(3,1);
  expect((await state()).paused).toBe(true);
  await page.getByRole('combobox',{name:'发射演示播放速度'}).selectOption('1');
  await page.getByRole('slider',{name:'发射演示进度'}).fill('5.8');
  await page.getByRole('button',{name:'播放发射演示',exact:true}).click();
  await expect.poll(async()=>(await state()).src).toContain('phase-02');
  await expect.poll(async()=>(await state()).time).toBeGreaterThan(.3);
  const decoded=await page.evaluate(async(manifest)=>{
    const context=new AudioContext(), results=[];
    for(const [voice,cues] of Object.entries(manifest.audio)) for(const cue of cues) {
      const response=await fetch(cue.src); if(!response.ok) throw Error(cue.src);
      const buffer=await context.decodeAudioData(await response.arrayBuffer());
      const samples=buffer.getChannelData(0); let peak=0,energy=0;
      for(const sample of samples){peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;}
      results.push({voice,src:cue.src,duration:buffer.duration,expected:cue.duration,peak,rms:Math.sqrt(energy/samples.length)});
    }
    await context.close();return results;
  },manifest);
  for(const cue of decoded){expect(Math.abs(cue.duration-cue.expected)).toBeLessThan(.15);expect(cue.peak).toBeGreaterThan(.05);expect(cue.rms).toBeGreaterThan(.005);}
  await page.getByRole('button',{name:'暂停发射演示'}).click();
  for(const width of [360,390,768]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByRole('combobox',{name:'解说音色'})).toBeVisible();
    await page.screenshot({path:`artifacts/narration-${width}.png`});
  }
  await page.evaluate(()=>{window.__oldAudio=document.querySelector('audio');});
  await page.getByRole('link',{name:'结构探索'}).click();
  expect(await page.evaluate(()=>window.__oldAudio.paused)).toBe(true);
  await page.route('**/narration/**/*.mp3', route=>route.abort());
  await page.getByRole('link',{name:'发射演示'}).click();
  await expect(page.getByRole('status').filter({hasText:'解说音频未能播放'})).toBeVisible();
  await page.getByRole('button',{name:'关闭解说',exact:true}).click();
  await expect(page.getByRole('button',{name:'中文语音解说',exact:true})).toHaveAttribute('aria-pressed','false');
  expect(errors).toEqual([]);
  console.log('Passed: narration enabled by default, audio starts with playback, 24 real MP3 decodes, pause/resume, seek, rate, voice change, mobile layout and failed-download recovery.');
} finally {await browser.close();}
