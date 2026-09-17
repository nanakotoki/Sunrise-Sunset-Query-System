/**
 * IP 网络定位：多源回退（ipwho.is → ip.sb → ipapi.co）。
 * 2026-09 实测：国内网络下 ipapi.co 403、ipwho.is 可达且 CORS 开放（*）。
 * ipwho.is 城市名偶有 Unicode 撇号（Xi’an），用于显示无碍。
 */

export interface IpLocation {
  lat: number;
  lng: number;
  city?: string;
  region?: string;
  country?: string;
}

interface IpWhoIs {
  success: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
}

interface IpSbGeo {
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

interface IpApiCo {
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country_name?: string;
}

const TIMEOUT_MS = 6000;

async function fetchJson(url: string): Promise<unknown> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function sanitize(loc: IpLocation): IpLocation | null {
  if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
  if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null;
  if (Math.abs(loc.lat) > 90 || Math.abs(loc.lng) > 180) return null;
  return loc;
}

/** 依次尝试多个 IP 定位源，任一成功即返回。 */
export async function locateByIp(): Promise<IpLocation> {
  // 1. ipwho.is — CORS 开放，国内实测可达
  try {
    const d = (await fetchJson('https://ipwho.is/')) as IpWhoIs;
    if (d.success !== false) {
      const loc = sanitize({ lat: d.latitude as number, lng: d.longitude as number, city: d.city, region: d.region, country: d.country });
      if (loc) return loc;
    }
  } catch {
    /* 下一源 */
  }
  // 2. ip.sb geoip — 国内实测可达
  try {
    const d = (await fetchJson('https://api.ip.sb/geoip')) as IpSbGeo;
    const loc = sanitize({ lat: d.latitude as number, lng: d.longitude as number, city: d.city, country: d.country });
    if (loc) return loc;
  } catch {
    /* 下一源 */
  }
  // 3. ipapi.co — 国内常 403，作为最后的兜底
  try {
    const d = (await fetchJson('https://ipapi.co/json/')) as IpApiCo;
    const loc = sanitize({ lat: d.latitude as number, lng: d.longitude as number, city: d.city, region: d.region, country: d.country_name });
    if (loc) return loc;
  } catch {
    /* 全部失败 */
  }
  throw new Error('all IP locate sources failed');
}
