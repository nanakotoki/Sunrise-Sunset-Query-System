/**
 * 地图瓦片源（多源自动回退，按国内实测可达性排序）。
 *
 * 顺序依据 2026-09-17 实测（中国大陆网络）：
 *   高德（1.3s 通）→ CartoDB（2.2s 通）→ OSM 官方（超时不通）
 * 高德中文标注、国内最快；CartoDB 国际覆盖好，作为海外/高德失败回退。
 */
import L from 'leaflet';

export interface TileSource {
  id: string;
  url: string;
  options: L.TileLayerOptions;
}

export const TILE_SOURCES: TileSource[] = [
  {
    id: 'amap',
    url: 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    options: { maxZoom: 18, attribution: '© 高德地图' },
  },
  {
    id: 'carto',
    url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    options: { maxZoom: 19, attribution: '© OpenStreetMap © CARTO' },
  },
  {
    id: 'osm',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 18, attribution: '© OpenStreetMap' },
  },
];

/**
 * 依次尝试各瓦片源，第一个能在超时内加载出瓦片的挂到地图。
 * 返回实际使用的源 id；全部失败返回 null。
 */
export async function loadTiles(map: L.Map, timeoutMs = 5000): Promise<string | null> {
  for (const src of TILE_SOURCES) {
    const ok = await trySource(map, src, timeoutMs);
    if (ok) return src.id;
  }
  return null;
}

function trySource(map: L.Map, src: TileSource, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      layer.off();
      if (!ok) layer.remove();
      resolve(ok);
    };
    const layer = L.tileLayer(src.url, src.options);
    const timer = setTimeout(() => finish(false), timeoutMs);
    // 任意瓦片错误即判定该源不可用（国外源在国内常表现为全部超时）
    layer.on('tileerror', () => finish(false));
    // 当前视口瓦片全部加载完成 → 可用
    layer.on('load', () => finish(true));
    layer.addTo(map);
  });
}
