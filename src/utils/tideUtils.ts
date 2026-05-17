import type { DayPlan, TideEvent } from "../data/tides";

export type NapSettings = {
  /** 24h "HH:MM" */
  napStart: string;
  /** 24h "HH:MM" */
  napEnd: string;
};

export const DEFAULT_NAP: NapSettings = { napStart: "13:00", napEnd: "15:00" };

/** Build a Date for a "HH:MM" 24h time on a given ISO date (local time). */
export function timeOn(dateISO: string, hhmm: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

/** Format a Date as 12-hour AM/PM. */
export function formatClock(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
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
 */
export function lowTidePlayWindow(day: DayPlan, low: TideEvent, padMinutes = 90): Window {
  const center = timeOn(day.date, low.time);
  return {
    start: addMinutes(center, -padMinutes),
    end: addMinutes(center, padMinutes),
    label: "Best low-tide play window",
    tide: low,
  };
}

/**
 * Wildlife-observation window around a low tide. Strand-feeding activity, when
 * it occurs, tends to cluster around lower water — but it is never guaranteed.
 * Keep this conservative: ±90 minutes.
 */
export function strandFeedingWatchWindow(day: DayPlan, low: TideEvent, padMinutes = 90): Window {
  const center = timeOn(day.date, low.time);
  return {
    start: addMinutes(center, -padMinutes),
    end: addMinutes(center, padMinutes),
    label: "Possible strand-feeding watch window",
    tide: low,
  };
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
 * Pick the best single recommendation copy for the day based on tide events
 * and the nap interval.
 */
export function bestDailyRecommendation(day: DayPlan, nap: NapSettings): string {
  const naps = napInterval(day.date, nap);
  const lows = day.tides.filter((t) => t.type === "Low");
  if (lows.length === 0) {
    return "No low tide today at this station — plan around the high tides and use a quieter beach access.";
  }

  const windows = lows.map((l) => ({ low: l, win: lowTidePlayWindow(day, l) }));
  const nonConflicting = windows.filter(({ win }) => !conflictsWithNap(win, naps));

  if (nonConflicting.length > 0) {
    // Prefer the earliest non-conflicting window, then a morning/afternoon hint.
    const pick = nonConflicting.sort((a, b) => a.win.start.getTime() - b.win.start.getTime())[0];
    const hour = pick.low.time.split(":").map(Number)[0] ?? 0;
    if (hour < 11) return "Best with kids: morning beach play before nap.";
    if (hour < 17) return "Great low-tide window this afternoon after naps.";
    return "Late low tide — perfect for an after-dinner shell walk.";
  }

  return "All low tides overlap nap today — consider a short morning beach visit and a later shell walk.";
}
