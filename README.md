# SunTime Explorer — 全球日出日落时间查询

纯前端网页应用：输入经纬度或搜索地名，查询任意日期（1900–2100）的日出、日落、太阳正午、昼长与暮光时刻，支持极昼极夜提示、地图选点、全年曲线与 CSV 导出。

**计算全部在浏览器本地完成，无后端、无账号、无数据收集。**

## 部署

### GitHub Pages（自动，推荐）

仓库已内置 GitHub Actions 工作流（`.github/workflows/deploy.yml`）：推送 `main` 分支即自动构建并部署。首次使用：

1. 推送代码到 GitHub
2. 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**
3. 等待 Actions 跑完，访问 `https://<用户名>.github.io/Sunrise-Sunset-Query-System/`

### 其他静态托管（Vercel / Netlify / Cloudflare Pages）

零配置：构建命令 `npm run build`，输出目录 `dist`。绑定自定义域名在对应平台的域名设置里操作，HTTPS 自动开启（定位功能需要 HTTPS）。

## 快速开始

**最简单的用法（Windows）**：双击项目根目录的 `start-suntime.bat`，自动用 Chrome/Edge 打开单文件版，不经夸克等默认浏览器关联。需要 GPS 定位按钮时，双击 `start-suntime-gps.bat`（本地服务器版，localhost 下定位可用）。

> 启动器脚本（.bat/.ps1）内容必须保持纯 ASCII：cmd 按 GBK 解析 .bat，PowerShell 对无 BOM 文件按 ANSI 解析，中文会破坏命令导致窗口一闪而过。

```bash
npm install
npm run dev        # 开发服务器 http://localhost:5173
```

生产构建：

```bash
npm run build           # 输出到 dist/（多文件，常规部署）
npm run build:single    # 输出到 dist-single/index.html（单文件，任意静态服务器可用）
npm run preview         # 本地预览 dist/
```

## 功能

| 类别 | 功能 |
|------|------|
| 必做 (MVP) | 经纬度输入与校验 · 年/月/日选择(1900–2100) · 日出/日落/太阳正午 · 昼长(时:分:秒) · 经度估算时区 + UTC 双时间 · 极昼/极夜提示 · 响应式布局 |
| 增强 | 地名搜索（离线城市库 + Open-Meteo/Photon/Nominatim 三源回退）· 地图选点(Leaflet) · 全年视图(SVG 曲线 + 表格) · 民用/航海/天文三种暮光 + 黄金时刻 · 一键定位 + IP 定位回退 · 复制文本 / 导出 CSV(单日 + 全年) · 中英文切换 · 动态晨昏背景(随本机/查询地时间平滑渐变，极昼极夜联动，可锁定预览) |

技术栈：React 18 + TypeScript + Vite + Tailwind CSS v4 + SunCalc + Leaflet。

## 地名搜索策略

优先离线匹配（内嵌 477 城市：中国大陆全部地级市/州/盟 + 港澳台 + 全球主要城市 + 极地代表点，支持中文/拼音/英文/全角输入，断网可用）；未命中时依次尝试 Open-Meteo → Photon → Nominatim（各有 6 秒超时，任一成功即返回）；全部失败时回退本地模糊匹配。城市库由 `scripts/gen-city-db.mjs` 生成，验证：`npm run verify:citydb`（未配置 npm script 时直接 `node scripts/verify-city-db.mjs`）。

## 定位说明

- **GPS 定位**：需要浏览器安全上下文（HTTPS 或 localhost）。`file://` 双击打开时浏览器会禁用定位——此时用 `start-suntime-gps.bat`；权限被拒时按页面提示在地址栏重新授权
- **IP 定位**：不需任何权限，精度城市级，作为 GPS 不可用时的回退

## 时区说明

“当地时间”按经度估算（每 15° = 1 小时，即 UTC + lng/15），与政治时区可能不同；UTC 列显示事件的真实绝对时刻。

## 动态晨昏背景

背景色随“当前展示的时间”呈现晨昏变化，默认跟随本机时间；查询地点后改用该地 IANA 时区（tz-lookup）的实时时间，并以当日真实日出/日落/暮光事件为锚点插值渐变：

- 未搜索：固定时间表（24 小时十段渐变，任务书参考基准）
- 已搜索：事件锚定渐变，日出/日落时刻即对应色；极昼恒为白天色，极夜恒为夜色；高纬度暮光缺失时自动跳过对应锚点，渐变仍连续
- 平滑过渡：颜色用 RGB 线性插值计算，并通过 CSS `@property` 注册 `--sky-top/--sky-bottom` 后由 `transition` 平滑渐变；不支持 `@property` 的浏览器直接取新值（相邻秒色差极小）
- 每秒刷新时钟，星星/太阳/月亮图层随 nightness 淡入淡出；右下角可锁定时间拖动滑块预览任意时段，或整体关闭背景

验证：`npm run verify:skyclock`（插值连续性、极昼极夜、暮光缺失容错、IANA 时区换算）

## 天文算法验证

`npm run verify:solar` 用独立实现的 NOAA 太阳表算法交叉验证 SunCalc 的日出/日落/正午（9 个地点含 1900/2100 年，容差 3 分钟）及极昼极夜判定，全部通过。

## 目录结构

```
├─ docs/                    # 需求文档（任务书）
├─ scripts/
│  ├─ verify-solar.mjs      # NOAA 交叉验证脚本
│  ├─ verify-skyclock.mjs   # 晨昏背景逻辑验证
│  └─ smoke-test.mjs        # 浏览器渲染冒烟测试（需先启动 preview）
├─ src/
│  ├─ components/           # MapPicker / ResultCard / YearlyView / SkyBackground
│  ├─ lib/
│  │  ├─ solar.ts           # 天文计算封装（纯函数）
│  │  ├─ skyclock.ts        # 晨昏背景渐变计算（纯函数）
│  │  ├─ geocode.ts         # Nominatim 地名搜索
│  │  └─ csv.ts             # CSV 导出
│  ├─ i18n.ts               # 中英文文案
│  ├─ App.tsx               # 主界面
│  └─ main.tsx
├─ index.html
├─ vite.config.ts           # 常规构建
└─ vite.single.config.ts    # 单文件构建
```

## 数据来源

- 天文计算：[SunCalc](https://github.com/mourner/suncalc)
- 地图与地名：© [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors（地图瓦片 OSM，地理编码 Nominatim）
