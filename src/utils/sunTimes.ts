// Lightweight sunrise/sunset for the Kiawah/Seabrook area. Results are
// returned in the same "wall-clock-UTC" Eastern-time convention used by the
// tide data — see the doc comment at the top of tideUtils.ts.
//
// Hard-coded for the trip's EDT date range (May 17–24, 2026). If the data
// ever spans the DST boundary, this should switch to a real timezone lookup.

import { timeOn } from "./tideUtils";

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

/** Sunrise / sunset for a "YYYY-MM-DD" date at Kiawah, as wall-clock-UTC Dates. */
export function sunTimes(dateISO: string): { sunrise: Date; sunset: Date } {
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

  const utcRise = new Date((Jtransit - H / 360 - 2440587.5) * 86400000);
  const utcSet = new Date((Jtransit + H / 360 - 2440587.5) * 86400000);

  return {
    sunrise: utcToEastern(utcRise, dateISO),
    sunset: utcToEastern(utcSet, dateISO),
  };
}

function utcToEastern(utc: Date, dateISO: string): Date {
  const hh = (utc.getUTCHours() + EASTERN_OFFSET_HOURS + 24) % 24;
  const mm = utc.getUTCMinutes();
  return timeOn(
    dateISO,
    `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`,
  );
}
