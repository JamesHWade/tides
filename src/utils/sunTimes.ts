// Lightweight sunrise/sunset for the Kiawah/Seabrook area. Results are in
// the local "Eastern" time used by the rest of the app. Accurate to about
// a minute or two — plenty for shading a beach-week chart.
//
// Note: this is hard-coded for EDT (UTC-4), which is correct for the trip's
// May date range. If the data range ever extends across the DST boundary,
// switch to a real timezone lookup.

const DEG = Math.PI / 180;
const EASTERN_OFFSET_HOURS = -4; // EDT (May)

function toJulianDay(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function julianToUTCDate(jdv: number): Date {
  return new Date((jdv - 2440587.5) * 86400000);
}

function easternHoursOf(utc: Date): number {
  const h = utc.getUTCHours() + utc.getUTCMinutes() / 60 + utc.getUTCSeconds() / 3600;
  return (h + EASTERN_OFFSET_HOURS + 24) % 24;
}

function formatEasternClock(utc: Date): string {
  let h = (utc.getUTCHours() + EASTERN_OFFSET_HOURS + 24) % 24;
  const m = utc.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${Math.floor(h)}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export type SunTimes = {
  /** Fractional hours since midnight Eastern (0..24) — for chart positioning. */
  sunriseHours: number;
  sunsetHours: number;
  /** Display strings, in Eastern local time. */
  sunriseLabel: string;
  sunsetLabel: string;
};

/** Sunrise / sunset for a "YYYY-MM-DD" date at Kiawah, in Eastern local time. */
export function sunTimes(dateISO: string): SunTimes {
  const [y, m, d] = dateISO.split("-").map(Number);
  const lat = 32.6;
  const lon = -80.05;

  const jd = toJulianDay(y, m ?? 1, d ?? 1) - 2451545.0 + 0.0008;
  const n = jd - lon / 360;
  const M = (357.5291 + 0.98560028 * n) % 360;
  const C =
    1.9148 * Math.sin(M * DEG) +
    0.02 * Math.sin(2 * M * DEG) +
    0.0003 * Math.sin(3 * M * DEG);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const Jtransit = 2451545 + n + 0.0053 * Math.sin(M * DEG) - 0.0069 * Math.sin(2 * lambda * DEG);
  const decl = Math.asin(Math.sin(lambda * DEG) * Math.sin(23.44 * DEG)) / DEG;

  const cosH =
    (Math.sin(-0.83 * DEG) - Math.sin(lat * DEG) * Math.sin(decl * DEG)) /
    (Math.cos(lat * DEG) * Math.cos(decl * DEG));
  const H = Math.acos(Math.max(-1, Math.min(1, cosH))) / DEG;

  const utcRise = julianToUTCDate(Jtransit - H / 360);
  const utcSet = julianToUTCDate(Jtransit + H / 360);

  return {
    sunriseHours: easternHoursOf(utcRise),
    sunsetHours: easternHoursOf(utcSet),
    sunriseLabel: formatEasternClock(utcRise),
    sunsetLabel: formatEasternClock(utcSet),
  };
}
