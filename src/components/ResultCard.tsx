import type { DayCalc } from '../lib/solar';
import { fmtDuration, fmtIn, fmtOffset, fmtUtc } from '../lib/solar';
import type { Lang, T } from '../i18n';

interface Props {
  calc: DayCalc;
  t: T;
  lang: Lang;
}

function Row({
  label,
  local,
  utc,
  accent,
}: {
  label: string;
  local: string;
  utc: string;
  accent?: string;
}) {
  return (
    <tr className="border-b border-slate-700/40 last:border-0">
      <td className="py-2.5 pr-3 text-sm text-slate-400">{label}</td>
      <td className={`py-2.5 pr-3 text-right font-mono text-sm tabular-nums ${accent ?? 'text-slate-100'}`}>
        {local}
      </td>
      <td className="py-2.5 text-right font-mono text-xs tabular-nums text-slate-500">{utc}</td>
    </tr>
  );
}

/** 单日查询结果卡片（F3–F6, E4）。 */
export default function ResultCard({ calc, t, lang }: Props) {
  const off = calc.offsetHours;
  const dateStr =
    lang === 'zh'
      ? `${calc.year} 年 ${calc.month} 月 ${calc.day} 日`
      : `${calc.year}-${String(calc.month).padStart(2, '0')}-${String(calc.day).padStart(2, '0')}`;

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-xl shadow-black/20 sm:p-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">
          {t('resultsFor')} · {dateStr}
        </h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
          {Math.abs(calc.lat).toFixed(4)}°{calc.lat >= 0 ? 'N' : 'S'},&nbsp;
          {Math.abs(calc.lng).toFixed(4)}°{calc.lng >= 0 ? 'E' : 'W'}&nbsp;·&nbsp;
          {t('estTz')} {fmtOffset(off)}
        </span>
      </header>

      {calc.polar === 'day' && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="font-semibold text-amber-300">☀️ {t('polarDayTitle')}</p>
          <p className="mt-1 text-sm text-amber-200/80">{t('polarDayDesc')}</p>
        </div>
      )}
      {calc.polar === 'night' && (
        <div className="mb-4 rounded-xl border border-indigo-400/40 bg-indigo-500/10 p-4">
          <p className="font-semibold text-indigo-300">🌙 {t('polarNightTitle')}</p>
          <p className="mt-1 text-sm text-indigo-200/80">{t('polarNightDesc')}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-transparent p-4">
          <p className="text-xs uppercase tracking-wide text-sky-300/80">🌅 {t('sunrise')}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-sky-200">{fmtIn(calc.sunrise, off)}</p>
          <p className="mt-1 font-mono text-xs text-slate-500">UTC {fmtUtc(calc.sunrise)}</p>
        </div>
        <div className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent p-4">
          <p className="text-xs uppercase tracking-wide text-orange-300/80">🌇 {t('sunset')}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-orange-200">{fmtIn(calc.sunset, off)}</p>
          <p className="mt-1 font-mono text-xs text-slate-500">UTC {fmtUtc(calc.sunset)}</p>
          </div>
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
          <p className="text-xs uppercase tracking-wide text-amber-300/80">☀️ {t('dayLength')}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-200">{fmtDuration(calc.dayLengthMs)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {t('noonAltitude')} {calc.noonAltitude.toFixed(1)}°
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-300">{t('sunEvent')}</h3>
          <table className="w-full">
            <tbody>
              <Row label={t('solarNoon')} local={fmtIn(calc.solarNoon, off, true)} utc={fmtUtc(calc.solarNoon, true)} />
              <Row
                label={t('solarMidnight')}
                local={fmtIn(calc.solarMidnight, off, true)}
                utc={fmtUtc(calc.solarMidnight, true)}
              />
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-300">{t('twilight')}</h3>
          <table className="w-full">
            <tbody>
              <Row label={t('goldenHourEnd')} local={fmtIn(calc.goldenHourEnd, off)} utc={fmtUtc(calc.goldenHourEnd)} />
              <Row label={t('goldenHour')} local={fmtIn(calc.goldenHour, off)} utc={fmtUtc(calc.goldenHour)} />
              <Row label={t('civilDawn')} local={fmtIn(calc.dawn, off)} utc={fmtUtc(calc.dawn)} />
              <Row label={t('civilDusk')} local={fmtIn(calc.dusk, off)} utc={fmtUtc(calc.dusk)} />
              <Row label={t('nauticalDawn')} local={fmtIn(calc.nauticalDawn, off)} utc={fmtUtc(calc.nauticalDawn)} />
              <Row label={t('nauticalDusk')} local={fmtIn(calc.nauticalDusk, off)} utc={fmtUtc(calc.nauticalDusk)} />
              <Row label={t('astroDawn')} local={fmtIn(calc.astroDawn, off)} utc={fmtUtc(calc.astroDawn)} />
              <Row label={t('astroDusk')} local={fmtIn(calc.astroDusk, off)} utc={fmtUtc(calc.astroDusk)} />
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
