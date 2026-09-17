// 在真实 Chrome（file:// 单文件页，与用户场景一致）里验证 IP 网络定位按钮
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file:///C:/Users/%E6%97%B6%E5%98%89%E5%BA%86/github/Sunrise-Sunset-Query-System/dist-single/index.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await new Promise((r) => setTimeout(r, 2000));

  // 点击 📡 网络定位按钮
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('📡'));
    btn?.click();
  });
  // 等待多源回退完成（最多 20 秒：3 源 × 6 秒超时）
  let state = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    state = await page.evaluate(() => ({
      lat: document.querySelector('#lat')?.value,
      lng: document.querySelector('#lng')?.value,
      searchVal: document.querySelector('input[type="search"]')?.value,
      err: document.querySelector('.text-red-400')?.textContent ?? '',
      locating: [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('定位中')),
    }));
    if (!state.locating && state.lat !== '39.9042') break;
  }
  console.log('IP 网络定位结果:', JSON.stringify(state, null, 2));
  console.log('页面错误:', errors.length ? errors : '无');
  await browser.close();
})();
