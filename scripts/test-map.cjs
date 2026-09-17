// 地图专项测试：瓦片完整性（多子域）、边界锁定、点击选点、标记跟随
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

  // 等待地图瓦片加载（给多源探测 + 多子域时间）
  await new Promise((r) => setTimeout(r, 6000));

  const mapInfo = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('img.leaflet-tile')];
    const loaded = tiles.filter((t) => t.complete && t.naturalWidth > 0);
    const srcs = new Set(loaded.map((t) => {
      try { return new URL(t.src).hostname; } catch { return 'bad'; }
    }));
    return {
      tileTotal: tiles.length,
      tileLoaded: loaded.length,
      hostnames: [...srcs],
      failedBadge: !!document.evaluate("//*[contains(text(),'瓦片加载失败')]", document, null, 9, null).singleNodeValue,
      loadingBadge: !!document.evaluate("//*[contains(text(),'地图加载中')]", document, null, 9, null).singleNodeValue,
    };
  });
  console.log('[瓦片加载]', JSON.stringify(mapInfo, null, 1));

  // 边界锁定测试：尝试用 Leaflet API 硬性拖出世界，看能不能成功
  const boundsTest = await page.evaluate(() => {
    const container = document.querySelector('.leaflet-container');
    // 直接调 Leaflet 内部 map 实例
    const map = Object.keys(container).filter((k) => k.startsWith('_leaflet')).length
      ? null
      : null;
    // 通过事件模拟拖拽：mousedown → 多次 mousemove 向左下大力拖 → mouseup
    return { containerFound: !!container };
  });

  // 用鼠标真实拖拽模拟（拖 5 次，每次 500px 向左）
  const mapEl = await page.$('.leaflet-container');
  const box = await mapEl.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(cx - i * 80, cy + i * 40, { steps: 2 });
  }
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 1500));

  const afterDrag = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('img.leaflet-tile')];
    const loaded = tiles.filter((t) => t.complete && t.naturalWidth > 0);
    // 检查是否出现大片灰色（无瓦片）区域：取地图中心点 3x3 采样
    const container = document.querySelector('.leaflet-container');
    const rect = container.getBoundingClientRect();
    const sample = (x, y) => {
      const el = document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y);
      return el ? el.className?.toString().slice(0, 40) : 'none';
    };
    return {
      tileLoaded: loaded.length,
      tileTotal: tiles.length,
      center: sample(0.5, 0.5),
      corner: sample(0.03, 0.03),
      corner2: sample(0.97, 0.97),
    };
  });
  console.log('[大力拖拽后]', JSON.stringify(afterDrag, null, 1));

  // 点击选点测试
  await page.mouse.click(cx, cy);
  await new Promise((r) => setTimeout(r, 800));
  const afterClick = await page.evaluate(() => ({
    lat: document.querySelector('#lat')?.value,
    lng: document.querySelector('#lng')?.value,
  }));
  console.log('[点击地图选点]', JSON.stringify(afterClick));

  // 截图最终状态
  await mapEl.screenshot({ path: 'scripts/map-final.png' });
  console.log('[截图] scripts/map-final.png');
  console.log('页面错误:', errors.length ? errors : '无');
  await browser.close();
})();
