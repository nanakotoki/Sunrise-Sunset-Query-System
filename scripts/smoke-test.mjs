// 浏览器冒烟测试：加载页面，验证 React 渲染 + 天文计算结果出现在 DOM。
(async () => {
  // 等待页面可访问
  for (let i = 0; i < 30; i++) {
    try {
      await fetch('http://localhost:4173/');
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // 在页面上下文中执行验证逻辑
  const testCode = `
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  await sleep(1500);
  const root = document.getElementById('root');
  const html = root ? root.innerHTML : '';
  const checks = {
    rendered: html.length > 1000,
    hasAppTitle: html.includes('SunTime Explorer'),
    hasResult: html.includes('日出') || html.includes('Sunrise'),
    hasDayLength: html.includes('昼长') || html.includes('Day length'),
    hasMapContainer: !!document.querySelector('.leaflet-container'),
    hasYearlySvg: !!document.querySelector('svg[role="img"]'),
    hasTwilight: html.includes('民用暮光') || html.includes('Civil dusk'),
    svgPathCount: document.querySelectorAll('svg path').length,
  };
  return checks;
})()
`;

  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);

  // 用 Chrome headless dump-dom 抓取渲染后的 DOM
  const { stdout } = await run(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--virtual-time-budget=8000',
      '--dump-dom',
      'http://localhost:4173/',
    ],
    { timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
  );

  const checks = {
    rendered: stdout.includes('SunTime Explorer'),
    hasResultCard: /日出|Sunrise/.test(stdout),
    hasDayLength: /昼长|Day length/.test(stdout),
    hasTwilight: /民用暮光|Civil dusk/.test(stdout),
    hasYearlyTable: /全年|Yearly/.test(stdout),
    hasLeaflet: stdout.includes('leaflet-container'),
    hasSvgChart: /chartHint|全年日出日落|Sunrise \/ sunset/.test(stdout),
    hasPresetBtns: stdout.includes('北京') && stdout.includes('Sydney'),
    hasFormInputs: stdout.includes('lat') && stdout.includes('year'),
  };

  let failed = 0;
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? '✓' : '✗'} ${k}`);
    if (!v) failed++;
  }
  console.log(failed === 0 ? '\n✅ 浏览器冒烟测试全部通过' : `\n❌ ${failed} 项失败`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error('SMOKE ERROR:', e.message);
  process.exit(1);
});
