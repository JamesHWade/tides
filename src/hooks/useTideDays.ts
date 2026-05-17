import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildDayPlans,
  eachDateISO,
  localEventsFor,
  notesFor,
  placeholderEventsFor,
  snapshotEventsFor,
  type DateRange,
  type DayPlan,
  type EventSource,
  type TideEvent,
} from "../data/tides";
import { fetchTideEventsByDate } from "../utils/runtimeTides";

export type TideStatus = "ready" | "loading" | "error";

export type TideDaysResult = {
  days: DayPlan[];
  status: TideStatus;
  /** Human-readable error message if status === "error". */
  error: string | null;
  /** Per-date provenance map for the requested range. */
  sources: Map<string, EventSource>;
  /** Fraction of days served by the real NOAA snapshot (0–1). */
  snapshotCoverage: number;
  /** Fraction of days served by the hand-coded placeholder (0–1). */
  placeholderCoverage: number;
  /** Fraction of days served by a runtime fetch (0–1). */
  fetchedCoverage: number;
};

export function useTideDays(range: DateRange): TideDaysResult {
  const [fetched, setFetched] = useState<Map<string, TideEvent[]>>(new Map());
  const [status, setStatus] = useState<TideStatus>("ready");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dates = useMemo(
    () => eachDateISO(range.startISO, range.endISO),
    [range.startISO, range.endISO],
  );

  const missing = useMemo(
    () => dates.filter((iso) => !localEventsFor(iso) && !fetched.has(iso)),
    [dates, fetched],
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
  }, [range.startISO, range.endISO, missing]);

  const sources = useMemo<Map<string, EventSource>>(() => {
    const out = new Map<string, EventSource>();
    for (const iso of dates) {
      if (snapshotEventsFor(iso)) out.set(iso, "snapshot");
      else if (placeholderEventsFor(iso)) out.set(iso, "placeholder");
      else if (fetched.has(iso)) out.set(iso, "fetched");
      else out.set(iso, "missing");
    }
    return out;
  }, [dates, fetched]);

  const days = useMemo<DayPlan[]>(() => {
    const lookup = (iso: string): TideEvent[] | undefined =>
      localEventsFor(iso) ?? fetched.get(iso);
    const notes: Record<string, string[] | undefined> = {};
    for (const iso of dates) {
      const n = notesFor(iso);
      if (n) notes[iso] = n;
    }
    return buildDayPlans(range.startISO, range.endISO, lookup, notes);
  }, [range.startISO, range.endISO, dates, fetched]);

  const { snapshotCoverage, placeholderCoverage, fetchedCoverage } = useMemo(() => {
    if (dates.length === 0) {
      return { snapshotCoverage: 0, placeholderCoverage: 0, fetchedCoverage: 0 };
    }
    let snap = 0;
    let ph = 0;
    let fe = 0;
    for (const src of sources.values()) {
      if (src === "snapshot") snap++;
      else if (src === "placeholder") ph++;
      else if (src === "fetched") fe++;
    }
    return {
      snapshotCoverage: snap / dates.length,
      placeholderCoverage: ph / dates.length,
      fetchedCoverage: fe / dates.length,
    };
  }, [dates, sources]);

  return {
    days,
    status,
    error,
    sources,
    snapshotCoverage,
    placeholderCoverage,
    fetchedCoverage,
  };
}
