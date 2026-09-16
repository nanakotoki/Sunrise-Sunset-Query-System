declare module 'suncalc' {
  export interface SunTimes {
    solarNoon: Date;
    nadir: Date;
    sunrise: Date;
    sunset: Date;
    sunriseEnd: Date;
    sunsetStart: Date;
    dawn: Date;
    dusk: Date;
    nauticalDawn: Date;
    nauticalDusk: Date;
    nightEnd: Date;
    night: Date;
    goldenHourEnd: Date;
    goldenHour: Date;
  }

  export interface SunPosition {
    azimuth: number;
    altitude: number;
  }

  const SunCalc: {
    getTimes(date: Date, lat: number, lng: number): SunTimes;
    getPosition(date: Date, lat: number, lng: number): SunPosition;
  };

  export default SunCalc;
}
