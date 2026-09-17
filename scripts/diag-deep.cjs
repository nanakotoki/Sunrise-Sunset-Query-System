// 深度诊断：瓦片网格坐标 vs 渲染位置、Leaflet 内部状态、pane 定位
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
    const map = cont?._leaflet_map ?? window.__map ?? null;
    const tiles = [...document.querySelectorAll('img.leaflet-tile')];
    const tileContainers = [...document.querySelectorAll('.leaflet-tile-container')];
    const pane = document.querySelector('.leaflet-map-pane');
    return {
      leafletVersion: L?.version,
      // 从 URL 提取每个瓦片的 xyz 网格坐标
      tiles: tiles.map((t) => {
        const r = t.getBoundingClientRect();
        const m = t.src.match(/x=(\d+)&y=(\d+)&z=(\d+)/) ?? t.src.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);
        return {
          grid: m ? `${m[3]}/${m[1]}/${m[2]}` : t.src.slice(-40),
          renderY: Math.round(r.y),
          renderX: Math.round(r.x),
          styleLeft: t.style.left,
          styleTop: t.style.top,
        };
      }),
      tileContainerCount: tileContainers.length,
      tileContainerClasses: tileContainers.map((c) => c.className),
      mapPaneTransform: pane?.style.transform,
      mapPanePosition: pane ? getComputedStyle(pane).position : null,
      containerPosition: getComputedStyle(cont).position,
      containerRect: (() => {
        const r = cont.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      })(),
      zoomAnim: !!document.querySelector('.leaflet-zoom-anim'),
      // Leaflet map 实例内部状态
      mapState: map ? { zoom: map.getZoom(), size: map.getSize(), center: map.getCenter() } : null,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
