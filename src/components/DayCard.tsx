import type { DayPlan } from "../data/tides";
import {
  bestDailyRecommendation,
  conflictsWithNap,
  formatWindow,
  lowTidePlayWindow,
  napInterval,
  strandFeedingWatchWindow,
  type NapSettings,
} from "../utils/tideUtils";
import { RecommendationBadge } from "./RecommendationBadge";
import { TideTimeline } from "./TideTimeline";

type Props = {
  day: DayPlan;
  nap: NapSettings;
};

export function DayCard({ day, nap }: Props) {
  const lows = day.tides.filter((t) => t.type === "Low");
  const highs = day.tides.filter((t) => t.type === "High");
  const napRange = napInterval(day.date, nap);

  const playWindows = lows.map((l) => lowTidePlayWindow(day, l));
  const watchWindows = lows.map((l) => strandFeedingWatchWindow(day, l));
  const recommendation = bestDailyRecommendation(day, nap);

  const anyConflict = playWindows.some((w) => conflictsWithNap(w, napRange));
  const allConflict =
    playWindows.length > 0 && playWindows.every((w) => conflictsWithNap(w, napRange));

  return (
    <article className="card day-card" aria-labelledby={`day-${day.date}`}>
      <header className="day-head">
        <h3 id={`day-${day.date}`}>{day.label}</h3>
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

      <TideTimeline day={day} nap={nap} />

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
