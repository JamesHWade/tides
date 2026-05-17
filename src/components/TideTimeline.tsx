import type { DayPlan } from "../data/tides";
import { timeOn, napInterval, type NapSettings } from "../utils/tideUtils";

type Props = {
  day: DayPlan;
  nap: NapSettings;
};

/** Minutes since midnight as a 0..1 fraction across the day. */
function fracOfDay(d: Date): number {
  return (d.getHours() * 60 + d.getMinutes()) / (24 * 60);
}

export function TideTimeline({ day, nap }: Props) {
  const napRange = napInterval(day.date, nap);
  const napLeft = fracOfDay(napRange.start) * 100;
  const napWidth = (fracOfDay(napRange.end) - fracOfDay(napRange.start)) * 100;

  return (
    <div className="timeline" aria-label={`Tide timeline for ${day.label}`}>
      <div className="timeline-track">
        <div
          className="timeline-nap"
          style={{ left: `${napLeft}%`, width: `${napWidth}%` }}
          aria-hidden="true"
          title={`Nap ${nap.napStart}–${nap.napEnd}`}
        />
        {day.tides.map((tide) => {
          const at = timeOn(day.date, tide.time);
          const left = fracOfDay(at) * 100;
          return (
            <div
              key={tide.time}
              className={`timeline-marker timeline-${tide.type.toLowerCase()}`}
              style={{ left: `${left}%` }}
              title={`${tide.type} tide ${tide.displayTime} · ${tide.heightFt.toFixed(1)} ft`}
            >
              <span className="visually-hidden">
                {tide.type} tide at {tide.displayTime}, {tide.heightFt.toFixed(1)} feet
              </span>
              <span aria-hidden="true" className="timeline-dot" />
              <span aria-hidden="true" className="timeline-label">
                {tide.type === "High" ? "H" : "L"} {tide.displayTime.replace(/\s?[AP]M$/, "")}
              </span>
            </div>
          );
        })}
      </div>
      <div className="timeline-axis" aria-hidden="true">
        <span>12a</span>
        <span>6a</span>
        <span>noon</span>
        <span>6p</span>
        <span>12a</span>
      </div>
    </div>
  );
}
