// 验证 GPS 定位三种场景：file://（应显示引导提示）、localhost 授权（应成功）、localhost 拒绝（应显示权限提示）
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URLS = {
  file: 'file:///C:/Users/%E6%97%B6%E5%98%89%E5%BA%86/github/Sunrise-Sunset-Query-System/dist-single/index.html',
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });

  // 场景 1：file:// 下点 GPS 定位按钮 → 应显示 file:// 引导提示
  const p1 = await browser.newPage();
  await p1.goto(URLS.file, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2000));
  await p1.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('📍'));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  const fileMsg = await p1.evaluate(() => document.querySelector('.text-red-400')?.textContent ?? '(无提示)');
  console.log('file:// 下 GPS:', fileMsg);
  await p1.close();

  // 场景 2：localhost + 自动授予权限 → 应成功定位并更新表单
  const p2 = await browser.newPage();
  const ctx = p2;
  // Chrome headless 用 overridePermissions 授予 geolocation
  const origin = 'http://localhost:4173';
  await browser.overridePermissions?.(origin, ['geolocation']);
  await ctx.setGeolocation?.({ latitude: 34.2635, longitude: 108.9246, accuracy: 100 });
  // 需要本地服务器
  const { exec } = require('child_process');
  const server = exec('npx vite preview --port 4173 --strictPort');
  await new Promise((r) => setTimeout(r, 4000));
  await ctx.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2000));
  await ctx.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('📍'));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 2500));
  const state = await ctx.evaluate(() => ({
    lat: document.querySelector('#lat')?.value,
    lng: document.querySelector('#lng')?.value,
    err: document.querySelector('.text-red-400')?.textContent ?? '(无)',
  }));
  console.log('localhost+授权 GPS:', JSON.stringify(state));
  server.kill();
  await ctx.close();

  await browser.close();
})();
