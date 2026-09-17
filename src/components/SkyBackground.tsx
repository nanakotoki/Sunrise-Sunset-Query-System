import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { T } from '../i18n';
import type { DayCalc } from '../lib/solar';
import { eventHours, hourOfDayIn, hourEst, skyFromClockHour, skyFromEvents, type SkyState } from '../lib/skyclock';

interface Props {
  calc: DayCalc | null;
  tz: string | null;
  t: T;
}

interface SkyPoint {
  x: number;
  y: number;
  size: number;
  delay: number;
}

/** 星星（固定伪随机点，避免每秒重排）。 */
function makeStars(): SkyPoint[] {
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: 90 }, () => ({
    x: rnd() * 100,
    y: rnd() * 62,
    size: 1 + rnd() * 1.8,
    delay: rnd() * 4,
  }));
}

const pad = (n: number) => String(n).padStart(2, '0');
const clockLabel = (h: number) => `${pad(Math.floor(h))}:${pad(Math.floor((h % 1) * 60))}:${pad(Math.floor(((h * 60) % 1) * 60))}`;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * 动态晨昏背景。
 * - calc === null → 本机本地时间（固定时间表）
 * - calc 非 null → 查询地 IANA 时区当前时间 + 当日真实日出日落事件锚定渐变
 *   （极昼恒为白天色，极夜恒为夜色；时区解析失败退回经度估算时区）
 *
 * 每秒刷新取色；颜色经 @property 注册（--sky-top/--sky-bottom）后可用 CSS transition
 * 平滑插值，不支持 @property 的浏览器直接跳变到新值（相邻秒色差极小，视觉仍平滑）。
 * 时间锁定开关：暂停实时刷新，拖动滑块预览任意时刻的天色。
 */
export default function SkyBackground({ calc, tz, t }: Props) {
  const stars = useMemo(makeStars, []);
  const [now, setNow] = useState(() => Date.now());
  const [locked, setLocked] = useState(false);
  const [lockHour, setLockHour] = useState(12);
  const [skyOff, setSkyOff] = useState(false);

  // 每秒刷新一次时钟（仅一个小 state，性能开销可忽略）
  useEffect(() => {
    if (locked || skyOff) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked, skyOff]);

  // 用于取色与显示的“当地小时”（锁定时为滑块值）
  const hour = useMemo(() => {
    if (skyOff) return 0;
    if (locked) return lockHour;
    if (calc && tz) {
      const h = hourOfDayIn(now, tz);
      if (Number.isFinite(h)) return h;
    }
    if (calc) return hourEst(now, calc.offsetHours);
    return hourLocal(now);
  }, [now, calc, tz, locked, lockHour, skyOff]);

  const sky: SkyState = useMemo(() => {
    if (skyOff) return { top: '#050816', bottom: '#0b1120', nightness: 1, phase: 'night' };
    if (calc) {
      const eh = eventHours(calc, tz);
      return skyFromEvents(hour, eh, calc.polar);
    }
    return skyFromClockHour(hour);
  }, [hour, calc, tz, skyOff]);

  const gradStyle = {
    '--sky-top': sky.top,
    '--sky-bottom': sky.bottom,
  } as CSSProperties;

  const sunOpacity = skyOff ? 0 : clamp01(1 - sky.nightness * 3);
  const moonOpacity = skyOff ? 0 : clamp01((sky.nightness - 0.4) * 2.5);

  return (
    <>
      {/* 背景层：不拦截任何交互 */}
      <div className="sky-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={gradStyle}>
        {stars.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              opacity: sky.nightness,
              transition: 'opacity 2.5s ease',
              animation: `twinkle ${3 + s.delay}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
        {/* 太阳辉光（白天淡入） */}
        <div
          className="absolute"
          style={{
            right: '10%',
            top: '7%',
            width: 110,
            height: 110,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,236,120,0.85) 0%, rgba(255,180,50,0.3) 55%, transparent 75%)',
            opacity: sunOpacity,
            transition: 'opacity 2.5s ease',
          }}
        />
        {/* 月亮（夜晚淡入） */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            right: '11%',
            top: '8%',
            width: 64,
            height: 64,
            opacity: moonOpacity,
            transition: 'opacity 2.5s ease',
          }}
        >
          <span style={{ fontSize: 36 }}>🌙</span>
        </div>
      </div>

      {/* 天色控制面板（右下角悬浮，窄屏自动折叠，不遮挡表单） */}
      <div className="fixed right-3 bottom-3 z-40 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-600/40 bg-slate-900/80 px-3 py-2 text-xs text-slate-200 shadow-lg backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setSkyOff((v) => !v)}
            className="rounded-lg px-2 py-1 transition hover:bg-slate-700/60"
            title={t('skyOffTitle')}
          >
            {skyOff ? `🌤️ ${t('skyOn')}` : `🌃 ${t('skyOff')}`}
          </button>
          {locked && !skyOff && (
            <>
              <span className="font-mono text-slate-300">{clockLabel(hour)}</span>
              <input
                type="range"
                min={0}
                max={24}
                step={0.1}
                value={lockHour}
                onChange={(e) => setLockHour(Number(e.target.value))}
                className="w-28 accent-amber-400"
                aria-label={t('skyLockSlider')}
              />
            </>
          )}
          {skyOff && <span className="text-slate-400">{t('skyOffLabel')}</span>}
          <button
            type="button"
            disabled={skyOff}
            onClick={() => {
              setLocked((v) => !v);
              if (!locked) setLockHour(Math.max(0, Math.min(24, hour)));
            }}
            className="rounded-lg px-2 py-1 transition hover:bg-slate-700/60 disabled:opacity-40"
            title={t('skyLockTitle')}
          >
            {locked ? `🔓 ${t('skyUnlock')}` : `🔒 ${t('skyLock')}`}
          </button>
        </div>
      </div>
    </>
  );
}

function hourLocal(ms: number): number {
  const d = new Date(ms);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}
