declare module 'tz-lookup' {
  /** 经纬度 → IANA 时区名（如 Asia/Shanghai）。纬度/经度超界抛 RangeError。 */
  function tzlookup(latitude: number, longitude: number): string;
  export = tzlookup;
}
