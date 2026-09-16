/**
 * 天文计算验证脚本：node scripts/verify-solar.mjs
 *
 * 用独立实现的 NOAA 太阳表算法（与 SunCalc 不同的实现路径）交叉验证核心数值：
 * - 与 suncalc 对比同地同日的日出/日落/太阳正午，容差 3 分钟；
 * - 极昼极夜专项：高纬度地点在至日应正确判定极昼/极夜。
 *
 * 约定：经度东经为正。当地日期 D 的太阳正午（UT）落在 UT 日 D 内，
 * 因此以「UT 日 D 的 00:00 儒略日」为锚，日出/日落为绝对时刻（可能跨 UT 日）。
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const SunCalc = require('suncalc');

const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;
const RAD = Math.PI / 180;

/* ---------------- NOAA 算法（独立实现） ---------------- */

const toJulian = (date) => date.getTime() / 86400000 + 2440587.5;
const fromJulian = (j) => new Date((j - 2440587.5) * 86400000);
const julianCenturies = (j) => (j - 2451545) / 36525;

function geomMeanLongSun(t) {
  let L = 280.46646 + t * (36000.76983 + 0.0003032 * t);
  return ((L % 360) + 360) % 360;
}
const geomMeanAnomalySun = (t) => 357.52911 + t * (35999.05029 - 0.0001537 * t);
const eccentricityEarthOrbit = (t) => 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

function sunEqOfCenter(t) {
  const m = geomMeanAnomalySun(t) * RAD;
  return (
    Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m) * 0.000289
  );
}
const sunTrueLong = (t) => geomMeanLongSun(t) + sunEqOfCenter(t);

function sunApparentLong(t) {
  const omega = 125.04 - 1934.136 * t;
  return sunTrueLong(t) - 0.00569 - 0.00478 * Math.sin(omega * RAD);
}
function meanObliquityOfEcliptic(t) {
  const sec = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  return 23 + (26 + sec / 60) / 60;
}
function obliquityCorrection(t) {
  const omega = 125.04 - 1934.136 * t;
  return meanObliquityOfEcliptic(t) + 0.00256 * Math.cos(omega * RAD);
}
function sunDeclination(t) {
  const e = obliquityCorrection(t) * RAD;
  const lambda = sunApparentLong(t) * RAD;
  return Math.asin(Math.sin(e) * Math.sin(lambda)) / RAD;
}
function equationOfTime(t) {
  const epsilon = obliquityCorrection(t) * RAD;
  const l0 = geomMeanLongSun(t) * RAD;
  const e = eccentricityEarthOrbit(t);
  const m = geomMeanAnomalySun(t) * RAD;
  const y = Math.tan(epsilon / 2) ** 2;
  const eTime =
    y * Math.sin(2 * l0) -
    2 * e * Math.sin(m) +
    4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
    0.5 * y * y * Math.sin(4 * l0) -
    1.25 * e * e * Math.sin(2 * m);
  return (eTime / RAD) * 4; // minutes
}
function hourAngleSunrise(lat, solarDec) {
  const la = lat * RAD;
  const sd = solarDec * RAD;
  const HAarg = Math.cos(90.833 * RAD) / (Math.cos(la) * Math.cos(sd)) - Math.tan(la) * Math.tan(sd);
  if (HAarg > 1 || HAarg < -1) return null; // 极昼/极夜
  return Math.acos(HAarg) / RAD;
}

/**
 * 求当地日期 (year, month, day) 的日出/日落/太阳正午（绝对时刻，UTC 基准）。
 * 迭代两次：第一次用当日正午的 eqTime/赤纬，第二次在日出时刻附近细化。
 */
function sunTimesForDate(year, month, day, lat, lng) {
  const jd0 = toJulian(new Date(Date.UTC(year, month - 1, day))); // UT 日 00:00
  let t = julianCenturies(jd0 + 0.5);
  let eqTime = 0;
  let sd = 0;
  let ha = 0;
  for (let i = 0; i < 2; i++) {
    eqTime = equationOfTime(t);
    sd = sunDeclination(t);
    ha = hourAngleSunrise(lat, sd);
    if (ha === null) break;
    const noonMin = 720 - 4 * lng - eqTime;
    const sunriseMin = noonMin - ha * 4;
    if (i === 0) t = julianCenturies(jd0 + sunriseMin / 1440); // 在日出时刻附近细化
  }
  if (ha === null) {
    const noonAlt = 90 - Math.abs(lat - sd);
    return { polar: noonAlt > 0 ? 'day' : 'night', sunrise: null, sunset: null, noon: null, noonAlt };
  }
  const noonMin = 720 - 4 * lng - eqTime;
  const noon = fromJulian(jd0 + noonMin / 1440);
  return {
    polar: null,
    sunrise: new Date(noon.getTime() - ha * 4 * MS_MIN),
    sunset: new Date(noon.getTime() + ha * 4 * MS_MIN),
    noon,
    noonAlt: 90 - Math.abs(lat - sd),
  };
}

/* ---------------- 与 SunCalc 对比 ---------------- */

const fmtHM = (d, offsetHours) => {
  if (!d || isNaN(d)) return '—';
  const s = new Date(d.getTime() + offsetHours * MS_HOUR);
  return `${String(s.getUTCHours()).padStart(2, '0')}:${String(s.getUTCMinutes()).padStart(2, '0')}`;
};

const cases = [
  { name: '北京 夏至', year: 2026, month: 6, day: 21, lat: 39.9042, lng: 116.4074 },
  { name: '北京 冬至', year: 2026, month: 12, day: 21, lat: 39.9042, lng: 116.4074 },
  { name: '北京 春分', year: 2026, month: 3, day: 20, lat: 39.9042, lng: 116.4074 },
  { name: '伦敦 夏至', year: 2026, month: 6, day: 21, lat: 51.5074, lng: -0.1278 },
  { name: '纽约 冬至', year: 2026, month: 12, day: 21, lat: 40.7128, lng: -74.006 },
  { name: '悉尼 6月(当地冬)', year: 2026, month: 6, day: 21, lat: -33.8688, lng: 151.2093 },
  { name: '新加坡 赤道附近', year: 2026, month: 10, day: 1, lat: 1.3521, lng: 103.8198 },
  { name: '历史 1900 东京', year: 1900, month: 7, day: 1, lat: 35.6762, lng: 139.6503 },
  { name: '未来 2100 莫斯科', year: 2100, month: 1, day: 1, lat: 55.7558, lng: 37.6173 },
];

let failed = 0;
console.log('交叉验证 SunCalc vs NOAA（容差 3 分钟）\n');

for (const c of cases) {
  const offsetHours = c.lng / 15;
  const anchor = new Date(Date.UTC(c.year, c.month - 1, c.day, 12, 0, 0) - offsetHours * MS_HOUR);
  const sc = SunCalc.getTimes(anchor, c.lat, c.lng);
  const noaa = sunTimesForDate(c.year, c.month, c.day, c.lat, c.lng);

  const parts = [];
  const cmp = (label, a, b) => {
    if (!a || !b || isNaN(a.getTime()) || isNaN(b.getTime())) {
      parts.push(`${label}: 无法比较`);
      failed++;
      return;
    }
    const diff = Math.abs(a.getTime() - b.getTime()) / MS_MIN;
    if (diff > 3) {
      failed++;
      parts.push(`${label}: ✗ ${diff.toFixed(1)}min`);
    } else {
      parts.push(`${label}: ✓ ${diff.toFixed(1)}min`);
    }
  };

  if (noaa.polar) {
    const scPolar = isNaN(sc.sunrise.getTime())
      ? SunCalc.getPosition(sc.solarNoon, c.lat, c.lng).altitude > 0
        ? 'day'
        : 'night'
      : null;
    const ok = scPolar === noaa.polar;
    if (!ok) failed++;
    parts.push(`极${noaa.polar === 'day' ? '昼' : '夜'} NOAA vs SunCalc:${scPolar ? '极' + (scPolar === 'day' ? '昼' : '夜') : '正常'} ${ok ? '✓' : '✗'}`);
  } else {
    cmp('日出', noaa.sunrise, sc.sunrise);
    cmp('日落', noaa.sunset, sc.sunset);
    cmp('正午', noaa.noon, sc.solarNoon);
  }
  console.log(
    `${c.name}: ${parts.join(' | ')}  [SC: ↑${fmtHM(sc.sunrise, offsetHours)} ↓${fmtHM(sc.sunset, offsetHours)} @UTC+${offsetHours.toFixed(2)}]`,
  );
}

console.log('\n极昼极夜专项:');
const polarCases = [
  { name: '朗伊尔城 78.2N 冬至', expect: 'night', lat: 78.2232, lng: 15.6267, month: 12, day: 21 },
  { name: '朗伊尔城 78.2N 夏至', expect: 'day', lat: 78.2232, lng: 15.6267, month: 6, day: 21 },
  { name: '北极点附近 夏至', expect: 'day', lat: 89.9, lng: 0, month: 6, day: 21 },
  { name: '南极点附近 6月', expect: 'night', lat: -89.9, lng: 0, month: 6, day: 21 },
];
for (const p of polarCases) {
  const anchor = new Date(Date.UTC(2026, p.month - 1, p.day, 12, 0, 0) - (p.lng / 15) * MS_HOUR);
  const sc = SunCalc.getTimes(anchor, p.lat, p.lng);
  const hasRise = !isNaN(sc.sunrise.getTime());
  const alt = (SunCalc.getPosition(sc.solarNoon, p.lat, p.lng).altitude * 180) / Math.PI;
  const kind = hasRise ? 'normal' : alt > 0 ? 'day' : 'night';
  const ok = kind === p.expect;
  if (!ok) failed++;
  console.log(`  ${p.name}: ${kind === 'day' ? '极昼' : kind === 'night' ? '极夜' : '正常日出日落'} (正午高度 ${alt.toFixed(1)}°) ${ok ? '✓' : '✗ 期望' + p.expect}`);
}

console.log(failed === 0 ? '\n✅ 全部通过' : `\n❌ ${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
