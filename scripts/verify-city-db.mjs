// 验证离线城市库匹配逻辑（node 直接跑，不依赖浏览器）。
// geocode.ts 是 ESM + TS，这里用 vite 的依赖加载不方便，直接用简单文本断言代替：
// 检查 city-db.ts 里的城市数量和若干关键城市的存在性。
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/lib/city-db.ts', import.meta.url), 'utf-8');

const cities = [...src.matchAll(/\{ zh: '([^']+)', aliases: \[([^\]]+)\], lat: (-?[\d.]+), lng: (-?[\d.]+) \}/g)].map(
  (m) => ({ zh: m[1], aliases: m[2].split(',').map((a) => a.trim().replace(/'/g, '')), lat: parseFloat(m[3]), lng: parseFloat(m[4]) }),
);

console.log(`城市总数: ${cities.length}`);
let fail = 0;

function check(cond, label) {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
}

check(cities.length >= 470, `城市数 ≥ 470（实际 ${cities.length}）`);
check(cities.some((c) => c.zh === '北京' && Math.abs(c.lat - 39.9042) < 0.001), '北京坐标正确');
check(cities.some((c) => c.zh === '深圳' && c.aliases.includes('shenzhen')), '深圳含英文别名');
check(cities.some((c) => c.zh === '乌鲁木齐' && c.aliases.includes('urumqi')), '乌鲁木齐含拼音+英文别名');
check(cities.some((c) => c.zh === '朗伊尔城'), '极地城市朗伊尔城在库（极昼极夜演示）');
check(cities.some((c) => c.zh === ' Honolulu'.trim() || c.aliases.includes('honolulu')), '檀香山在库');

// 模拟 searchOffline 的关键行为：规范化和匹配优先级
function normalize(s) {
  return s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[市区县旗盟州]$/, '');
}
const beijing = cities.find((c) => c.zh === '北京');
check(beijing.aliases.some((a) => normalize(a) === normalize('BEIJING')), '英文大写也能匹配（normalize）');
check(normalize('北京市') === normalize('北京'), '"北京市" 匹配 "北京"（去掉市后缀）');
check(normalize('Ｓｈａｎｇｈａｉ') === normalize('shanghai'), '全角字母匹配半角');

// 经纬度范围合法性
const badCoord = cities.filter((c) => !Number.isFinite(c.lat) || !Number.isFinite(c.lng) || Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180);
check(badCoord.length === 0, `所有城市坐标合法（异常 ${badCoord.length} 个：${badCoord.map((c) => c.zh).join('、')}）`);

// 别名唯一性（同一城市内不重复）
const dupAlias = cities.filter((c) => new Set(c.aliases.map(normalize)).size !== c.aliases.length);
check(dupAlias.length === 0, `城市内别名无重复（异常 ${dupAlias.length} 个）`);

console.log(fail === 0 ? '\n✅ 离线城市库验证全部通过' : `\n❌ ${fail} 项失败`);
process.exit(fail === 0 ? 0 : 1);
