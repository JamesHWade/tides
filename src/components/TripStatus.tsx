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
  /** Station-local wall-clock-UTC `now`, owned by App. */
  now: Date;
};

function dayNumber(now: Date, start: Date, end: Date): number | null {
  if (now.getTime() < start.getTime() || now.getTime() > end.getTime()) return null;
  return Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
}

function tripDays(start: Date, end: Date): number {
  // `end` is the start of the day AFTER the last trip day; subtract one.
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function TripStatus({ days, now }: Props) {
  const timeline = flattenTides(days);
  const state = currentTideState(timeline, now);

  const start = timeOn(TRIP_RANGE.startISO, "00:00");
  const end = new Date(timeOn(TRIP_RANGE.endISO, "00:00").getTime() + 86400000);
  const dayN = dayNumber(now, start, end);
  const totalDays = tripDays(start, end);

  let phase: "before" | "during" | "after";
  if (now.getTime() < start.getTime()) phase = "before";
  else if (now.getTime() > end.getTime()) phase = "after";
  else phase = "during";

  const daysUntil = Math.ceil((start.getTime() - now.getTime()) / 86400000);
  const daysSince = Math.floor((now.getTime() - end.getTime()) / 86400000);

  const longDate = `${now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC", // `now` carries Eastern wall-clock in its UTC fields
  })}`;

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
            · {longDate}
          </>
        )}
        {phase === "after" && (
          <>
            <span className="trip-status__pill">Wrapped</span>
            {daysSince === 0 ? (
              <>
                Trip ended <strong>today</strong>
              </>
            ) : (
              <>
                Trip ended{" "}
                <strong>
                  {daysSince} {daysSince === 1 ? "day" : "days"}
                </strong>{" "}
                ago
              </>
            )}
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
