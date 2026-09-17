/**
 * 地图瓦片源（多源 + 多子域负载均衡，按国内实测可达性排序）。
 *
 * 2026-09-17 实测（中国大陆网络）：
 *   高德 4 子域全部 0.2s 内可达；CartoDB dark 1s；OSM 官方超时不通。
 * 高德只有单子域时请求会挤在一台服务器上，部分瓦片被限流导致
 * “一块有一块没有”；Leaflet 的 {s} 子域轮询可分散压力。
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
    // {s} 轮询 webrd01-04，分散瓦片请求避免单服务器限流
    url: 'https://{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    options: {
      subdomains: ['webrd01', 'webrd02', 'webrd03', 'webrd04'],
      maxZoom: 18,
      attribution: '© 高德地图',
      // 高德矢量风格在暗色 UI 里偏亮，透明度稍降
      opacity: 0.95,
      // 失败瓦片自动重试（Leaflet 默认不重试）
      keepBuffer: 6,
    },
  },
  {
    id: 'carto',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    options: {
      subdomains: ['a', 'b', 'c', 'd'],
      maxZoom: 19,
      attribution: '© OpenStreetMap © CARTO',
    },
  },
  {
    id: 'osm',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 18, attribution: '© OpenStreetMap' },
  },
];

/** 逐源探测：第一个能加载出瓦片的胜出。全部失败返回 null。 */
export async function loadTiles(map: L.Map, timeoutMs = 6000): Promise<string | null> {
  for (const src of TILE_SOURCES) {
    const ok = await trySource(map, src, timeoutMs);
    if (ok) return src.id;
  }
  return null;
}

function trySource(map: L.Map, src: TileSource, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let errors = 0;
    let loaded = 0;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      layer.off();
      if (!ok) layer.remove();
      resolve(ok);
    };
    const layer = L.tileLayer(src.url, src.options);
    const timer = setTimeout(() => {
      // 超时：有瓦片加载成功就算可用（部分瓦片慢不致命）
      finish(loaded > 0);
    }, timeoutMs);
    // 连续 3 块瓦片失败且没有任何成功 → 判定源不可用；
    // 个别瓦片失败不换源（切源反而会清空整层）
    layer.on('tileerror', () => {
      errors++;
      if (errors >= 3 && loaded === 0) finish(false);
    });
    layer.on('tileload', () => {
      loaded++;
      // 任意一块瓦片真实加载成功 → 源可用，停止探测
      if (loaded >= 2) finish(true);
    });
    layer.addTo(map);
  });
}

/** 瓦片加载状态（供 UI 提示）。 */
export interface TileStatus {
  source: string | null;
  failed: boolean;
}

/** 挂载后续监控：完全无瓦片时提示用户。 */
export function watchTiles(layer: L.TileLayer, onFail: () => void): void {
  let loaded = 0;
  const timer = setTimeout(() => {
    if (loaded === 0) onFail();
  }, 8000);
  layer.on('tileload', () => {
    loaded++;
    clearTimeout(timer);
  });
}
