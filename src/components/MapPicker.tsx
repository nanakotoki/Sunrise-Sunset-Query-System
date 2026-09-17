import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { T } from '../i18n';
import { loadTiles } from '../lib/tiles';

interface Props {
  lat: number;
  lng: number;
  onPick: (lat: number, lng: number) => void;
  t: T;
}

let icon: L.DivIcon | null = null;

/** Leaflet 地图选点（E2）。点击地图即拾取经纬度；反向跟随输入变化移动标记。 */
export default function MapPicker({ lat, lng, onPick, t }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const [tileSource, setTileSource] = useState<string | null>(null);

  // 保持回调引用最新，避免挂载时闭包固化（否则改日期后点地图会用旧日期查询）
  useEffect(() => {
    onPickRef.current = onPick;
  });

  // 初始化（一次）
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      center: [lat, lng],
      zoom: 4,
      worldCopyJump: true,
      attributionControl: false,
    });
    // 瓦片源多源回退：国内 OSM 常年超时，高德/CartoDB 可达
    loadTiles(map).then((id) => {
      setTileSource(id);
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      onPickRef.current(Math.round(e.latlng.lat * 10000) / 10000, Math.round(e.latlng.wrap().lng * 10000) / 10000);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 标记 + 视角跟随输入
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!icon) {
      icon = L.divIcon({
        className: 'sun-marker',
        html: `<svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="5" fill="#fbbf24" stroke="#fff" stroke-width="2"/><g stroke="#fbbf24" stroke-width="2" stroke-linecap="round"><line x1="14" y1="1" x2="14" y2="6"/><line x1="14" y1="22" x2="14" y2="27"/><line x1="1" y1="14" x2="6" y2="14"/><line x1="22" y1="14" x2="27" y2="14"/><line x1="4.7" y1="4.7" x2="8.2" y2="8.2"/><line x1="19.8" y1="19.8" x2="23.3" y2="23.3"/><line x1="4.7" y1="23.3" x2="8.2" y2="19.8"/><line x1="19.8" y1="8.2" x2="23.3" y2="4.7"/></g></svg>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
    }
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { icon, title: `${lat}, ${lng}` }).addTo(map);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    map.panTo([lat, lng], { animate: true });
  }, [lat, lng]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/60">
      <div ref={ref} className="h-64 w-full sm:h-72" role="application" aria-label={t('mapTitle')} />
      {tileSource === null && (
        <p className="absolute m-2 rounded-lg bg-slate-900/80 px-2 py-1 text-xs text-slate-400">{t('mapLoading')}</p>
      )}
      <p className="border-t border-slate-700/60 bg-slate-900/80 px-3 py-2 text-xs text-slate-400">
        💡 {t('mapPick')}
      </p>
    </div>
  );
}
