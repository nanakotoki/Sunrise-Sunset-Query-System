// 动态晨昏背景逻辑验证：插值连续性、极昼极夜、事件缺失容错、IANA 时区换算。
// Node 24 原生支持 TS 类型擦除，直接 import .ts 源码。
import { computeDay } from '../src/lib/solar.ts';
import { skyFromClockHour, skyFromEvents, eventHours, hourOfDayIn } from '../src/lib/skyclock.ts';

let failed = 0;
function ok(cond, name, extra = '') {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failed++;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function maxChannelDelta(a, b) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.max(Math.abs(r1 - r2), Math.abs(g1 - g2), Math.abs(b1 - b2));
}

console.log('== 固定时间表（未搜索，跟随本机时钟） ==');
ok(skyFromClockHour(0).top === '#0a0e27', '深夜 00:00 顶部 #0a0e27', skyFromClockHour(0).top);
ok(skyFromClockHour(12).nightness === 0, '正午 12:00 nightness=0');
const h5 = skyFromClockHour(5.25);
ok(h5.nightness > 0.3 && h5.nightness < 0.8, '拂晓 05:15 nightness 介于 0.3–0.8', h5.nightness.toFixed(2));

{
  let maxJump = 0;
  let prev = skyFromClockHour(0);
  for (let h = 0.05; h <= 24.0001; h += 0.05) {
    const s = skyFromClockHour(h);
    maxJump = Math.max(maxJump, maxChannelDelta(prev.top, s.top), maxChannelDelta(prev.bottom, s.bottom));
    prev = s;
  }
  ok(maxJump <= 8, '固定表相邻 3 分钟色差 ≤ 8/255（平滑）', `max=${maxJump.toFixed(1)}`);
}

console.log('\n== 事件锚定（已搜索，真实日出日落） ==');
const bj = computeDay(2026, 12, 21, 39.9042, 116.4074); // 北京冬至
const ev = eventHours(bj, 'Asia/Shanghai');
ok(ev.sunrise > 7 && ev.sunrise < 8, '北京冬至日出 ≈ 07:3x（Asia/Shanghai）', ev.sunrise.toFixed(2));
ok(ev.sunset > 16 && ev.sunset < 17.5, '北京冬至日落 ≈ 16:5x', ev.sunset.toFixed(2));
ok(ev.noon > 12 && ev.noon < 12.8, '太阳正午 ≈ 12:1x', ev.noon.toFixed(2));

{
  const noonSky = skyFromEvents(ev.noon, ev, null);
  const nightSky = skyFromEvents(0.5, ev, null);
  ok(noonSky.nightness === 0, '正午为白天色', noonSky.phase);
  ok(nightSky.nightness > 0.9, '午夜为夜色 nightness>0.9', nightSky.nightness.toFixed(2));
}

{
  let maxJump = 0;
  let phaseChanges = 0;
  let prev = skyFromEvents(0, ev, null);
  for (let h = 0.02; h <= 24.0001; h += 0.02) {
    const s = skyFromEvents(h, ev, null);
    maxJump = Math.max(maxJump, maxChannelDelta(prev.top, s.top), maxChannelDelta(prev.bottom, s.bottom));
    if (s.phase !== prev.phase) phaseChanges++;
    prev = s;
  }
  ok(maxJump <= 12, '事件锚定相邻 72 秒色差 ≤ 12/255（平滑无跳变）', `max=${maxJump.toFixed(1)}`);
  ok(phaseChanges >= 8, '一天内经历多个天色阶段', `${phaseChanges} 次切换`);
}
ok(skyFromEvents(ev.sunrise, ev, null).phase === 'sunrise', '恰在日出时刻 phase=sunrise');
ok(skyFromEvents(ev.sunset, ev, null).phase === 'sunset', '恰在日落时刻 phase=sunset');

console.log('\n== 极昼极夜联动 ==');
const polarDay = computeDay(2026, 6, 21, 78.22, 15.65); // 朗伊尔城夏至
const polarNight = computeDay(2026, 12, 21, 78.22, 15.65); // 朗伊尔城冬至
ok(polarDay.polar === 'day' && polarNight.polar === 'night', '朗伊尔城夏至极昼 / 冬至极夜');
{
  const dayEvs = eventHours(polarDay, 'Arctic/Longyearbyen');
  let allDay = true;
  let same = true;
  const first = skyFromEvents(3, dayEvs, 'day');
  for (let h = 0; h <= 24; h += 1) {
    const s = skyFromEvents(h, dayEvs, 'day');
    if (s.nightness !== 0 || s.phase !== 'polarDay') allDay = false;
    if (s.top !== first.top) same = false;
  }
  ok(allDay, '极昼：任意时刻恒为白天色（nightness=0）');
  ok(same, '极昼：颜色恒定不闪烁');

  const nightEvs = eventHours(polarNight, 'Arctic/Longyearbyen');
  let allNight = true;
  for (let h = 0; h <= 24; h += 1) {
    const s = skyFromEvents(h, nightEvs, 'night');
    if (s.nightness !== 1 || s.phase !== 'polarNight') allNight = false;
  }
  ok(allNight, '极夜：任意时刻恒为夜色（nightness=1）');
}

console.log('\n== 暮光事件缺失容错（雷克雅未克夏至：仅剩日出日落/黄金时刻） ==');
{
  const rvk = computeDay(2026, 6, 21, 64.1466, -21.9426);
  const ev2 = eventHours(rvk, 'Atlantic/Reykjavik');
  ok(
    ev2.dawn === undefined && ev2.nauticalDawn === undefined && ev2.astroDawn === undefined && ev2.astroDusk === undefined,
    '民用/航海/天文晨昏缺失 → undefined',
  );
  ok(ev2.sunrise != null && ev2.sunset != null, '日出日落仍存在（白夜）', `↑${ev2.sunrise?.toFixed(2)} ↓${ev2.sunset?.toFixed(2)}`);
  let maxJump = 0;
  let prev = skyFromEvents(0, ev2, null);
  for (let h = 0.02; h <= 24.0001; h += 0.02) {
    const s = skyFromEvents(h, ev2, null);
    maxJump = Math.max(maxJump, maxChannelDelta(prev.top, s.top), maxChannelDelta(prev.bottom, s.bottom));
    prev = s;
  }
  ok(maxJump <= 15, '事件缺失时插值仍连续', `max=${maxJump.toFixed(1)}`);
}

console.log('\n== IANA 时区换算 ==');
const t1 = Date.UTC(2026, 8, 16, 10, 30, 0); // 10:30 UTC
ok(Math.abs(hourOfDayIn(t1, 'Asia/Tokyo') - 19.5) < 0.01, 'UTC 10:30 → 东京 19:30', hourOfDayIn(t1, 'Asia/Tokyo').toFixed(3));
ok(Math.abs(hourOfDayIn(t1, 'Asia/Shanghai') - 18.5) < 0.01, 'UTC 10:30 → 北京 18:30', hourOfDayIn(t1, 'Asia/Shanghai').toFixed(3));
ok(Math.abs(hourOfDayIn(t1, 'Europe/London') - 11.5) < 0.01, 'UTC 10:30 → 伦敦（BST）11:30', hourOfDayIn(t1, 'Europe/London').toFixed(3));
const t2 = Date.UTC(2026, 8, 16, 15, 0, 0);
ok(Math.abs(hourOfDayIn(t2, 'Pacific/Kiritimati') - 5) < 0.01, 'UTC 15:00 → 圣诞岛（UTC+14）次日 05:00', hourOfDayIn(t2, 'Pacific/Kiritimati').toFixed(3));
ok(Number.isNaN(hourOfDayIn(t1, 'Not/AZone')), '非法时区 → NaN（上层退回经度估算时区）');

console.log(failed === 0 ? '\n✅ 天色背景逻辑全部通过' : `\n❌ ${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
