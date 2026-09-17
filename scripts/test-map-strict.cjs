// 地图严谨测试：瓦片覆盖率网格采样 + 动画停止后截图 + 徽章状态正确检测
const puppeteer = require('puppeteer-core');

const URL = 'file:///C:/Users/%E6%97%B6%E5%98%89%E5%BA%86/github/Sunrise-Sunset-Query-System/dist-single/index.html';

async function tileCoverage(page) {
  return page.evaluate(() => {
    const container = document.querySelector('.leaflet-container');
    if (!container) return { error: 'no container' };
    const rect = container.getBoundingClientRect();
    // 5x5 网格采样：每个点下面应该是瓦片图片（不是容器背景）
    let covered = 0;
    const misses = [];
    for (let gx = 1; gx <= 5; gx++) {
      for (let gy = 1; gy <= 5; gy++) {
        const x = rect.left + (rect.width * gx) / 6;
        const y = rect.top + (rect.height * gy) / 6;
        const el = document.elementFromPoint(x, y);
        const cls = el ? String(el.className || '') : '';
        const isTile = cls.includes('leaflet-tile') && el.tagName === 'IMG' && el.complete && el.naturalWidth > 0;
        if (isTile) covered++;
        else misses.push({ gx, gy, cls: cls.slice(0, 30) });
      }
    }
    // 徽章：查可见的提示元素（排除 script 内字符串）
    const badges = [...document.querySelectorAll('.leaflet-container ~ div, .relative > div')]
      .map((d) => d.textContent?.trim())
      .filter((s) => s && (s.includes('加载中') || s.includes('失败')));
    return {
      coverage: `${covered}/25`,
      misses: misses.slice(0, 5),
      badgeText: badges[0] ?? null,
      animating: !!document.querySelector('.leaflet-zoom-anim, .leaflet-animating'),
    };
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 8000)); // 瓦片 + 动画全部停止

  console.log('[初始状态]', JSON.stringify(await tileCoverage(page)));

  const mapEl = await page.$('.leaflet-container');
  await mapEl.screenshot({ path: 'scripts/map-settled.png' });

  // 温和拖拽（模拟用户平移，不是暴力甩）
  const box = await mapEl.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(cx - i * 40, cy, { steps: 3 });
  }
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 5000)); // 等新瓦片加载完

  console.log('[平移后]', JSON.stringify(await tileCoverage(page)));
  await mapEl.screenshot({ path: 'scripts/map-after-pan.png' });

  // 极限拖拽测试：能否拖出世界（拖到边界后应被粘住）
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(cx - i * 100, cy + i * 50, { steps: 2 });
  }
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 5000));
  const extreme = await tileCoverage(page);
  console.log('[极限拖拽后]', JSON.stringify(extreme));
  await mapEl.screenshot({ path: 'scripts/map-extreme.png' });

  console.log('页面错误:', errors.length ? errors : '无');
  await browser.close();
})();
