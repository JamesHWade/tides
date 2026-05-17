import { useEffect, useState } from "react";
import type { DayPlan } from "../data/tides";
import { TRIP_RANGE } from "../data/tides";
import {
  currentTideState,
  flattenTides,
  formatClock,
  formatDuration,
  timeOn,
} from "../utils/tideUtils";

type Props = {
  days: DayPlan[];
};

function dayNumber(now: Date): number | null {
  const start = timeOn(TRIP_RANGE.startISO, "00:00");
  const end = new Date(timeOn(TRIP_RANGE.endISO, "00:00").getTime() + 86400000);
  if (now.getTime() < start.getTime() || now.getTime() > end.getTime()) return null;
  return Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
}

function tripDays(): number {
  const a = timeOn(TRIP_RANGE.startISO, "00:00").getTime();
  const b = timeOn(TRIP_RANGE.endISO, "00:00").getTime();
  return Math.round((b - a) / 86400000) + 1;
}

export function TripStatus({ days }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const timeline = flattenTides(days);
  const state = currentTideState(timeline, now);
  const dayN = dayNumber(now);
  const totalDays = tripDays();

  const start = timeOn(TRIP_RANGE.startISO, "00:00");
  const end = new Date(timeOn(TRIP_RANGE.endISO, "00:00").getTime() + 86400000);

  let phase: "before" | "during" | "after";
  if (now.getTime() < start.getTime()) phase = "before";
  else if (now.getTime() > end.getTime()) phase = "after";
  else phase = "during";

  const daysUntil = Math.ceil((start.getTime() - now.getTime()) / 86400000);
  const daysSince = Math.floor((now.getTime() - end.getTime()) / 86400000);

  return (
    <section className="trip-status" aria-label="Trip status">
      <div className="trip-status__phase">
        {phase === "before" && (
          <>
            <span className="trip-status__pill trip-status__pill--soon">Countdown</span>
            <strong>
              {daysUntil} {daysUntil === 1 ? "day" : "days"}
            </strong>{" "}
            until the trip
          </>
        )}
        {phase === "during" && dayN != null && (
          <>
            <span className="trip-status__pill trip-status__pill--live">Live</span>
            <strong>
              Day {dayN} of {totalDays}
            </strong>{" "}
            ·{" "}
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </>
        )}
        {phase === "after" && (
          <>
            <span className="trip-status__pill">Wrapped</span>
            Trip ended{" "}
            <strong>
              {daysSince} {daysSince === 1 ? "day" : "days"}
            </strong>{" "}
            ago
          </>
        )}
      </div>

      {state && (
        <div className="trip-status__live">
          <div className="trip-status__metric">
            <span className="trip-status__metric-label">Right now</span>
            <span className="trip-status__metric-value">
              {state.heightFt.toFixed(1)} ft
            </span>
            <span
              className={`trip-status__direction trip-status__direction--${state.direction}`}
            >
              {state.direction === "rising" ? "↑ rising" : "↓ falling"}
            </span>
          </div>
          <div className="trip-status__metric">
            <span className="trip-status__metric-label">
              Next {state.next.type.toLowerCase()}
            </span>
            <span className="trip-status__metric-value">
              {formatClock(state.next.time)}
            </span>
            <span className="trip-status__metric-sub">
              in {formatDuration(state.next.time.getTime() - now.getTime())} ·{" "}
              {state.next.heightFt.toFixed(1)} ft
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
