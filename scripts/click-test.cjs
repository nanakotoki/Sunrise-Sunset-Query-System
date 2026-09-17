// 真实点击测试 v2：原生监听器验证物理点击是否命中查询按钮，多窗口尺寸。
const path = require('path');
const puppeteer = require('puppeteer-core');

const htmlPath = path.resolve(__dirname, '..', 'dist-single', 'index.html');
const encodedUrl = new URL('file:///' + htmlPath.split(path.sep).join('/')).href;

const sizes = [
  { name: '桌面 1280x900', width: 1280, height: 900 },
  { name: '窄窗口 700x800', width: 700, height: 800 },
  { name: '更窄 500x800', width: 500, height: 800 },
  { name: '手机 390x844', width: 390, height: 844 },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();

  for (const s of sizes) {
    await page.setViewport({ width: s.width, height: s.height });
    await page.goto(encodedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1200));

    // 在按钮和表单上挂原生监听器
    await page.evaluate(() => {
      window.__qClick = false;
      window.__qSubmit = false;
      const btns = [...document.querySelectorAll('button')];
      const q = btns.find((b) => b.textContent.includes('查询') || b.textContent.includes('Query'));
      if (q) {
        q.addEventListener('click', () => (window.__qClick = true));
        q.closest('form').addEventListener('submit', () => (window.__qSubmit = true));
      }
    });

    const rect = await page.evaluate(() => {
      const q = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('查询') || b.textContent.includes('Query'));
      if (!q) return null;
      const r = q.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom };
    });
    if (!rect) {
      console.log(`${s.name}: 按钮未找到`);
      continue;
    }

    // 需要滚动到可见再点
    await page.evaluate(() => {
      const q = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('查询') || b.textContent.includes('Query'));
      q.scrollIntoView({ block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 300));
    const rect2 = await page.evaluate(() => {
      const q = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('查询') || b.textContent.includes('Query'));
      const r = q.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    // 点击前记录遮挡情况
    const hit = await page.evaluate((r) => {
      const el = document.elementFromPoint(r.x, r.y);
      const q = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('查询') || b.textContent.includes('Query'));
      return el === q ? 'SELF' : el ? el.tagName + '.' + String(el.className).slice(0, 40) : 'NULL';
    }, rect2);

    await page.mouse.click(rect2.x, rect2.y);
    await new Promise((r) => setTimeout(r, 400));
    const result = await page.evaluate(() => ({ click: window.__qClick, submit: window.__qSubmit }));

    console.log(`${s.name.padEnd(14)} 遮挡=${hit.padEnd(20)} 点击触发=${result.click} 表单提交=${result.submit}`);
  }

  await browser.close();
})().catch((e) => {
  console.error('失败:', e.message);
  process.exit(1);
});
