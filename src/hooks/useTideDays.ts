import { useEffect, useRef, useState } from "react";
import {
  buildDayPlans,
  eachDateISO,
  localEventsFor,
  notesFor,
  type DateRange,
  type DayPlan,
  type TideEvent,
} from "../data/tides";
import { fetchTideEventsByDate } from "../utils/runtimeTides";

export type TideStatus = "ready" | "loading" | "error";

export type TideDaysResult = {
  days: DayPlan[];
  status: TideStatus;
  /** Human-readable error message if status === "error". */
  error: string | null;
  /** Fraction of days served by the snapshot (0–1). */
  snapshotCoverage: number;
};

export function useTideDays(range: DateRange): TideDaysResult {
  const [fetched, setFetched] = useState<Map<string, TideEvent[]>>(new Map());
  const [status, setStatus] = useState<TideStatus>("ready");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dates = eachDateISO(range.startISO, range.endISO);
  const missing = dates.filter(
    (iso) => !localEventsFor(iso) && !fetched.has(iso),
  );

  useEffect(() => {
    if (missing.length === 0) {
      setStatus("ready");
      setError(null);
      return;
    }
    const ac = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ac;
    setStatus("loading");
    setError(null);

    fetchTideEventsByDate(range.startISO, range.endISO, ac.signal)
      .then((map) => {
        if (ac.signal.aborted) return;
        setFetched((prev) => {
          const next = new Map(prev);
          for (const [k, v] of map) next.set(k, v);
          return next;
        });
        setStatus("ready");
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setStatus("error");
        setError(err?.message ?? "Failed to load tides");
      });
    return () => ac.abort();
    // missing.join is a stable derived key — recompute only when range shifts
    // to genuinely new dates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startISO, range.endISO, missing.join(",")]);

  const lookup = (iso: string): TideEvent[] | undefined =>
    localEventsFor(iso) ?? fetched.get(iso);

  const days = buildDayPlans(
    range.startISO,
    range.endISO,
    lookup,
    Object.fromEntries(dates.map((iso) => [iso, notesFor(iso)])),
  );

  const covered = dates.filter((iso) => localEventsFor(iso)).length;
  const snapshotCoverage = dates.length === 0 ? 0 : covered / dates.length;

  return { days, status, error, snapshotCoverage };
}
