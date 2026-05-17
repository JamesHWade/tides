import type { DayPlan } from "../data/tides";
import {
  bestDailyRecommendation,
  conflictsWithNap,
  formatClock,
  formatWindow,
  lowTidePlayWindow,
  napInterval,
  strandFeedingWatchWindow,
  type NapSettings,
} from "../utils/tideUtils";
import { sunTimes } from "../utils/sunTimes";
import { RecommendationBadge } from "./RecommendationBadge";
import { TideChart } from "./TideChart";

type Props = {
  day: DayPlan;
  allDays: DayPlan[];
  nap: NapSettings;
  now?: Date;
  isToday?: boolean;
};

export function DayCard({ day, allDays, nap, now, isToday }: Props) {
  const lows = day.tides.filter((t) => t.type === "Low");
  const highs = day.tides.filter((t) => t.type === "High");
  const napRange = napInterval(day.date, nap);

  const playWindows = lows.map((l) => lowTidePlayWindow(day, l));
  const watchWindows = lows.map((l) => strandFeedingWatchWindow(day, l));
  const recommendation = bestDailyRecommendation(day, nap);

  const anyConflict = playWindows.some((w) => conflictsWithNap(w, napRange));
  const allConflict =
    playWindows.length > 0 && playWindows.every((w) => conflictsWithNap(w, napRange));

  const sun = sunTimes(day.date);

  return (
    <article
      id={`day-${day.date}`}
      className={`card day-card ${isToday ? "day-card--today" : ""}`}
      aria-labelledby={`day-${day.date}-h`}
    >
      <header className="day-head">
        <div className="day-head__row">
          <h3 id={`day-${day.date}-h`}>
            {isToday && <span className="day-head__today-pill">Today</span>}
            {day.label}
          </h3>
          <div className="day-head__sun" title="Daylight">
            <span aria-hidden="true">☀</span>
            <span>
              {formatClock(sun.sunrise)} – {formatClock(sun.sunset)}
            </span>
          </div>
        </div>
        <p className="day-recommendation">{recommendation}</p>
        <div className="badge-row">
          {allConflict ? (
            <RecommendationBadge variant="conflict">Nap conflict today</RecommendationBadge>
          ) : anyConflict ? (
            <RecommendationBadge variant="info">Partial nap overlap</RecommendationBadge>
          ) : (
            <RecommendationBadge variant="calm">Nap-friendly</RecommendationBadge>
          )}
        </div>
      </header>

      <TideChart day={day} allDays={allDays} nap={nap} now={isToday ? now : undefined} />

      <dl className="tide-grid">
        <div>
          <dt>High tides</dt>
          <dd>
            {highs.length === 0 && <span className="muted">—</span>}
            {highs.map((h) => (
              <span key={h.time} className="tide-chip tide-high">
                {h.displayTime} · {h.heightFt.toFixed(1)} ft
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>Low tides</dt>
          <dd>
            {lows.length === 0 && <span className="muted">—</span>}
            {lows.map((l) => (
              <span key={l.time} className="tide-chip tide-low">
                {l.displayTime} · {l.heightFt.toFixed(1)} ft
              </span>
            ))}
          </dd>
        </div>
      </dl>

      <div className="window-list">
        {playWindows.map((w) => {
          const conflict = conflictsWithNap(w, napRange);
          return (
            <div key={`play-${w.start.toISOString()}`} className="window-item">
              <div className="window-title">
                <RecommendationBadge variant={conflict ? "conflict" : "play"}>
                  {conflict ? "Nap conflict" : "Best low-tide play"}
                </RecommendationBadge>
                <span className="window-time">{formatWindow(w)}</span>
              </div>
              <p className="window-sub">
                Centered on the {w.tide?.displayTime.toLowerCase()} low (
                {w.tide?.heightFt.toFixed(1)} ft). Lower water often means more
                flat sand and shallow pools for little feet.
              </p>
            </div>
          );
        })}

        {watchWindows.map((w) => (
          <div key={`watch-${w.start.toISOString()}`} className="window-item">
            <div className="window-title">
              <RecommendationBadge variant="watch">
                Possible strand-feeding watch
              </RecommendationBadge>
              <span className="window-time">{formatWindow(w)}</span>
            </div>
            <p className="window-sub">
              Wildlife activity is never guaranteed. Stay back ≥15 yards from
              the waterline and never approach.
            </p>
          </div>
        ))}
      </div>

      {day.notes && day.notes.length > 0 && (
        <ul className="day-notes">
          {day.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
