// 在 Node 里直接跑编译后的搜索逻辑（复刻用户环境：file:// 打开，无可用在线源时）
const puppeteer = require('puppeteer-core');
const url = 'file:///C:/Users/%E6%97%B6%E5%98%89%E5%BA%86/github/Sunrise-Sunset-Query-System/dist-single/index.html';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2000));

  // 直接调用 bundle 内部的搜索函数测试各种查询
  const result = await page.evaluate(async () => {
    // 找到 React Fiber 根拿模块引用比较绕；直接观察 DOM 行为更可靠
    const input = document.querySelector('input[type="search"]');
    const setVal = (v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const clickSearch = () => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('搜索'));
      btn.click();
    };
    const readList = () => [...document.querySelectorAll('ul button')].map((b) => b.textContent?.trim());

    const out = {};
    for (const q of ['南京', '深圳', '南京的', '東京', 'tokyo', 'nanjing']) {
      setVal(q);
      clickSearch();
      await new Promise((r) => setTimeout(r, 700));
      out[q] = readList().slice(0, 3);
    }
    return out;
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
