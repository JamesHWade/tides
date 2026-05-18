import { useEffect, useState } from "react";
import type { CustomEvent, CustomEventRecurrence } from "../utils/customEvents";

const STORAGE_KEY = "tides.commitments.v1";

const HHMM_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RECURRENCES: ReadonlyArray<CustomEventRecurrence> = [
  "specific",
  "daily",
  "weekly",
];

function isRecurrence(v: unknown): v is CustomEventRecurrence {
  return typeof v === "string" && (RECURRENCES as readonly string[]).includes(v);
}

function coerce(raw: unknown): CustomEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string") continue;
    if (typeof o.label !== "string") continue;
    if (typeof o.startHHMM !== "string" || !HHMM_RE.test(o.startHHMM)) continue;
    if (typeof o.endHHMM !== "string" || !HHMM_RE.test(o.endHHMM)) continue;
    // Reject inverted/zero intervals here so the optimizer never sees a
    // protected interval where start >= end (would break trimming /
    // subdivision math).
    if (o.startHHMM >= o.endHHMM) continue;
    if (!isRecurrence(o.recurrence)) continue;
    const evt: CustomEvent = {
      id: o.id,
      label: o.label,
      startHHMM: o.startHHMM,
      endHHMM: o.endHHMM,
      recurrence: o.recurrence,
    };
    if (typeof o.dateISO === "string" && DATE_RE.test(o.dateISO)) {
      evt.dateISO = o.dateISO;
    }
    if (Array.isArray(o.weekdays)) {
      const days = o.weekdays.filter(
        (d): d is number => typeof d === "number" && d >= 0 && d <= 6,
      );
      if (days.length > 0) evt.weekdays = days;
    }
    if (typeof o.notes === "string") evt.notes = o.notes;
    out.push(evt);
  }
  return out;
}

function load(): CustomEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return coerce(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function useCustomEvents(): [
  CustomEvent[],
  (next: CustomEvent[]) => void,
] {
  const [events, setEvents] = useState<CustomEvent[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      // ignore quota / private mode
    }
  }, [events]);

  return [events, setEvents];
}
