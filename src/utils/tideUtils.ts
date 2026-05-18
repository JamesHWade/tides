import { STATION, type DayPlan, type TideEvent } from "../data/tides";

export type TidePoint = { time: Date; heightFt: number; type: "High" | "Low" };

/**
 * Time-handling convention used across the app
 * ----------------------------------------------
 * Tide data, sun times, and the "now" indicator all live in
 * STATION.timeZone (America/New_York). We represent every such moment as a
 * "wall-clock-UTC" Date — a Date whose `getUTC*` fields hold the Eastern
 * wall-clock components. Comparing two such Dates with `getTime()` gives
 * the correct elapsed duration as long as both use the convention.
 *
 * Use `timeOn(dateISO, hhmm)` to build a tide/sun moment, and
 * `nowInStationTZ(realNow)` to convert the viewer's wall-clock `new Date()`
 * to the same convention. Format with `formatClock`, which reads UTC fields.
 *
 * Note: tide data is documented as local Eastern; the viewer's browser
 * timezone is irrelevant to the visualization.
 */

/** Build a "wall-clock-UTC" Date from an ISO date + 24h HH:MM. */
export function timeOn(dateISO: string, hhmm: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(
    Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0),
  );
}

const STATION_TZ_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: STATION.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Convert a real UTC moment (e.g. `new Date()`) to the wall-clock-UTC
 * convention by reading the station's local-time components.
 */
export function nowInStationTZ(realNow: Date = new Date()): Date {
  const parts = Object.fromEntries(
    STATION_TZ_FORMATTER.formatToParts(realNow).map((p) => [p.type, p.value]),
  );
  return new Date(
    Date.UTC(
      parseInt(parts.year, 10),
      parseInt(parts.month, 10) - 1,
      parseInt(parts.day, 10),
      parseInt(parts.hour, 10) % 24,
      parseInt(parts.minute, 10),
      parseInt(parts.second, 10),
    ),
  );
}

/** Pull `YYYY-MM-DD` from a wall-clock-UTC Date. */
export function dateISOOf(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Flatten all tide events across the trip into a sorted timeline. */
export function flattenTides(days: DayPlan[]): TidePoint[] {
  const all: TidePoint[] = [];
  for (const day of days) {
    for (const t of day.tides) {
      all.push({ time: timeOn(day.date, t.time), heightFt: t.heightFt, type: t.type });
    }
  }
  all.sort((a, b) => a.time.getTime() - b.time.getTime());
  return all;
}

/**
 * Smoothly interpolate tide height between consecutive extrema using a
 * cosine (half-wave) curve — a good approximation of the real semidiurnal
 * pattern between a marked high and low.
 */
export function interpolateHeight(timeline: TidePoint[], at: Date): number | null {
  if (timeline.length === 0) return null;
  const t = at.getTime();
  if (t <= timeline[0].time.getTime()) return timeline[0].heightFt;
  if (t >= timeline[timeline.length - 1].time.getTime()) {
    return timeline[timeline.length - 1].heightFt;
  }
  for (let i = 0; i < timeline.length - 1; i++) {
    const a = timeline[i];
    const b = timeline[i + 1];
    const ta = a.time.getTime();
    const tb = b.time.getTime();
    if (t >= ta && t <= tb) {
      const frac = (t - ta) / (tb - ta);
      // Half cosine: smooth at both endpoints.
      const eased = (1 - Math.cos(frac * Math.PI)) / 2;
      return a.heightFt + (b.heightFt - a.heightFt) * eased;
    }
  }
  return null;
}

export type TideState = {
  heightFt: number;
  direction: "rising" | "falling";
  next: TidePoint;
  prev: TidePoint;
};

/** Current interpolated height + the next high/low. Returns null outside the trip. */
export function currentTideState(timeline: TidePoint[], at: Date): TideState | null {
  if (timeline.length < 2) return null;
  const t = at.getTime();
  if (t < timeline[0].time.getTime() || t > timeline[timeline.length - 1].time.getTime()) {
    return null;
  }
  for (let i = 0; i < timeline.length - 1; i++) {
    const a = timeline[i];
    const b = timeline[i + 1];
    if (t >= a.time.getTime() && t <= b.time.getTime()) {
      const h = interpolateHeight(timeline, at) ?? a.heightFt;
      return {
        heightFt: h,
        direction: b.heightFt > a.heightFt ? "rising" : "falling",
        next: b,
        prev: a,
      };
    }
  }
  return null;
}

export function formatDuration(ms: number): string {
  const totalMins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}


export type NapSettings = {
  /** 24h "HH:MM" */
  napStart: string;
  /** 24h "HH:MM" */
  napEnd: string;
};

export const DEFAULT_NAP: NapSettings = { napStart: "13:00", napEnd: "15:00" };

/** Format a wall-clock-UTC Date as 12-hour AM/PM (reads UTC fields). */
export function formatClock(d: Date): string {
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

export function windowsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export type Window = {
  start: Date;
  end: Date;
  label: string;
  /** Anchor tide, if any. */
  tide?: TideEvent;
};

/**
 * Beach play window centered on a low tide. Defaults to ±90 min, since lower
 * water often exposes more flat sand and shallow pools for kids.
 *
 * When `daylight` is supplied, the window is clipped to between sunrise and
 * sunset. A low tide whose entire ±pad window falls outside daylight (a 3 AM
 * low, say) returns null — recommending a "beach play" window in the dark is
 * never useful for the families this app is built for. Without `daylight`
 * the function always returns a Window, preserving the original signature
 * for callers that don't care about night/day.
 */
export function lowTidePlayWindow(
  day: DayPlan,
  low: TideEvent,
  padMinutes?: number,
): Window;
export function lowTidePlayWindow(
  day: DayPlan,
  low: TideEvent,
  padMinutes: number,
  daylight: { sunrise: Date; sunset: Date },
): Window | null;
export function lowTidePlayWindow(
  day: DayPlan,
  low: TideEvent,
  padMinutes = 90,
  daylight?: { sunrise: Date; sunset: Date },
): Window | null {
  const center = timeOn(day.date, low.time);
  let start = addMinutes(center, -padMinutes);
  let end = addMinutes(center, padMinutes);
  if (daylight) {
    if (end <= daylight.sunrise || start >= daylight.sunset) return null;
    if (start < daylight.sunrise) start = daylight.sunrise;
    if (end > daylight.sunset) end = daylight.sunset;
  }
  return {
    start,
    end,
    label: "Best low-tide play window",
    tide: low,
  };
}

/**
 * Beach time isn't only good at low tide — it's bad *around* high tide. A
 * high pushes the waterline up against the dune line, so the wet-sand strip
 * shrinks and the surf gets pushy. Anything outside ±`padHighMin` of a high
 * (within daylight) is workable; the time near a low is just the best of it.
 *
 * Returns the daylight intervals where the family can plan beach time,
 * each one labeled with the nearest low tide so the UI can say "near the
 * 1:51 PM low" when applicable, or just "well away from high tide" otherwise.
 * Intervals shorter than 45 minutes are dropped.
 */
export function goodBeachWindows(
  day: DayPlan,
  daylight: { sunrise: Date; sunset: Date },
  padHighMin = 90,
): Window[] {
  const highs = day.tides.filter((t) => t.type === "High");
  const lows = day.tides.filter((t) => t.type === "Low");

  // Bad bands: ±padHighMin around each high.
  const badBands = highs.map((h) => {
    const c = timeOn(day.date, h.time);
    return { start: addMinutes(c, -padHighMin), end: addMinutes(c, padHighMin) };
  });

  // Start from the full daylight interval, subtract each bad band.
  let goodBands: Array<{ start: Date; end: Date }> = [
    { start: daylight.sunrise, end: daylight.sunset },
  ];
  for (const bad of badBands) {
    const next: Array<{ start: Date; end: Date }> = [];
    for (const g of goodBands) {
      if (bad.end <= g.start || bad.start >= g.end) {
        next.push(g);
        continue;
      }
      if (bad.start > g.start) {
        next.push({ start: g.start, end: bad.start });
      }
      if (bad.end < g.end) {
        next.push({ start: bad.end, end: g.end });
      }
    }
    goodBands = next;
  }

  const MIN_MS = 45 * 60_000;
  return goodBands
    .filter((b) => b.end.getTime() - b.start.getTime() >= MIN_MS)
    .map((b) => {
      // Find the low tide whose time falls inside this band — that's the
      // anchor. If no low falls inside, leave tide undefined; the UI/copy
      // can phrase it as "away from high tide" rather than "near the low".
      const startMs = b.start.getTime();
      const endMs = b.end.getTime();
      let anchorLow: TideEvent | undefined;
      for (const l of lows) {
        const lt = timeOn(day.date, l.time).getTime();
        if (lt >= startMs && lt <= endMs) {
          anchorLow = l;
          break;
        }
      }
      return {
        start: b.start,
        end: b.end,
        label: anchorLow ? "Good beach time (near low)" : "Good beach time",
        tide: anchorLow,
      };
    });
}

export function napInterval(dateISO: string, nap: NapSettings): { start: Date; end: Date } {
  return {
    start: timeOn(dateISO, nap.napStart),
    end: timeOn(dateISO, nap.napEnd),
  };
}

export function conflictsWithNap(w: Window, nap: { start: Date; end: Date }): boolean {
  return windowsOverlap(w.start, w.end, nap.start, nap.end);
}

export function formatWindow(w: Window): string {
  return `${formatClock(w.start)} – ${formatClock(w.end)}`;
}

/**
 * Pick the best single recommendation copy for the day. Beach time is good
 * everywhere except ±90 min of high tide, so this looks at the broader
 * `goodBeachWindows` (when `daylight` is given) rather than only the
 * ±90-min-around-each-low strip. Without `daylight`, falls back to the
 * legacy low-only logic for any caller that doesn't have sun times.
 *
 * Optional `pace` lets the day card give a more honest recommendation —
 * a window the family can't actually use shouldn't drive the copy.
 */
export function bestDailyRecommendation(
  day: DayPlan,
  nap: NapSettings,
  daylight?: { sunrise: Date; sunset: Date },
  pace?: { earliestStart: string; latestEnd: string },
): string {
  const naps = napInterval(day.date, nap);
  const lows = day.tides.filter((t) => t.type === "Low");
  const highs = day.tides.filter((t) => t.type === "High");
  if (lows.length === 0 && highs.length === 0) {
    return "No tide data for today at this station.";
  }

  if (!daylight) {
    if (lows.length === 0) {
      return "No low tide today at this station — plan around the high tides and use a quieter beach access.";
    }
    const fallbackWindows = lows.map((l) => ({
      low: l,
      win: lowTidePlayWindow(day, l, 90),
    }));
    const nonConflicting = fallbackWindows.filter(({ win }) => !conflictsWithNap(win, naps));
    if (nonConflicting.length === 0) {
      return "All daylight low tides overlap nap today — consider a short morning beach visit or a late-afternoon shell walk.";
    }
    const pick = nonConflicting.sort((a, b) => a.win.start.getTime() - b.win.start.getTime())[0];
    const hour = pick.win.start.getUTCHours();
    if (hour < 11) return "Best with kids: morning beach play before nap.";
    if (hour < 17) return "Great low-tide window this afternoon after naps.";
    return "Late afternoon low — good for a pre-dinner shell walk.";
  }

  let windows = goodBeachWindows(day, daylight);
  if (pace) {
    const familyStart = timeOn(day.date, pace.earliestStart);
    const familyEnd = timeOn(day.date, pace.latestEnd);
    windows = clipWindowsToFamilyHours(windows, familyStart, familyEnd);
  }

  // Split each window around the nap (instead of treating any overlap as a
  // conflict). A 9 AM–6 PM good window with a 1–3 PM nap should still
  // recommend an afternoon plan, not an "overlaps nap" punt.
  const usable = splitWindowsAroundNap(windows, naps);
  const hasDaylightLow = lows.some((l) => {
    const t = timeOn(day.date, l.time);
    return t >= daylight.sunrise && t <= daylight.sunset;
  });

  if (usable.length === 0) {
    // Two distinct failure modes — windows existed but nap ate them, or
    // the highs pinned the wet-sand strip all daylight.
    if (windows.length > 0) {
      return "Today's good beach windows overlap nap — keep beach time short on either side.";
    }
    return "Surf is up against the dunes most of today — plan a pool, indoor stop, or a quick wading visit.";
  }

  // Prefer a window with a daylight low anchor; otherwise pick the earliest.
  const anchored = usable.filter((w) => w.tide != null);
  const pick = anchored.length > 0
    ? anchored.sort((a, b) => a.start.getTime() - b.start.getTime())[0]
    : usable.sort((a, b) => a.start.getTime() - b.start.getTime())[0];

  // Time-of-day cue tracks the anchor low when present, so a 10:30–6:30
  // post-nap window anchored to the 1:51 PM low reads as "afternoon".
  const refTime = pick.tide ? timeOn(day.date, pick.tide.time) : pick.start;
  const hour = refTime.getUTCHours();
  const nearLow = pick.tide != null;

  if (!hasDaylightLow) {
    return lows.length === 0
      ? "No low tide today — water stays on the higher side, but you've got workable beach time between the highs."
      : "All lows are outside daylight today — water stays on the higher side, but you've got workable beach time between the highs.";
  }

  if (hour < 11) {
    return nearLow
      ? "Morning beach window lines up with the low — flat sand and shallow pools."
      : "Morning beach is workable — well away from high tide.";
  }
  if (hour < 17) {
    return nearLow
      ? "Afternoon low gives you the day's best beach window."
      : "Afternoon beach is open — high tide is well clear.";
  }
  return nearLow
    ? "Late-day low — great for a pre-dinner shell walk."
    : "Late-day beach time is workable until sunset.";
}

/**
 * Trim each window against the family's earliest/latest. Drops anything
 * shorter than 45 min after the clip. Clears the anchor `tide` if the
 * low's center no longer falls inside the trimmed segment, so downstream
 * "near low" copy doesn't claim an anchor the family can't actually reach.
 */
function clipWindowsToFamilyHours(
  windows: Window[],
  familyStart: Date,
  familyEnd: Date,
): Window[] {
  const MIN_MS = 45 * 60_000;
  const out: Window[] = [];
  for (const w of windows) {
    if (w.end <= familyStart || w.start >= familyEnd) continue;
    const s = w.start < familyStart ? familyStart : w.start;
    const e = w.end > familyEnd ? familyEnd : w.end;
    if (e.getTime() - s.getTime() < MIN_MS) continue;
    out.push(rebuildWindow(w, s, e));
  }
  return out;
}

function splitWindowsAroundNap(
  windows: Window[],
  nap: { start: Date; end: Date },
): Window[] {
  const MIN_MS = 45 * 60_000;
  const out: Window[] = [];
  for (const w of windows) {
    if (!windowsOverlap(w.start, w.end, nap.start, nap.end)) {
      out.push(w);
      continue;
    }
    if (nap.start > w.start) out.push(rebuildWindow(w, w.start, nap.start));
    if (nap.end < w.end) out.push(rebuildWindow(w, nap.end, w.end));
  }
  return out.filter((w) => w.end.getTime() - w.start.getTime() >= MIN_MS);
}

function rebuildWindow(w: Window, start: Date, end: Date): Window {
  const tideStillInside = (() => {
    if (!w.tide) return false;
    const dayISO = dateISOOf(w.start);
    const center = timeOn(dayISO, w.tide.time);
    return center >= start && center <= end;
  })();
  return {
    ...w,
    start,
    end,
    tide: tideStillInside ? w.tide : undefined,
  };
}

export { clipWindowsToFamilyHours };
