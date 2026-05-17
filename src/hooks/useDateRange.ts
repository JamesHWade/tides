import { useEffect, useState } from "react";
import { TRIP_RANGE, type DateRange } from "../data/tides";

const STORAGE_KEY = "tides.range.v1";
const MAX_DAYS = 21;

export type DateRangeWithMeta = DateRange & {
  /** True when this range exactly equals TRIP_RANGE. */
  isTrip: boolean;
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidISO(s: string): boolean {
  if (!ISO_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime());
}

function clampRange(range: DateRange): DateRange {
  const fallback = { startISO: TRIP_RANGE.startISO, endISO: TRIP_RANGE.endISO };
  if (!isValidISO(range.startISO) || !isValidISO(range.endISO)) return fallback;
  if (range.endISO < range.startISO) {
    return { startISO: range.startISO, endISO: range.startISO };
  }
  const start = new Date(range.startISO + "T00:00:00Z");
  const end = new Date(range.endISO + "T00:00:00Z");
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days > MAX_DAYS - 1) {
    const clamped = new Date(start.getTime() + (MAX_DAYS - 1) * 86_400_000);
    return { startISO: range.startISO, endISO: clamped.toISOString().slice(0, 10) };
  }
  return range;
}

function load(): DateRange {
  if (typeof window === "undefined") {
    return { startISO: TRIP_RANGE.startISO, endISO: TRIP_RANGE.endISO };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { startISO: TRIP_RANGE.startISO, endISO: TRIP_RANGE.endISO };
    const parsed = JSON.parse(raw) as Partial<DateRange>;
    if (
      typeof parsed.startISO === "string" &&
      typeof parsed.endISO === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.startISO) &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.endISO)
    ) {
      return clampRange({ startISO: parsed.startISO, endISO: parsed.endISO });
    }
  } catch {
    // fall through
  }
  return { startISO: TRIP_RANGE.startISO, endISO: TRIP_RANGE.endISO };
}

export function useDateRange(): {
  range: DateRangeWithMeta;
  setRange: (r: DateRange) => void;
  resetToTrip: () => void;
} {
  const [range, setRangeRaw] = useState<DateRange>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
    } catch {
      // ignore quota / private mode
    }
  }, [range]);

  const setRange = (r: DateRange) => setRangeRaw(clampRange(r));
  const resetToTrip = () =>
    setRangeRaw({ startISO: TRIP_RANGE.startISO, endISO: TRIP_RANGE.endISO });

  const isTrip =
    range.startISO === TRIP_RANGE.startISO && range.endISO === TRIP_RANGE.endISO;

  return { range: { ...range, isTrip }, setRange, resetToTrip };
}

export const MAX_RANGE_DAYS = MAX_DAYS;
