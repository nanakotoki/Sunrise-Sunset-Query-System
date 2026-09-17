import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapPicker from './components/MapPicker';
import ResultCard from './components/ResultCard';
import YearlyView from './components/YearlyView';
import SkyBackground from './components/SkyBackground';
import { makeT, type Lang } from './i18n';
import { searchPlaces, type Place } from './lib/geocode';
import { locateByIp } from './lib/iplocate';
import { downloadCsv } from './lib/csv';
import { computeDay, daysInMonth, fmtDuration, fmtIn, fmtLat, fmtLng, fmtOffset, fmtUtc } from './lib/solar';
import tzlookup from 'tz-lookup';

const PRESETS = [
  { name: '北京', lat: 39.9042, lng: 116.4074 },
  { name: '上海', lat: 31.2304, lng: 121.4737 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: 'Reykjavík', lat: 64.1466, lng: -21.9426 },
];

interface FormState {
  latText: string;
  lngText: string;
  year: number;
  month: number;
  day: number;
}

const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function localYMD(): { y: number; m: number; d: number } {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

export default function App() {
  const today = localYMD();
  const [lang, setLang] = useState<Lang>('zh');
  const t = useMemo(() => makeT(lang), [lang]);

  const [form, setForm] = useState<FormState>({
    latText: '39.9042',
    lngText: '116.4074',
    year: today.y,
    month: today.m,
    day: today.d,
  });
  const [errors, setErrors] = useState<{ lat?: string; lng?: string; date?: string }>({});
  const [result, setResult] = useState<ReturnType<typeof computeDay> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [locating, setLocating] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 动态背景：查询地点的 IANA 时区（搜索后生效）；解析失败退回估算时区
  const siteTz = useMemo(() => {
    if (!result) return null;
    try {
      return tzlookup(result.lat, result.lng);
    } catch {
      return null;
    }
  }, [result]);

  // 首次挂载即查询默认值
  useEffect(() => {
    runQuery(form.latText, form.lngText, form.year, form.month, form.day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPlace(lat: number, lng: number) {
    const latText = String(Math.round(lat * 10000) / 10000);
    const lngText = String(Math.round(lng * 10000) / 10000);
    setForm((f) => ({ ...f, latText, lngText }));
    runQuery(latText, lngText, form.year, form.month, form.day);
  }

  function runQuery(latText: string, lngText: string, year: number, month: number, day: number) {
    const lat = Number.parseFloat(latText);
    const lng = Number.parseFloat(lngText);
    const errs: typeof errors = {};
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) errs.lat = Number.isFinite(lat) ? t('latRangeErr') : t('numberErr');
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) errs.lng = Number.isFinite(lng) ? t('lngRangeErr') : t('numberErr');
    if (year < 1900 || year > 2100) errs.date = t('yearRangeErr');
    if (day < 1 || day > daysInMonth(year, month)) errs.date = errs.date || t('dateErr');
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setResult(null);
      return;
    }
    setResult(computeDay(year, month, day, lat, lng));
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runQuery(form.latText, form.lngText, form.year, form.month, form.day);
  };

  // 双保险：即使某些环境 submit 事件被拦截，直接 onClick 也能查询
  const onSubmit2 = (e: React.MouseEvent) => {
    e.preventDefault();
    runQuery(form.latText, form.lngText, form.year, form.month, form.day);
  };

  const shiftDate = (delta: number) => {
    const base = new Date(Date.UTC(form.year, form.month - 1, form.day + delta));
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth() + 1;
    const d = base.getUTCDate();
    setForm((f) => ({ ...f, year: y, month: m, day: d }));
    runQuery(form.latText, form.lngText, y, m, d);
  };

  const setToday = () => {
    const n = localYMD();
    setForm((f) => ({ ...f, year: n.y, month: n.m, day: n.d }));
    runQuery(form.latText, form.lngText, n.y, n.m, n.d);
  };

  const onSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setSearching(true);
    setSearchError('');
    setPlaces([]);
    try {
      const found = await searchPlaces(q, lang, ac.signal);
      if (found.length === 0) {
        setSearchError(t('noResults'));
      } else {
        setPlaces(found);
        // 自动应用第一个结果：搜索了就直接查，无需再点下拉项；下拉仍保留供更换
        setPlace(found[0].lat, found[0].lng);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setSearchError(t('searchFailed'));
    } finally {
      if (!ac.signal.aborted) setSearching(false);
    }
  }, [searchQuery, lang, t]);

  // IP 网络定位：多源回退（ipwho.is → ip.sb → ipapi.co），不需要权限，城市级精度
  const onLocateIp = useCallback(async () => {
    setLocating(true);
    setSearchError('');
    try {
      const loc = await locateByIp();
      const place = [loc.city, loc.region, loc.country].filter(Boolean).join(', ');
      if (place) setSearchQuery(place);
      setPlace(loc.lat, loc.lng);
    } catch {
      setSearchError(t('locateIpFailed'));
    } finally {
      setLocating(false);
    }
  }, [t]);

  const onLocate = () => {
    if (!navigator.geolocation) {
      setSearchError(t('locateFailed'));
      return;
    }
    // file:// / http:// 下浏览器会静默禁用定位，提前给出可行动的提示
    if (location.protocol === 'file:') {
      setSearchError(t('locateFileHint'));
      return;
    }
    setLocating(true);
    setSearchError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPlace(clampNum(pos.coords.latitude, -90, 90), clampNum(pos.coords.longitude, -180, 180));
      },
      (err) => {
        setLocating(false);
        let msg: string;
        if (err.code === err.PERMISSION_DENIED) {
          msg = t('locateDenied');
        } else if (err.code === err.POSITION_UNAVAILABLE || err.code === err.TIMEOUT) {
          msg = t('locateUnavailable');
        } else {
          msg = t('locateFailed');
        }
        // GPS 失败不终点：自动降级 IP 定位，城市级精度也能查日出日落
        setSearchError(msg + ' ' + t('locateFallbackIp'));
        onLocateIp();
      },
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false },
    );
  };

  async function copyResult() {
    if (!result) return;
    const off = result.offsetHours;
    const lines = [
      lang === 'zh' ? 'SunTime Explorer 查询结果' : 'SunTime Explorer results',
      `${lang === 'zh' ? '坐标' : 'Location'}: ${fmtLat(result.lat)}, ${fmtLng(result.lng)} (${fmtOffset(off)})`,
      `${lang === 'zh' ? '日期' : 'Date'}: ${result.year}-${String(result.month).padStart(2, '0')}-${String(result.day).padStart(2, '0')}`,
      `${t('sunrise')}: ${fmtIn(result.sunrise, off)} (UTC ${fmtUtc(result.sunrise)})`,
      `${t('sunset')}: ${fmtIn(result.sunset, off)} (UTC ${fmtUtc(result.sunset)})`,
      `${t('solarNoon')}: ${fmtIn(result.solarNoon, off, true)} (UTC ${fmtUtc(result.solarNoon, true)})`,
      `${t('dayLength')}: ${fmtDuration(result.dayLengthMs)}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setSearchError(t('copyFailed'));
    }
  }

  function exportCsv() {
    if (!result) return;
    const off = result.offsetHours;
    const polar = result.polar === 'day' ? (lang === 'zh' ? '极昼' : 'Polar day') : result.polar === 'night' ? (lang === 'zh' ? '极夜' : 'Polar night') : '';
    const headers = [
      lang === 'zh' ? '项目' : 'Item',
      `${t('localTime')} (${fmtOffset(off)})`,
      t('utcTime'),
    ];
    const rows: (string | number)[][] = [
      [t('sunrise'), fmtIn(result.sunrise, off), fmtUtc(result.sunrise)],
      [t('sunset'), fmtIn(result.sunset, off), fmtUtc(result.sunset)],
      [t('solarNoon'), fmtIn(result.solarNoon, off, true), fmtUtc(result.solarNoon, true)],
      [t('solarMidnight'), fmtIn(result.solarMidnight, off, true), fmtUtc(result.solarMidnight, true)],
      [t('dayLength'), fmtDuration(result.dayLengthMs), ''],
      [t('goldenHourEnd'), fmtIn(result.goldenHourEnd, off), fmtUtc(result.goldenHourEnd)],
      [t('goldenHour'), fmtIn(result.goldenHour, off), fmtUtc(result.goldenHour)],
      [t('civilDawn'), fmtIn(result.dawn, off), fmtUtc(result.dawn)],
      [t('civilDusk'), fmtIn(result.dusk, off), fmtUtc(result.dusk)],
      [t('nauticalDawn'), fmtIn(result.nauticalDawn, off), fmtUtc(result.nauticalDawn)],
      [t('nauticalDusk'), fmtIn(result.nauticalDusk, off), fmtUtc(result.nauticalDusk)],
      [t('astroDawn'), fmtIn(result.astroDawn, off), fmtUtc(result.astroDawn)],
      [t('astroDusk'), fmtIn(result.astroDusk, off), fmtUtc(result.astroDusk)],
      [t('noonAltitude'), `${result.noonAltitude.toFixed(1)}°`, ''],
      ...(polar ? [[lang === 'zh' ? '备注' : 'Note', polar, '']] : []),
    ];
    downloadCsv(
      `suntime-${result.lat}_${result.lng}-${result.year}${String(result.month).padStart(2, '0')}${String(result.day).padStart(2, '0')}.csv`,
      headers,
      rows,
    );
  }

  const latNum = Number.parseFloat(form.latText);
  const lngNum = Number.parseFloat(form.lngText);
  const mapReady = Number.isFinite(latNum) && Number.isFinite(lngNum);

  return (
    <div className="min-h-screen text-slate-100">
      <SkyBackground calc={result} tz={siteTz} t={t} />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              🌅 {t('appName')}
            </h1>
            <p className="mt-1 text-sm text-slate-400">{t('tagline')}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">{t('language')}:</span>
            {(['zh', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-lg px-2.5 py-1 transition ${
                  lang === l ? 'bg-sky-500 font-semibold text-slate-950' : 'border border-slate-600 text-slate-300 hover:border-sky-400'
                }`}
              >
                {l === 'zh' ? '中文' : 'EN'}
              </button>
            ))}
          </div>
        </header>

        {/* 查询表单 */}
        <form onSubmit={onSubmit} className="mb-6 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-xl shadow-black/20 backdrop-blur-md sm:p-6">
          {/* 地名搜索 */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('placeSearch')}</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onSearch())}
                placeholder={t('placePlaceholder')}
                className="w-full flex-1 rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
              />
              <button
                type="button"
                onClick={onSearch}
                disabled={searching}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
              >
                {searching ? t('searching') : `🔍 ${t('searchBtn')}`}
              </button>
              <button
                type="button"
                onClick={onLocate}
                disabled={locating}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-sky-400 hover:text-sky-300 disabled:opacity-50"
              >
                {locating ? t('locating') : `📍 ${t('myLocation')}`}
              </button>
              <button
                type="button"
                onClick={onLocateIp}
                disabled={locating}
                title={t('locateIpTitle')}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-sky-400 hover:text-sky-300 disabled:opacity-50"
              >
                {locating ? t('locating') : `📡 ${t('myLocationIp')}`}
              </button>
            </div>
            {searchError && <p className="mt-1.5 text-xs text-red-400">{searchError}</p>}
            {places.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 text-xs text-slate-500">{t('searchPickHint')}</p>
                <ul className="divide-y divide-slate-700/60 rounded-xl border border-slate-700/60 bg-slate-800/60">
                {places.map((p, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        setPlace(p.lat, p.lng);
                        setPlaces([]);
                        setSearchQuery('');
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-slate-700/50 hover:text-white"
                    >
                      📌 {p.name} <span className="font-mono text-slate-500">({p.lat.toFixed(2)}, {p.lng.toFixed(2)})</span>
                    </button>
                  </li>
                ))}
                </ul>
              </div>
            )}
          </div>

          {/* 经纬度 + 日期 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lat" className="mb-1.5 block text-sm font-medium text-slate-300">
                {t('lat')} <span className="font-mono text-xs text-slate-500">({t('latPh')})</span>
              </label>
              <input
                id="lat"
                type="number"
                step="0.0001"
                value={form.latText}
                onChange={(e) => setForm((f) => ({ ...f, latText: e.target.value }))}
                className={`w-full rounded-xl border bg-slate-800/80 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 ${
                  errors.lat ? 'border-red-500 focus:ring-red-400/40' : 'border-slate-600 focus:border-sky-400 focus:ring-sky-400/30'
                }`}
              />
              {errors.lat && <p className="mt-1 text-xs text-red-400">{errors.lat}</p>}
            </div>
            <div>
              <label htmlFor="lng" className="mb-1.5 block text-sm font-medium text-slate-300">
                {t('lng')} <span className="font-mono text-xs text-slate-500">({t('lngPh')})</span>
              </label>
              <input
                id="lng"
                type="number"
                step="0.0001"
                value={form.lngText}
                onChange={(e) => setForm((f) => ({ ...f, lngText: e.target.value }))}
                className={`w-full rounded-xl border bg-slate-800/80 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 ${
                  errors.lng ? 'border-red-500 focus:ring-red-400/40' : 'border-slate-600 focus:border-sky-400 focus:ring-sky-400/30'
                }`}
              />
              {errors.lng && <p className="mt-1 text-xs text-red-400">{errors.lng}</p>}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="year" className="mb-1.5 block text-sm font-medium text-slate-300">
                {t('date')}
              </label>
              <input
                id="year"
                type="number"
                min={1900}
                max={2100}
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: clampNum(Number(e.target.value) || 0, 1, 9999) }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 font-mono text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
              />
            </div>
            <div>
              <label htmlFor="month" className="mb-1.5 block text-sm font-medium text-slate-300">
                {t('month')}
              </label>
              <select
                id="month"
                value={form.month}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setForm((f) => ({ ...f, month: m, day: Math.min(f.day, daysInMonth(f.year, m)) }));
                }}
                className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="day" className="mb-1.5 block text-sm font-medium text-slate-300">
                {t('day')}
              </label>
              <select
                id="day"
                value={form.day}
                onChange={(e) => setForm((f) => ({ ...f, day: Number(e.target.value) }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
             >
                {Array.from({ length: daysInMonth(form.year, form.month) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                onClick={onSubmit2}
                className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-orange-500/20 transition hover:from-amber-300 hover:to-orange-400 active:scale-95"
              >
                ☀️ {t('query')}
              </button>
            </div>
          </div>
          {errors.date && <p className="mt-2 text-xs text-red-400">{errors.date}</p>}

          {/* 快捷日期 + 常用地点 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{t('quickNav')}:</span>
            <button type="button" onClick={setToday} className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 transition hover:border-sky-400 hover:text-sky-300">
              {t('today')}
            </button>
            <button type="button" onClick={() => shiftDate(-1)} className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 transition hover:border-sky-400 hover:text-sky-300">
              ← {t('yesterday')}
            </button>
            <button type="button" onClick={() => shiftDate(1)} className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 transition hover:border-sky-400 hover:text-sky-300">
              {t('tomorrow')} →
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{t('presets')}:</span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setPlace(p.lat, p.lng)}
                className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
              >
                {p.name}
              </button>
            ))}
          </div>
        </form>

        {/* 结果 */}
        {result && (
          <div className="space-y-6">
            <ResultCard calc={result} t={t} lang={lang} tz={siteTz} />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={copyResult}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-sky-400 hover:text-sky-300"
              >
                {copied ? `✓ ${t('copied')}` : `📋 ${t('copyText')}`}
              </button>
              <button
                onClick={exportCsv}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-sky-400 hover:text-sky-300"
              >
                ⬇ {t('exportCsv')}
              </button>
            </div>
            <YearlyView year={form.year} lat={result.lat} lng={result.lng} offsetHours={result.offsetHours} t={t} lang={lang} />
          </div>
        )}

        {/* 地图 */}
        {mapReady && (
          <div className="mt-6">
            <MapPicker lat={latNum} lng={lngNum} onPick={setPlace} t={t} />
          </div>
        )}

        <footer className="mt-10 border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
          {t('footer')} ·{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-400"
          >
            Map data © OpenStreetMap
          </a>
        </footer>
      </div>
    </div>
  );
}
