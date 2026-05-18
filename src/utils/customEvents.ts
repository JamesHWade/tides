// Custom family commitments — things the schedule must work around. Each
// event has a label, a start/end time, and either a specific date or a
// recurrence rule. The optimizer treats them as fixed, protected intervals
// and subdivides activity slots around them.

const HHMM_RE = /^\d{2}:\d{2}$/;

export type CustomEventRecurrence =
  /** Applies only to a single dateISO. */
  | "specific"
  /** Applies every day in the trip range. */
  | "daily"
  /** Applies to specific weekdays (0=Sun … 6=Sat). */
  | "weekly";

export type CustomEvent = {
  id: string;
  label: string;
  startHHMM: string;
  endHHMM: string;
  recurrence: CustomEventRecurrence;
  /** Set when recurrence === "specific". */
  dateISO?: string;
  /** Set when recurrence === "weekly". */
  weekdays?: number[];
  /** Optional short note shown in the schedule block. */
  notes?: string;
};

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** New blank event with a sensible default time. */
export function makeEmptyEvent(dateISO?: string): CustomEvent {
  return {
    id: `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    label: "",
    startHHMM: "18:00",
    endHHMM: "19:30",
    recurrence: dateISO ? "specific" : "specific",
    dateISO,
  };
}

/** Weekday (0–6) of an ISO date, computed via UTC to dodge browser TZ drift. */
export function weekdayOf(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** True if the event applies to the given ISO date. */
export function eventAppliesTo(evt: CustomEvent, dateISO: string): boolean {
  switch (evt.recurrence) {
    case "specific":
      return evt.dateISO === dateISO;
    case "daily":
      return true;
    case "weekly":
      return Array.isArray(evt.weekdays) && evt.weekdays.includes(weekdayOf(dateISO));
  }
}

/** Quick validation for the editor — start strictly before end, both HH:MM. */
export function isValidEvent(evt: CustomEvent): boolean {
  if (!evt.label.trim()) return false;
  if (!HHMM_RE.test(evt.startHHMM) || !HHMM_RE.test(evt.endHHMM)) return false;
  if (evt.startHHMM >= evt.endHHMM) return false;
  if (evt.recurrence === "specific" && !evt.dateISO) return false;
  if (evt.recurrence === "weekly" && (!evt.weekdays || evt.weekdays.length === 0)) {
    return false;
  }
  return true;
}

/** Human-readable recurrence string for the listing. */
export function describeRecurrence(evt: CustomEvent): string {
  if (evt.recurrence === "specific" && evt.dateISO) {
    const [y, m, d] = evt.dateISO.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12)));
  }
  if (evt.recurrence === "daily") return "Every day";
  if (evt.recurrence === "weekly" && evt.weekdays?.length) {
    return evt.weekdays
      .slice()
      .sort((a, b) => a - b)
      .map((w) => WEEKDAY_SHORT[w])
      .join(" · ");
  }
  return "—";
}
