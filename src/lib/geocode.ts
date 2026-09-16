/**
 * 地名搜索（Nominatim / OpenStreetMap，免费无 key）。
 * 参考用法政策：仅按需请求，带 accept-language，限制并发（上层用 AbortController）。
 */

export interface Place {
  name: string;
  lat: number;
  lng: number;
}

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
}

export async function searchPlaces(query: string, lang: 'zh' | 'en', signal?: AbortSignal): Promise<Place[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      format: 'jsonv2',
      limit: '6',
      q: query,
      'accept-language': lang === 'zh' ? 'zh-CN,zh' : 'en',
    }).toString();

  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = (await res.json()) as NominatimItem[];
  return data
    .map((d) => ({ name: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}
