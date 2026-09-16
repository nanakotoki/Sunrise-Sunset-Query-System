import SunCalc from 'suncalc';

/**
 * 天文计算封装（纯函数，无 DOM / React 依赖，便于独立验证）。
 *
 * 时区约定（对应需求 F5）：
 * - “当地时间” = 按经度估算的时区（每 15° = 1 小时），即 UTC + lng/15；
 * - “UTC 时间” = 事件的真实绝对时刻（Date 本身）。
 */

export type PolarKind = 'day' | 'night';

export interface DayCalc {
  year: number;
  month: number;
  day: number;
  lat: number;
  lng: number;
  /** 按经度估算的时区偏移（小时），东经为正 */
  offsetHours: number;
  /** 极昼 / 极夜；null 表示正常日出日落 */
  polar: PolarKind | null;
  /** 正午太阳高度角（度） */
  noonAltitude: number;
  sunrise: Date | null;
  sunset: Date | null;
  solarNoon: Date;
  solarMidnight: Date | null;
  /** 民用晨光（太阳 -6°） */
  dawn: Date | null;
  /** 民用暮光 */
  dusk: Date | null;
  nauticalDawn: Date | null;
  nauticalDusk: Date | null;
  astroDawn: Date | null;
  astroDusk: Date | null;
  /** 清晨黄金时刻结束（之后进入普通白昼） */
  goldenHourEnd: Date | null;
  /** 傍晚黄金时刻开始 */
  goldenHour: Date | null;
  /** 昼长（毫秒）；极昼=24h，极夜=0 */
  dayLengthMs: number;
}

export interface YearRow {
  month: number;
  day: number;
  weekday: number;
  sunrise: Date | null;
  sunset: Date | null;
  dayLengthMs: number;
  polar: PolarKind | null;
}

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

export const estOffsetHours = (lng: number): number => lng / 15;

/**
 * 构造“该地当天正午”对应的绝对时刻。
 * 当地正午 12:00 = UTC(12:00) - offset，保证查询的年/月/日落在目标地点的同一个自然日内，
 * 且不受浏览器本地时区影响。
 */
export function anchorDate(year: number, month: number, day: number, lng: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0) - estOffsetHours(lng) * MS_HOUR);
}

function valid(d: Date | undefined): Date | null {
  return d && !isNaN(d.getTime()) ? d : null;
}

export function computeDay(year: number, month: number, day: number, lat: number, lng: number): DayCalc {
  const offsetHours = estOffsetHours(lng);
  const anchor = anchorDate(year, month, day, lng);
  const times = SunCalc.getTimes(anchor, lat, lng);

  const sunrise = valid(times.sunrise);
  const sunset = valid(times.sunset);
  const solarNoon = valid(times.solarNoon) ?? anchor;
  const solarMidnight = valid(times.nadir);

  const noonAltitude = (SunCalc.getPosition(solarNoon, lat, lng).altitude * 180) / Math.PI;

  let polar: PolarKind | null = null;
  if (!sunrise || !sunset) {
    polar = noonAltitude > 0 ? 'day' : 'night';
  }

  const dayLengthMs =
    polar === 'day' ? MS_DAY : polar === 'night' ? 0 : sunset && sunrise ? sunset.getTime() - sunrise.getTime() : 0;

  return {
    year,
    month,
    day,
    lat,
    lng,
    offsetHours,
    polar,
    noonAltitude,
    sunrise,
    sunset,
    solarNoon,
    solarMidnight,
    dawn: valid(times.dawn),
    dusk: valid(times.dusk),
    nauticalDawn: valid(times.nauticalDawn),
    nauticalDusk: valid(times.nauticalDusk),
    astroDawn: valid(times.nightEnd),
    astroDusk: valid(times.night),
    goldenHourEnd: valid(times.goldenHourEnd),
    goldenHour: valid(times.goldenHour),
    dayLengthMs,
  };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function computeYear(year: number, lat: number, lng: number): YearRow[] {
  const rows: YearRow[] = [];
  for (let m = 1; m <= 12; m++) {
    const dim = daysInMonth(year, m);
    for (let d = 1; d <= dim; d++) {
      const c = computeDay(year, m, d, lat, lng);
      rows.push({
        month: m,
        day: d,
        weekday: new Date(Date.UTC(year, m - 1, d)).getUTCDay(),
        sunrise: c.sunrise,
        sunset: c.sunset,
        dayLengthMs: c.dayLengthMs,
        polar: c.polar,
      });
    }
  }
  return rows;
}

/* ---------------- 格式化 ---------------- */

const pad = (n: number): string => String(n).padStart(2, '0');

/** 按经度估算时区格式化（HH:MM 或 HH:MM:SS） */
export function fmtIn(d: Date | null | undefined, offsetHours: number, seconds = false): string {
  if (!d || isNaN(d.getTime())) return '—';
  const s = new Date(d.getTime() + offsetHours * MS_HOUR);
  const base = `${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}`;
  return seconds ? `${base}:${pad(s.getUTCSeconds())}` : base;
}

/** UTC 格式化 */
export function fmtUtc(d: Date | null | undefined, seconds = false): string {
  if (!d || isNaN(d.getTime())) return '—';
  const base = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return seconds ? `${base}:${pad(d.getUTCSeconds())}` : base;
}

/** 时长格式化 HH:MM:SS */
export function fmtDuration(ms: number): string {
  if (ms <= 0) return '00:00:00';
  if (ms >= MS_DAY) return '24:00:00';
  const h = Math.floor(ms / MS_HOUR);
  const m = Math.floor((ms % MS_HOUR) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** 估算时区标签，如 UTC+8 / UTC+7:46 */
export function fmtOffset(offsetHours: number): string {
  const sign = offsetHours < 0 ? '-' : '+';
  const abs = Math.abs(offsetHours);
  let h = Math.floor(abs);
  let m = Math.round((abs - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return `UTC${sign}${h}${m === 0 ? '' : ':' + pad(m)}`;
}

/** 事件在“当地（估算时区）”的一天中的小时数（0–24，用于绘图） */
export function hourOfDay(d: Date, offsetHours: number): number {
  const s = new Date(d.getTime() + offsetHours * MS_HOUR);
  const h = s.getUTCHours() + s.getUTCMinutes() / 60 + s.getUTCSeconds() / 3600;
  return ((h % 24) + 24) % 24;
}

export function fmtLat(lat: number): string {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
}

export function fmtLng(lng: number): string {
  return `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`;
}

export const round4 = (n: number): number => Math.round(n * 10000) / 10000;
