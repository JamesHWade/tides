// Browser-side NOAA tide-prediction fetcher. Mirrors scripts/fetch-tides.mjs
// so the on-the-fly result is shape-compatible with the build-time snapshot.

import { STATION, type TideEvent } from "../data/tides";

const NOAA_BASE = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

function to12Hour(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  let h = Number(hStr);
  const m = Number(mStr);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export async function fetchTideEventsByDate(
  startISO: string,
  endISO: string,
  signal?: AbortSignal,
): Promise<Map<string, TideEvent[]>> {
  const url = new URL(NOAA_BASE);
  url.searchParams.set("product", "predictions");
  url.searchParams.set("application", "tides-planner-app");
  url.searchParams.set("begin_date", startISO.replace(/-/g, ""));
  url.searchParams.set("end_date", endISO.replace(/-/g, ""));
  url.searchParams.set("datum", "MLLW");
  url.searchParams.set("station", STATION.id);
  url.searchParams.set("time_zone", "lst_ldt");
  url.searchParams.set("units", "english");
  url.searchParams.set("interval", "hilo");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`NOAA HTTP ${res.status} ${res.statusText}`);
  const body = await res.json();
  if (body.error) {
    throw new Error(body.error.message ?? "NOAA error");
  }

  const byDate = new Map<string, TideEvent[]>();
  for (const p of body.predictions ?? []) {
    const [date, time] = String(p.t).split(" ");
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push({
      time,
      displayTime: to12Hour(time),
      type: p.type === "H" ? "High" : "Low",
      heightFt: Number(Number(p.v).toFixed(2)),
    });
  }
  return byDate;
}
