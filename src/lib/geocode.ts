/**
 * 地名搜索：离线城市库（内嵌，零网络）+ 在线多源回退。
 *
 * 在线源（全部免费、无需 key）：
 *   1. Open-Meteo Geocoding API — 国内可达性较好，支持中英文查询
 *   2. Photon (komoot)          — OSM 数据，备用
 *   3. Nominatim (OSM)          — 原始方案，最后回退
 *
 * 策略：
 *   - 本地库命中（精确/前缀/包含，中英文别名）→ 直接返回，不联网
 *   - 未命中 → 在线依次尝试，任一成功即返回
 *   - 全部失败/超时 → 返回本地模糊匹配结果并标注 source: 'offline'
 */

import { OFFLINE_CITIES } from './city-db';

export interface Place {
  name: string;
  lat: number;
  lng: number;
  source?: 'offline' | 'open-meteo' | 'photon' | 'nominatim';
}

interface OnlineResult {
  places: Place[];
  ok: boolean;
}

const TIMEOUT_MS = 6000;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[市区县旗盟州]$/, '');
}

/** 本地城市匹配：精确 > 前缀 > 包含，中英文别名都支持。 */
export function searchOffline(query: string): Place[] {
  const q = normalize(query);
  if (!q) return [];
  const exact: Place[] = [];
  const prefix: Place[] = [];
  const includes: Place[] = [];
  for (const c of OFFLINE_CITIES) {
    for (const alias of c.aliases) {
      const a = normalize(alias);
      if (a === q) {
        exact.push({ name: c.zh, lat: c.lat, lng: c.lng, source: 'offline' });
        break;
      } else if (a.startsWith(q) || q.startsWith(a)) {
        prefix.push({ name: c.zh, lat: c.lat, lng: c.lng, source: 'offline' });
        break;
      } else if (a.includes(q) || q.includes(a)) {
        includes.push({ name: c.zh, lat: c.lat, lng: c.lng, source: 'offline' });
        break;
      }
    }
  }
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const p of [...exact, ...prefix, ...includes]) {
    const key = `${p.lat},${p.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= 8) break;
  }
  return out;
}

export async function searchPlaces(
  query: string,
  lang: 'zh' | 'en',
  signal?: AbortSignal,
): Promise<Place[]> {
  const offline = searchOffline(query);
  const q = query.trim();
  if (!q) return [];

  // 本地精确命中 → 不联网
  if (offline.length > 0 && offline[0].name === query.trim()) {
    return offline;
  }

  const online = await searchOnline(q, lang, signal);
  if (online.ok && online.places.length > 0) {
    return online.places;
  }
  // 全部在线源失败 → 返回本地模糊结果（可能为空）
  return offline;
}

async function searchOnline(q: string, lang: 'zh' | 'en', signal?: AbortSignal): Promise<OnlineResult> {
  const sources: Array<() => Promise<Place[]>> = [
    () => searchOpenMeteo(q, lang, signal),
    () => searchPhoton(q, lang, signal),
    () => searchNominatim(q, lang, signal),
  ];
  for (const src of sources) {
    try {
      const places = await src();
      if (places.length > 0) return { places, ok: true };
    } catch {
      // 试试下一个源
    }
  }
  return { places: [], ok: false };
}

/** 带超时的 fetch（不占用外部 signal，超时后继续回退下一个源）。 */
async function fetchWithTimeout(url: string, signal?: AbortSignal): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const onAbort = () => ac.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    return await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Open-Meteo Geocoding：国内可达性好，支持中英文。 */
async function searchOpenMeteo(q: string, lang: 'zh' | 'en', signal?: AbortSignal): Promise<Place[]> {
  const url =
    'https://geocoding-api.open-meteo.com/v1/search?' +
    new URLSearchParams({
      name: q,
      count: '8',
      language: lang === 'zh' ? 'zh' : 'en',
      format: 'json',
    }).toString();
  const res = await fetchWithTimeout(url, signal);
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const data = (await res.json()) as { results?: Array<{ name: string; latitude: number; longitude: number; admin1?: string; country?: string }> };
  return (data.results ?? []).map((r) => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lng: r.longitude,
    source: 'open-meteo' as const,
  }));
}

/** Photon（komoot，OSM 数据）。 */
async function searchPhoton(q: string, lang: 'zh' | 'en', signal?: AbortSignal): Promise<Place[]> {
  const url =
    'https://photon.komoot.io/api/?' +
    new URLSearchParams({
      q,
      limit: '8',
      lang: lang === 'zh' ? 'default' : 'en',
    }).toString();
  const res = await fetchWithTimeout(url, signal);
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const data = (await res.json()) as { features?: Array<{ properties: Record<string, string>; geometry: { coordinates: [number, number] } }> };
  return (data.features ?? []).map((f) => ({
    name: [f.properties.name, f.properties.city, f.properties.state, f.properties.country].filter(Boolean).join(', '),
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    source: 'photon' as const,
  }));
}

/** Nominatim（OSM，原始方案，最后回退）。 */
async function searchNominatim(q: string, lang: 'zh' | 'en', signal?: AbortSignal): Promise<Place[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      format: 'jsonv2',
      limit: '8',
      q,
      'accept-language': lang === 'zh' ? 'zh-CN,zh' : 'en',
    }).toString();
  const res = await fetchWithTimeout(url, signal);
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((d) => ({
    name: d.display_name,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    source: 'nominatim' as const,
  }));
}
