// Lightweight sunrise/sunset for the Kiawah/Seabrook area. Results are
// returned in the same "wall-clock-UTC" Eastern-time convention used by the
// tide data — see the doc comment at the top of tideUtils.ts.

import { STATION } from "../data/tides";
import { timeOn } from "./tideUtils";

const DEG = Math.PI / 180;

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

const OFFSET_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: STATION.timeZone,
  timeZoneName: "shortOffset",
  hour: "numeric",
});

/**
 * UTC offset in hours for `STATION.timeZone` on the given date (handles DST).
 *
 * Returns 0 if Intl can't parse the offset (essentially never on a real
 * browser engine, but better to render at UTC than silently force Eastern —
 * the previous hard-coded `-5` fallback would have been wrong for any future
 * non-Eastern station configuration).
 */
function stationOffsetHours(dateISO: string): number {
  const probe = new Date(dateISO + "T12:00:00Z");
  const part = OFFSET_FORMAT.formatToParts(probe).find(
    (p) => p.type === "timeZoneName",
  );
  if (!part) return 0;
  const m = /GMT([+-]?\d+)(?::(\d+))?/.exec(part.value);
  if (!m) return 0;
  const hours = Number(m[1]);
  const mins = m[2] ? Number(m[2]) / 60 : 0;
  return hours >= 0 ? hours + mins : hours - mins;
}

/** Sunrise / sunset for a "YYYY-MM-DD" date at the station, as wall-clock-UTC Dates. */
export function sunTimes(dateISO: string): { sunrise: Date; sunset: Date } {
  const [y, m, d] = dateISO.split("-").map(Number);
  const lat = STATION.lat;
  const lon = STATION.lon;

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

  const offset = stationOffsetHours(dateISO);

  return {
    sunrise: utcToStationLocal(utcRise, dateISO, offset),
    sunset: utcToStationLocal(utcSet, dateISO, offset),
  };
}

function utcToStationLocal(utc: Date, dateISO: string, offsetHours: number): Date {
  const totalMin = utc.getUTCHours() * 60 + utc.getUTCMinutes() + offsetHours * 60;
  const wrapped = ((totalMin % 1440) + 1440) % 1440;
  const hh = Math.floor(wrapped / 60);
  const mm = Math.round(wrapped % 60);
  return timeOn(
    dateISO,
    `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`,
  );
}
