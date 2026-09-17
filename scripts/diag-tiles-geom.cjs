// 诊断：瓦片几何布局 vs 容器
const puppeteer = require('puppeteer-core');

(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto('file:///C:/Users/%E6%97%B6%E5%98%89%E5%BA%86/github/Sunrise-Sunset-Query-System/dist-single/index.html', {
    waitUntil: 'domcontentloaded',
  });
  await new Promise((r) => setTimeout(r, 6000));
  const info = await p.evaluate(() => {
    const cont = document.querySelector('.leaflet-container');
    const crect = cont.getBoundingClientRect();
    const tiles = [...document.querySelectorAll('img.leaflet-tile')];
    return {
      containerRect: { w: Math.round(crect.width), h: Math.round(crect.height), x: Math.round(crect.x), y: Math.round(crect.y) },
      tiles: tiles.map((t) => {
        const r = t.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
          loaded: t.complete && t.naturalWidth > 0,
          src: t.src.split('/').pop().slice(0, 30),
        };
      }),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  const el = await p.$('.leaflet-container');
  await el.screenshot({ path: 'scripts/map-direct.png' });
  await b.close();
})();
