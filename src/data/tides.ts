// Kiawah River Bridge, SC — NOAA tide station 8667062.
//
// The default trip range is May 17–24, 2026, and CI fetches NOAA predictions
// for that range at deploy time into ./tides.generated.ts. That snapshot is
// kept as a fast, offline-safe cache. The app can also fetch any other date
// range at runtime (see utils/runtimeTides.ts) so a user can plan around
// arbitrary dates from the browser.

import { GENERATED_AT, generatedTideDays } from "./tides.generated";

export type TideType = "High" | "Low";

export type TideEvent = {
  /** 24h "HH:MM" — local Eastern time. */
  time: string;
  /** Display time, 12-hour with AM/PM. */
  displayTime: string;
  type: TideType;
  /** Predicted height in feet (MLLW). */
  heightFt: number;
};

export type DayPlan = {
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** Human label, e.g. "Sunday, May 17". */
  label: string;
  tides: TideEvent[];
  /** Optional free-form family notes for this day. */
  notes?: string[];
};

export type DateRange = { startISO: string; endISO: string };

export const STATION = {
  id: "8667062",
  name: "Kiawah River Bridge, SC",
  datum: "MLLW",
  timeZone: "America/New_York",
  lat: 32.6133,
  lon: -80.0606,
};

export const TRIP_RANGE = {
  startISO: "2026-05-17",
  endISO: "2026-05-24",
  label: "May 17–24, 2026",
};

function t(time: string, displayTime: string, type: TideType, heightFt: number): TideEvent {
  return { time, displayTime, type, heightFt };
}

/**
 * Placeholder pattern — plausible semidiurnal values near the May 16, 2026
 * new moon spring tides, used only for the default trip dates when
 * tides.generated.ts is empty.
 */
const PLACEHOLDER_BY_DATE: Record<string, TideEvent[]> = {
  "2026-05-17": [
    t("01:24", "1:24 AM", "Low", -0.3),
    t("07:38", "7:38 AM", "High", 6.4),
    t("13:51", "1:51 PM", "Low", -0.5),
    t("20:09", "8:09 PM", "High", 6.7),
  ],
  "2026-05-18": [
    t("02:18", "2:18 AM", "Low", -0.4),
    t("08:32", "8:32 AM", "High", 6.3),
    t("14:45", "2:45 PM", "Low", -0.4),
    t("21:03", "9:03 PM", "High", 6.5),
  ],
  "2026-05-19": [
    t("03:12", "3:12 AM", "Low", -0.2),
    t("09:26", "9:26 AM", "High", 6.0),
    t("15:39", "3:39 PM", "Low", -0.2),
    t("21:57", "9:57 PM", "High", 6.2),
  ],
  "2026-05-20": [
    t("04:06", "4:06 AM", "Low", 0.0),
    t("10:20", "10:20 AM", "High", 5.7),
    t("16:33", "4:33 PM", "Low", 0.1),
    t("22:51", "10:51 PM", "High", 5.9),
  ],
  "2026-05-21": [
    t("05:00", "5:00 AM", "Low", 0.3),
    t("11:14", "11:14 AM", "High", 5.3),
    t("17:27", "5:27 PM", "Low", 0.4),
    t("23:45", "11:45 PM", "High", 5.5),
  ],
  "2026-05-22": [
    t("05:54", "5:54 AM", "Low", 0.5),
    t("12:08", "12:08 PM", "High", 4.9),
    t("18:21", "6:21 PM", "Low", 0.7),
  ],
  "2026-05-23": [
    t("00:39", "12:39 AM", "High", 5.1),
    t("06:48", "6:48 AM", "Low", 0.7),
    t("13:02", "1:02 PM", "High", 4.6),
    t("19:15", "7:15 PM", "Low", 0.8),
  ],
  "2026-05-24": [
    t("01:33", "1:33 AM", "High", 4.9),
    t("07:42", "7:42 AM", "Low", 0.7),
    t("13:56", "1:56 PM", "High", 4.4),
    t("20:09", "8:09 PM", "Low", 0.8),
  ],
};

const TRIP_NOTES: Record<string, string[] | undefined> = {
  "2026-05-17": ["Travel / arrival day — keep beach plans flexible."],
  "2026-05-24": ["Travel / departure day."],
};

const SNAPSHOT_BY_DATE: Map<string, TideEvent[]> = new Map(
  generatedTideDays
    .filter((d) => d.tides.length > 0)
    .map((d) => [d.date, d.tides] as const),
);

/** Best on-hand events for a date: NOAA snapshot, else placeholder, else undefined. */
export function localEventsFor(dateISO: string): TideEvent[] | undefined {
  return SNAPSHOT_BY_DATE.get(dateISO) ?? PLACEHOLDER_BY_DATE[dateISO];
}

export function labelForDate(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

/** Compose day plans for a date range from whatever the lookup can supply. */
export function buildDayPlans(
  startISO: string,
  endISO: string,
  lookup: (dateISO: string) => TideEvent[] | undefined,
  notes: Record<string, string[] | undefined> = {},
): DayPlan[] {
  const out: DayPlan[] = [];
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  for (let cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
    const iso = cur.toISOString().slice(0, 10);
    out.push({
      date: iso,
      label: labelForDate(iso),
      tides: lookup(iso) ?? [],
      notes: notes[iso],
    });
  }
  return out;
}

/** Iterate every date in an inclusive range as "YYYY-MM-DD". */
export function eachDateISO(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  for (let cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
    out.push(cur.toISOString().slice(0, 10));
  }
  return out;
}

/** Notes attached to the default family-trip dates. Empty for other ranges. */
export function notesFor(dateISO: string): string[] | undefined {
  return TRIP_NOTES[dateISO];
}

export const DATA_VERIFIED: boolean = generatedTideDays.length > 0;
export const DATA_GENERATED_AT: string | null = GENERATED_AT;

/** The default "trip week" plans, used as the initial view. */
export const defaultTripDays: DayPlan[] = buildDayPlans(
  TRIP_RANGE.startISO,
  TRIP_RANGE.endISO,
  localEventsFor,
  TRIP_NOTES,
);
