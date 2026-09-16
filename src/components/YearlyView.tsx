import { useMemo, useState } from 'react';
import type { Lang, T } from '../i18n';
import { computeYear, daysInMonth, fmtDuration, fmtIn, hourOfDay } from '../lib/solar';
import { downloadCsv } from '../lib/csv';

interface Props {
  year: number;
  lat: number;
  lng: number;
  offsetHours: number;
  t: T;
  lang: Lang;
}

const MONTH_LABELS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 全年视图（E3）：SVG 折线图 + 可筛选数据表 + 全年 CSV 导出。 */
export default function YearlyView({ year, lat, lng, offsetHours, t, lang }: Props) {
  const rows = useMemo(() => computeYear(year, lat, lng), [year, lat, lng]);
  const [showDayLen, setShowDayLen] = useState(true);
  const [monthFilter, setMonthFilter] = useState<number | 0>(0);

  // --- 图数据 ---
  const W = 720;
  const H = 300;
  const PAD = { l: 42, r: 16, t: 16, b: 30 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const X = (monthFrac: number) => PAD.l + (monthFrac / 12) * iw;

  const { sunrisePath, sunsetPath, dayLenPath, dayLenArea } = useMemo(() => {
    const rise: string[] = [];
    const set: string[] = [];
    const dl: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const x = X(i / rows.length);
      if (r.sunrise) rise.push(`${x.toFixed(1)},${(PAD.t + ih - (hourOfDay(r.sunrise, offsetHours) / 24) * ih).toFixed(1)}`);
      if (r.sunset) set.push(`${x.toFixed(1)},${(PAD.t + ih - (hourOfDay(r.sunset, offsetHours) / 24) * ih).toFixed(1)}`);
      const hrs = r.dayLengthMs / 3_600_000;
      dl.push(`${x.toFixed(1)},${(PAD.t + ih - (hrs / 24) * ih).toFixed(1)}`);
    }
    const riseLine = 'M' + rise.join(' L');
    const setLine = 'M' + set.join(' L');
    const dlLine = 'M' + dl.join(' L');
    return {
      sunrisePath: riseLine,
      sunsetPath: setLine,
      dayLenPath: dlLine,
      dayLenArea: dlLine + ` L${X(1).toFixed(1)},${PAD.t + ih} L${X(0).toFixed(1)},${PAD.t + ih} Z`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, offsetHours]);

  const weekdays = lang === 'zh' ? WEEKDAYS_ZH : WEEKDAYS_EN;
  const monthLabels = lang === 'zh' ? MONTH_LABELS_ZH : Array.from({ length: 12 }, (_, i) => `${i + 1}M`);

  const filtered = monthFilter === 0 ? rows : rows.filter((r) => r.month === monthFilter);

  function exportCsv() {
    const headers = [
      lang === 'zh' ? '日期' : 'Date',
      lang === 'zh' ? '日出(当地)' : 'Sunrise(local)',
      lang === 'zh' ? '日落(当地)' : 'Sunset(local)',
      lang === 'zh' ? '昼长' : 'Day length',
      lang === 'zh' ? '备注' : 'Note',
    ];
    const data = rows.map((r) => {
      const note =
        r.polar === 'day' ? (lang === 'zh' ? '极昼' : 'Polar day') : r.polar === 'night' ? (lang === 'zh' ? '极夜' : 'Polar night') : '';
      return [
        `${year}-${String(r.month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`,
        r.sunrise ? fmtIn(r.sunrise, offsetHours) : '',
        r.sunset ? fmtIn(r.sunset, offsetHours) : '',
        fmtDuration(r.dayLengthMs),
        note,
      ];
    });
    downloadCsv(`suntime-${lat}_${lng}-${year}.csv`, headers, data);
  }

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-xl shadow-black/20 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">
          {t('yearlyView')} · {year}
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={showDayLen}
              onChange={(e) => setShowDayLen(e.target.checked)}
              className="h-3.5 w-3.5 accent-amber-400"
            />
            {t('showDayLength')}
          </label>
          <button
            onClick={exportCsv}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 transition hover:border-sky-400 hover:text-sky-300"
          >
            ⬇ {t('exportYearCsv')}
          </button>
        </div>
      </header>

      {/* SVG 折线图 */}
      <div className="mb-2 overflow-x-auto rounded-xl border border-slate-700/60 bg-slate-950/60 p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img" aria-label={t('yearlyChart')}>
          {/* 网格 */}
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => {
            const y = PAD.t + ih - (h / 24) * ih;
            return (
              <g key={h}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#334155" strokeWidth={h === 12 ? 1.2 : 0.6} strokeDasharray={h === 12 ? '' : '3,4'} />
                <text x={PAD.l - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="#64748b">
                  {h === 24 ? '24' : String(h)}
                </text>
              </g>
            );
          })}
          {monthLabels.map((m, i) => (
            <text key={i} x={X(i + 0.5)} y={H - 10} textAnchor="middle" fontSize="10" fill="#64748b">
              {m}
            </text>
          ))}

          {/* 昼长面积 */}
          {showDayLen && (
            <>
              <path d={dayLenArea} fill="rgba(251,191,36,0.10)" />
              <path d={dayLenPath} fill="none" stroke="#fbbf24" strokeWidth={1.2} strokeDasharray="4,3" opacity={0.9} />
            </>
          )}

          {/* 日出 / 日落 */}
          <path d={sunrisePath} fill="none" stroke="#38bdf8" strokeWidth={1.8} />
          <path d={sunsetPath} fill="none" stroke="#fb923c" strokeWidth={1.8} />

          {/* 图例 */}
          <g fontSize="10">
            <line x1={PAD.l + 8} y1={PAD.t + 8} x2={PAD.l + 26} y2={PAD.t + 8} stroke="#38bdf8" strokeWidth={1.8} />
            <text x={PAD.l + 30} y={PAD.t + 11} fill="#94a3b8">
              {t('chartSunrise')}
            </text>
            <line x1={PAD.l + 78} y1={PAD.t + 8} x2={PAD.l + 96} y2={PAD.l === 0 ? PAD.t + 8 : PAD.t + 8} stroke="#fb923c" strokeWidth={1.8} />
            <text x={PAD.l + 100} y={PAD.t + 11} fill="#94a3b8">
              {t('chartSunset')}
            </text>
            {showDayLen && (
              <>
                <line x1={PAD.l + 148} y1={PAD.t + 8} x2={PAD.l + 166} y2={PAD.t + 8} stroke="#fbbf24" strokeWidth={1.2} strokeDasharray="4,3" />
                <text x={PAD.l + 170} y={PAD.t + 11} fill="#94a3b8">
                  {t('dayLenCurve')}
                </text>
              </>
            )}
          </g>
        </svg>
        <p className="px-2 py-1 text-xs text-slate-500">{t('chartHint')}</p>
      </div>

      {/* 表格 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-300">{t('yearlyTable')}</h3>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(Number(e.target.value))}
          className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
        >
          <option value={0}>{lang === 'zh' ? '全部月份' : 'All months'}</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {monthLabels[i]}
            </option>
          ))}
        </select>
      </div>
      <div className="max-h-80 overflow-auto rounded-xl border border-slate-700/60">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{lang === 'zh' ? '日期' : 'Date'}</th>
              <th className="px-3 py-2 text-left font-medium">{lang === 'zh' ? '星期' : 'Weekday'}</th>
              <th className="px-3 py-2 text-right font-medium">{t('sunrise')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('sunset')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('dayLength')}</th>
              <th className="px-3 py-2 text-left font-medium">{lang === 'zh' ? '备注' : 'Note'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40 font-mono text-xs tabular-nums text-slate-300">
            {filtered.map((r) => (
              <tr key={`${r.month}-${r.day}`} className="hover:bg-slate-800/50">
                <td className="whitespace-nowrap px-3 py-1.5">
                  {r.month}/{r.day}
                </td>
                <td className="px-3 py-1.5 text-slate-500">{weekdays[r.weekday]}</td>
                <td className="px-3 py-1.5 text-right text-sky-300">{r.sunrise ? fmtIn(r.sunrise, offsetHours) : '—'}</td>
                <td className="px-3 py-1.5 text-right text-orange-300">{r.sunset ? fmtIn(r.sunset, offsetHours) : '—'}</td>
                <td className="px-3 py-1.5 text-right text-amber-200">{fmtDuration(r.dayLengthMs)}</td>
                <td className="px-3 py-1.5 text-slate-400">
                  {r.polar === 'day' ? (lang === 'zh' ? '☀️ 极昼' : '☀️ Polar day') : r.polar === 'night' ? (lang === 'zh' ? '🌙 极夜' : '🌙 Polar night') : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {lang === 'zh' ? '共' : ''} {filtered.length} {lang === 'zh' ? '天' : 'days'}
        {monthFilter === 0 ? '' : ` · ${daysInMonth(year, monthFilter)}${lang === 'zh' ? '天' : 'd'}`}
      </p>
    </section>
  );
}
