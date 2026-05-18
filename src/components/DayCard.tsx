import type { DayPlan } from "../data/tides";
import {
  bestDailyRecommendation,
  clipWindowsToFamilyHours,
  conflictsWithNap,
  formatClock,
  formatWindow,
  goodBeachWindows,
  napInterval,
  timeOn,
  type NapSettings,
} from "../utils/tideUtils";
import { sunTimes } from "../utils/sunTimes";
import { RecommendationBadge } from "./RecommendationBadge";
import { TideChart } from "./TideChart";
import { WeatherSummary } from "./WeatherSummary";
import { StrandScoreCard } from "./StrandScoreCard";
import { FamilyScheduleCard } from "./FamilyScheduleCard";
import { scoreStrandDay } from "../utils/strandScore";
import { optimizeDaySchedule } from "../utils/scheduleOptimizer";
import type { DayWeather } from "../utils/runtimeWeather";
import type { AccessSettings } from "../hooks/useAccessSettings";
import type { HouseholdPace } from "../hooks/useHouseholdPace";
import type { CustomEvent } from "../utils/customEvents";

type Props = {
  day: DayPlan;
  allDays: DayPlan[];
  nap: NapSettings;
  pace: HouseholdPace;
  weather?: DayWeather;
  access: AccessSettings;
  customEvents?: CustomEvent[];
  now?: Date;
  isToday?: boolean;
};

export function DayCard({
  day,
  allDays,
  nap,
  pace,
  weather,
  access,
  customEvents,
  now,
  isToday,
}: Props) {
  const lows = day.tides.filter((t) => t.type === "Low");
  const highs = day.tides.filter((t) => t.type === "High");
  const napRange = napInterval(day.date, nap);

  const sun = sunTimes(day.date);
  // Beach time is good anywhere except ±90 min around high tide. Clip those
  // raw daylight windows to the family's "out the door → done" hours so the
  // displayed windows match what the optimizer actually schedules.
  const familyStart = timeOn(day.date, pace.earliestStart);
  const familyEnd = timeOn(day.date, pace.latestEnd);
  const playWindows = clipWindowsToFamilyHours(
    goodBeachWindows(day, sun, 90),
    familyStart,
    familyEnd,
  );
  const recommendation = bestDailyRecommendation(day, nap, sun, pace);

  const anyConflict = playWindows.some((w) => conflictsWithNap(w, napRange));
  const allConflict =
    playWindows.length > 0 && playWindows.every((w) => conflictsWithNap(w, napRange));

  const strand = scoreStrandDay(day, weather);
  const schedule = optimizeDaySchedule({
    day,
    allDays,
    nap,
    weather,
    access,
    pace,
    customEvents,
    now,
  });

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

        {weather ? (
          <WeatherSummary weather={weather} />
        ) : (
          <p className="day-card__no-weather muted">
            No NWS forecast for this date yet · published ~7 days ahead.
          </p>
        )}

        <p className="day-recommendation">{recommendation}</p>
        <div className="badge-row">
          {playWindows.length === 0 ? (
            <RecommendationBadge variant="info">
              Beach time is tight today
            </RecommendationBadge>
          ) : allConflict ? (
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
          const nearLow = w.tide != null;
          const badgeLabel = conflict
            ? "Nap conflict"
            : nearLow
              ? "Best low-tide play"
              : "Good beach time";
          return (
            <div key={`play-${w.start.toISOString()}`} className="window-item">
              <div className="window-title">
                <RecommendationBadge variant={conflict ? "conflict" : "play"}>
                  {badgeLabel}
                </RecommendationBadge>
                <span className="window-time">{formatWindow(w)}</span>
              </div>
              <p className="window-sub">
                {nearLow
                  ? `Anchored on the ${w.tide?.displayTime.toLowerCase()} low (${w.tide?.heightFt.toFixed(1)} ft). Flat sand and shallow pools for little feet.`
                  : "Well away from the day's high-tide bands — the wet-sand strip is workable even without a nearby low."}
              </p>
            </div>
          );
        })}

        <StrandScoreCard score={strand} />
      </div>

      <FamilyScheduleCard schedule={schedule} />

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
