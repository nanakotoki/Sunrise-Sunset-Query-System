// 诊断：全年视图图表实际渲染范围 + 地图瓦片加载情况
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,1000'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto('file:///C:/Users/%E6%97%B6%E5%98%89%E5%BA%86/github/Sunrise-Sunset-Query-System/dist-single/index.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await new Promise((r) => setTimeout(r, 2500));

  const diag = await page.evaluate(() => {
    const svg = document.querySelector('svg[role="img"]');
    if (!svg) return { error: 'no svg chart found' };
    const paths = [...svg.querySelectorAll('path')].map((p) => p.getAttribute('d') || '');
    const xExtents = paths.map((d) => {
      const nums = [...d.matchAll(/([\d.]+),([\d.]+)/g)].map((m) => ({ x: parseFloat(m[1]), y: parseFloat(m[2]) }));
      if (!nums.length) return null;
      return { minX: Math.min(...nums.map((n) => n.x)), maxX: Math.max(...nums.map((n) => n.x)) };
    });
    const tableRows = document.querySelectorAll('tbody tr').length;
    const monthLabels = [...svg.querySelectorAll('text')].map((t) => t.textContent).filter((s) => /月|M$/.test(s));
    const svgBox = svg.getBoundingClientRect();
    return {
      paths: paths.map((d) => d.slice(0, 60) + '...'),
      xExtents,
      svgWidth: svgBox.width,
      svgViewportWidth: svg.parentElement?.clientWidth,
      tableRows,
      monthLabels: monthLabels.join(','),
    };
  });
  console.log('[全年视图诊断]', JSON.stringify(diag, null, 2));

  // 地图瓦片加载诊断
  const mapDiag = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 3000));
    const mapEl = document.querySelector('.leaflet-container');
    if (!mapEl) return { error: 'no map container' };
    const tiles = [...mapEl.querySelectorAll('img.leaflet-tile')];
    const loaded = tiles.filter((t) => t.complete && t.naturalWidth > 0);
    return {
      tileTotal: tiles.length,
      tileLoaded: loaded.length,
      mapSize: { w: mapEl.clientWidth, h: mapEl.clientHeight },
      sampleSrc: tiles[0]?.src ?? 'none',
    };
  });
  console.log('[地图诊断]', JSON.stringify(mapDiag, null, 2));

  // 截图全年视图区域
  const svgEl = await page.$('svg[role="img"]');
  if (svgEl) {
    await svgEl.scrollIntoView();
    await new Promise((r) => setTimeout(r, 500));
    await svgEl.screenshot({ path: 'scripts/yearly-chart.png' });
    console.log('[截图] scripts/yearly-chart.png');
  }
  const mapEl = await page.$('.leaflet-container');
  if (mapEl) {
    await mapEl.scrollIntoView();
    await new Promise((r) => setTimeout(r, 1500));
    await mapEl.screenshot({ path: 'scripts/map-area.png' });
    console.log('[截图] scripts/map-area.png');
  }

  await browser.close();
})();
