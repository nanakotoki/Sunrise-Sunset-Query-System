// 交互测试：在真实 Chrome 中加载 file:// 页面，模拟用户操作并捕获错误。
// 用法：node scripts/interaction-test.cjs [url]（默认 dist-single 的 file:// 地址）
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const htmlPath = path.resolve(__dirname, '..', 'dist-single', 'index.html');
const fileUrl = process.argv[2] || 'file:///' + htmlPath.split(path.sep).join('/').replace(/#/g, '%23');
const encodedUrl = new URL('file:///' + path.resolve(htmlPath).split(path.sep).join('/')).href;

(async () => {
  console.log('测试 URL:', encodedUrl);
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGE ERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });

  await page.goto(encodedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));

  // 1. 找查询按钮
  const btnInfo = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const q = btns.find((b) => b.textContent.includes('查询') || b.textContent.includes('Query'));
    if (!q) return { found: false, allButtons: btns.slice(0, 12).map((b) => b.textContent.trim().slice(0, 16)) };
    const r = q.getBoundingClientRect();
    const centerEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      found: true,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      disabled: q.disabled,
      visible: r.width > 0 && r.height > 0,
      inViewport: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth,
      elementAtCenter: centerEl ? centerEl.tagName + (centerEl.className ? '.' + String(centerEl.className).slice(0, 60) : '') : 'NULL',
      isSelfAtCenter: centerEl === q,
    };
  });
  console.log('\n[查询按钮状态]');
  console.log(JSON.stringify(btnInfo, null, 2));

  // 2. 真实点击
  if (btnInfo.found) {
    const before = await page.evaluate(() => document.querySelectorAll('section').length);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const q = btns.find((b) => b.textContent.includes('查询') || b.textContent.includes('Query'));
      q.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    const after = await page.evaluate(() => document.querySelectorAll('section').length);
    console.log('\n[点击效果] sections:', before, '->', after);

    // 3. 修改坐标再点击
    await page.evaluate(() => {
      const lat = document.getElementById('lat');
      const lng = document.getElementById('lng');
      const setVal = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setVal(lat, '31.2304');
      setVal(lng, '121.4737');
    });
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      btns.find((b) => b.textContent.includes('查询') || b.textContent.includes('Query')).click();
    });
    await new Promise((r) => setTimeout(r, 800));
    const coord = await page.evaluate(() => document.body.innerText.includes('31.2304') || document.body.innerText.includes('31.23'));
    console.log('[改坐标后查询] 结果区显示上海坐标:', coord);
  }

  // 4. 城市搜索（离线库）
  await page.evaluate(() => {
    const inp = document.querySelector('input[type="search"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, '深圳');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    btns.find((b) => b.textContent.includes('搜索') || b.textContent.includes('Search')).click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  const searchResult = await page.evaluate(() => {
    const li = [...document.querySelectorAll('ul li')];
    return { listItems: li.length, firstItem: li[0] ? li[0].textContent.trim().slice(0, 50) : null };
  });
  console.log('\n[城市搜索] 深圳 →', JSON.stringify(searchResult));

  await browser.close();
  console.log('\n[页面错误]', errors.length ? errors.slice(0, 8) : '无');
})().catch((e) => {
  console.error('测试脚本失败:', e.message);
  process.exit(1);
});
