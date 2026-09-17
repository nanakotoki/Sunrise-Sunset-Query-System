// 端到端复现：搜索南京（不点下拉项）→ 结果区应直接变为南京坐标 + 显示当地实时时钟。
const puppeteer = require('puppeteer-core');
const url = 'file:///C:/Users/%E6%97%B6%E5%98%89%E5%BA%86/github/Sunrise-Sunset-Query-System/dist-single/index.html';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));

  // 1. 初始（默认北京）
  const before = await page.evaluate(() => ({
    lat: document.querySelector('#lat').value,
    header: document.querySelector('section header span')?.textContent?.trim() ?? '',
  }));
  console.log('初始（应为北京）:', JSON.stringify(before));

  // 2. 输入"南京"并点击搜索按钮（模拟真实点击）
  await page.type('input[type="search"]', '南京');
  const searchBtn = await page.evaluateHandle(() => {
    const form = document.querySelector('form');
    return [...form.querySelectorAll('button')].find((b) => b.textContent?.includes('搜索'));
  });
  await searchBtn.asElement().click();
  await new Promise((r) => setTimeout(r, 1500));

  // 3. 不点下拉项，直接检查表单和结果区
  const after = await page.evaluate(() => ({
    lat: document.querySelector('#lat').value,
    lng: document.querySelector('#lng').value,
    header: document.querySelector('section header span')?.textContent?.trim() ?? '',
    clock: document.querySelector('section .font-mono.text-2xl')?.textContent?.trim() ?? '',
    tzLabel: [...document.querySelectorAll('section .text-xs')].map((e) => e.textContent?.trim()).find((s) => s?.includes('Asia/')) ?? '',
    pickHint: [...document.querySelectorAll('p')].map((e) => e.textContent?.trim()).find((s) => s?.includes('自动选用')) ?? '',
  }));
  console.log('搜索南京后（应为 32.06/118.80 + 时钟）:', JSON.stringify(after, null, 2));

  // 4. 再点查询按钮确认
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('查询'));
    btn.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  const afterQuery = await page.evaluate(() => ({
    lat: document.querySelector('#lat').value,
    header: document.querySelector('section header span')?.textContent?.trim() ?? '',
  }));
  console.log('点击查询后（应保持南京）:', JSON.stringify(afterQuery));

  console.log('页面错误:', errors.length ? errors : '无');
  await browser.close();
})();
