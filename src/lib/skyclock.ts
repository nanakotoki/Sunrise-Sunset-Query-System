import type { DayCalc, PolarKind } from './solar';

/**
 * 动态晨昏背景（纯逻辑，无 DOM / React 依赖，便于独立验证）。
 *
 * 两种时钟来源：
 * 1) 未搜索：本机本地时间 → 固定时间表（24 小时十段渐变，任务书参考基准）；
 * 2) 已搜索：查询地 IANA 时区的当前时间 + 当日真实日出日落 / 暮光事件 → 事件锚定渐变；
 *    极昼 → 恒为白天色；极夜 → 恒为夜色。
 *
 * 相邻关键帧之间做 RGB 线性插值，保证平滑过渡（组件侧再配合 CSS transition）。
 */

export type SkyPhaseId =
  | 'night'
  | 'preDawn'
  | 'sunrise'
  | 'morning'
  | 'forenoon'
  | 'noon'
  | 'afternoon'
  | 'dusk'
  | 'sunset'
  | 'evening'
  | 'astroDawn'
  | 'nauticalDawn'
  | 'civilDawn'
  | 'morningGolden'
  | 'eveningGolden'
  | 'civilDusk'
  | 'nauticalDusk'
  | 'astroDusk'
  | 'polarDay'
  | 'polarNight';

export interface SkyState {
  /** 顶部颜色（#rrggbb） */
  top: string;
  /** 底部颜色（#rrggbb） */
  bottom: string;
  /** 0 = 白天，1 = 深夜；用于星星图层透明度 */
  nightness: number;
  phase: SkyPhaseId;
}

/* ---------------- 颜色插值 ---------------- */

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hex2rgb(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgb2css(c: RGB): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

function mix(a: RGB, b: RGB, k: number): RGB {
  return { r: lerp(a.r, b.r, k), g: lerp(a.g, b.g, k), b: lerp(a.b, b.b, k) };
}

interface Keyframe {
  pos: number;
  top: RGB;
  bottom: RGB;
  night: number;
  phase: SkyPhaseId;
}

const kf = (pos: number, top: string, bottom: string, night: number, phase: SkyPhaseId): Keyframe => ({
  pos,
  top: hex2rgb(top),
  bottom: hex2rgb(bottom),
  night,
  phase,
});

function stateOf(f: Keyframe): SkyState {
  return { top: rgb2css(f.top), bottom: rgb2css(f.bottom), nightness: f.night, phase: f.phase };
}

/** 在有序关键帧中定位 x 并做 RGB 插值；越界时钳制到端点。 */
function interpolate(frames: Keyframe[], x: number): SkyState {
  if (frames.length === 0) return { top: '#060a1c', bottom: '#0a0f22', nightness: 1, phase: 'night' };
  if (x <= frames[0].pos) return stateOf(frames[0]);
  for (let i = 1; i < frames.length; i++) {
    const b = frames[i];
    if (x <= b.pos) {
      const a = frames[i - 1];
      const w = b.pos - a.pos;
      if (w < 1e-9) return stateOf(b);
      const k = (x - a.pos) / w;
      return {
        top: rgb2css(mix(a.top, b.top, k)),
        bottom: rgb2css(mix(a.bottom, b.bottom, k)),
        nightness: lerp(a.night, b.night, k),
        phase: k < 0.5 ? a.phase : b.phase,
      };
    }
  }
  return stateOf(frames[frames.length - 1]);
}

/* ---------------- 模式一：固定时间表（未搜索，跟随本机时间） ---------------- */

const CLOCK_KEYFRAMES: Keyframe[] = [
  kf(0, '#0a0e27', '#1a1f3a', 1, 'night'),
  kf(4.5, '#1a1f3a', '#4a3a6a', 0.8, 'preDawn'),
  kf(6, '#6a4a7a', '#ff8c42', 0.3, 'sunrise'),
  kf(7.5, '#ffb347', '#87ceeb', 0.08, 'morning'),
  kf(9, '#87ceeb', '#4a9fd8', 0, 'forenoon'),
  kf(11.5, '#4a9fd8', '#1e90ff', 0, 'noon'),
  kf(14, '#4a9fd8', '#87ceeb', 0, 'afternoon'),
  kf(16.5, '#ff8c42', '#d64570', 0.1, 'dusk'),
  kf(18.5, '#d64570', '#2a1f4a', 0.45, 'sunset'),
  kf(20, '#2a1f4a', '#0a0e27', 0.85, 'evening'),
  kf(24, '#0a0e27', '#1a1f3a', 1, 'night'),
];

/** 未搜索：按本机本地时刻（0–24）取渐变。 */
export function skyFromClockHour(hour: number): SkyState {
  const h = ((hour % 24) + 24) % 24;
  return interpolate(CLOCK_KEYFRAMES, h);
}

/* ---------------- 模式二：事件锚定（查询地真实日出日落） ---------------- */

const NIGHT_TOP = '#060a1c';
const NIGHT_BOTTOM = '#0a0f22';

const POLAR_DAY: SkyState = { top: '#5fb0e8', bottom: '#2b8fd9', nightness: 0, phase: 'polarDay' };
const POLAR_NIGHT: SkyState = { top: '#070b1f', bottom: '#0e1428', nightness: 1, phase: 'polarNight' };

export interface EventHours {
  /** 太阳正午（一天中的小时数，0–24） */
  noon: number;
  astroDawn?: number;
  nauticalDawn?: number;
  dawn?: number;
  sunrise?: number;
  goldenHourEnd?: number;
  goldenHour?: number;
  sunset?: number;
  dusk?: number;
  nauticalDusk?: number;
  astroDusk?: number;
}

/** 归一化到 [-12, 12)：相对太阳正午的小时数。 */
const wrap12 = (x: number): number => ((((x + 12) % 24) + 24) % 24) - 12;

/**
 * 已搜索：以当日真实太阳事件为锚点插值。
 * 事件缺失（高纬度部分暮光不存在）时跳过对应关键帧；
 * 极昼/极夜直接返回固定天色。
 */
export function skyFromEvents(hour: number, ev: EventHours, polar: PolarKind | null): SkyState {
  if (polar === 'day') return POLAR_DAY;
  if (polar === 'night') return POLAR_NIGHT;
  if (!ev || !Number.isFinite(ev.noon) || ev.sunrise == null || ev.sunset == null) {
    return skyFromClockHour(hour);
  }
  const n = ev.noon;
  const rel = wrap12(hour - n);
  const frames: Keyframe[] = [kf(-12, NIGHT_TOP, NIGHT_BOTTOM, 1, 'night')];
  // 晨间事件：距正午超过 12 小时（属于昨日）的丢弃
  const morning = (h: number | undefined, top: string, bottom: string, night: number, phase: SkyPhaseId) => {
    if (h == null || !Number.isFinite(h)) return;
    const d = (((n - h) % 24) + 24) % 24;
    if (d > 0 && d < 12) frames.push(kf(-d, top, bottom, night, phase));
  };
  // 傍晚事件：距正午超过 12 小时（属于次日）的丢弃
  const evening = (h: number | undefined, top: string, bottom: string, night: number, phase: SkyPhaseId) => {
    if (h == null || !Number.isFinite(h)) return;
    const d = (((h - n) % 24) + 24) % 24;
    if (d > 0 && d < 12) frames.push(kf(d, top, bottom, night, phase));
  };
  morning(ev.astroDawn, '#0c1229', '#1b2342', 0.92, 'astroDawn');
  morning(ev.nauticalDawn, '#161c3d', '#2c2a52', 0.78, 'nauticalDawn');
  morning(ev.dawn, '#2a2350', '#4a3a6a', 0.55, 'civilDawn');
  morning(ev.sunrise, '#5c3f70', '#ff8c42', 0.25, 'sunrise');
  morning(ev.goldenHourEnd, '#ffb347', '#87ceeb', 0.05, 'morningGolden');
  frames.push(kf(0, '#4a9fd8', '#1e90ff', 0, 'noon'));
  evening(ev.goldenHour, '#87ceeb', '#4a9fd8', 0, 'eveningGolden');
  evening(ev.sunset, '#ff8c42', '#d64570', 0.1, 'sunset');
  evening(ev.dusk, '#d64570', '#2a1f4a', 0.45, 'civilDusk');
  evening(ev.nauticalDusk, '#4a3a6a', '#1f2440', 0.78, 'nauticalDusk');
  evening(ev.astroDusk, '#1b2342', '#0c1229', 0.92, 'astroDusk');
  frames.push(kf(12, NIGHT_TOP, NIGHT_BOTTOM, 1, 'night'));
  frames.sort((a, b) => a.pos - b.pos);
  return interpolate(frames, rel);
}

/* ---------------- 时区工具 ---------------- */

const fmtCache = new Map<string, Intl.DateTimeFormat | null>();

function getFmt(tz: string): Intl.DateTimeFormat | null {
  let f = fmtCache.get(tz);
  if (f !== undefined) return f;
  try {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    f = null;
  }
  fmtCache.set(tz, f);
  return f;
}

export interface Hms {
  h: number;
  m: number;
  s: number;
}

/** 某一时刻在指定 IANA 时区的 时:分:秒；时区非法返回 null。 */
export function clockInTz(ms: number, tz: string): Hms | null {
  const f = getFmt(tz);
  if (!f) return null;
  let h = -1;
  let m = 0;
  let s = 0;
  for (const p of f.formatToParts(new Date(ms))) {
    if (p.type === 'hour') h = Number(p.value);
    else if (p.type === 'minute') m = Number(p.value);
    else if (p.type === 'second') s = Number(p.value);
  }
  if (h < 0) return null;
  if (h === 24) h = 0; // hour12:false 在部分环境返回 24:00
  return { h, m, s };
}

/** 某一时刻在指定 IANA 时区的一天中的小时数（0–24）。 */
export function hourOfDayIn(ms: number, tz: string): number {
  const c = clockInTz(ms, tz);
  if (!c) return NaN;
  return c.h + c.m / 60 + c.s / 3600;
}

/**
 * 把一日的太阳事件换算为“一天中的小时数”。
 * tz 为 null 时退回经度估算时区（每 15° = 1 小时）。
 */
export function eventHours(calc: DayCalc, tz: string | null): EventHours {
  const h = (d: Date | null | undefined): number | undefined => {
    if (!d) return undefined;
    const v = tz ? hourOfDayIn(d.getTime(), tz) : hourEst(d.getTime(), calc.offsetHours);
    return Number.isFinite(v) ? v : undefined;
  };
  return {
    noon: h(calc.solarNoon) ?? 12,
    astroDawn: h(calc.astroDawn),
    nauticalDawn: h(calc.nauticalDawn),
    dawn: h(calc.dawn),
    sunrise: h(calc.sunrise),
    goldenHourEnd: h(calc.goldenHourEnd),
    goldenHour: h(calc.goldenHour),
    sunset: h(calc.sunset),
    dusk: h(calc.dusk),
    nauticalDusk: h(calc.nauticalDusk),
    astroDusk: h(calc.astroDusk),
  };
}

/** 经度估算时区下的一天中的小时数（0–24）。 */
export function hourEst(ms: number, offsetHours: number): number {
  const d = new Date(ms + offsetHours * 3_600_000);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}
