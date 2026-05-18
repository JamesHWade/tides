import { useMemo } from "react";
import { activityById } from "../data/activities";
import type { DaySchedule, ScheduleBlock } from "../utils/scheduleOptimizer";
import { formatClock } from "../utils/tideUtils";

type Props = { schedule: DaySchedule };

const KIND_LABEL: Record<ScheduleBlock["kind"], string> = {
  fixed: "Anchor",
  tide: "Tide",
  strand: "Strand",
  activity: "Plan",
  fallback: "Public",
};

const KIND_CLASS: Record<ScheduleBlock["kind"], string> = {
  fixed: "schedule-block--fixed",
  tide: "schedule-block--tide",
  strand: "schedule-block--strand",
  activity: "schedule-block--activity",
  fallback: "schedule-block--fallback",
};

export function FamilyScheduleCard({ schedule }: Props) {
  const visibleBlocks = useMemo(() => schedule.blocks.slice(0, 5), [schedule.blocks]);

  const gatedSample = useMemo(() => {
    return schedule.skipped
      .map((s) => activityById(s.activityId))
      .filter((a): a is NonNullable<typeof a> => a != null)
      .slice(0, 3);
  }, [schedule.skipped]);

  return (
    <section className="schedule-card" aria-label="Family schedule">
      <header className="schedule-card__head">
        <strong className="schedule-card__title">Best plan with your access</strong>
        <span className="schedule-card__headline">{schedule.headline}</span>
      </header>

      <ol className="schedule-blocks">
        {visibleBlocks.map((b) => (
          <li
            key={b.id}
            className={`schedule-block ${KIND_CLASS[b.kind]}`}
          >
            <div className="schedule-block__time">
              <span className="schedule-block__kind">{KIND_LABEL[b.kind]}</span>
              <time>
                {formatClock(b.start)} – {formatClock(b.end)}
              </time>
            </div>
            <div className="schedule-block__body">
              <strong>{b.label}</strong>
              <p>{b.reason}</p>
              {b.warnings && b.warnings.length > 0 && (
                <ul className="schedule-block__warn">
                  {b.warnings.map((w) => (
                    <li key={w}>
                      <span aria-hidden="true">⚠ </span>
                      <span className="visually-hidden">Warning: </span>
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>

      {schedule.publicFallback.length > 0 && (
        <p className="schedule-card__public">
          <span aria-hidden="true">🌳</span> Public fallback:{" "}
          {schedule.publicFallback.map((b) => b.label).join(" · ")}
        </p>
      )}

      {schedule.hiddenAreasNote && (
        <p className="schedule-card__hidden">
          Not shown because access is off: {schedule.hiddenAreasNote}
        </p>
      )}

      {gatedSample.length > 0 && (
        <details className="schedule-card__gated">
          <summary>Available if you have access ({schedule.skipped.length})</summary>
          <ul>
            {gatedSample.map((a) => (
              <li key={a.id}>
                <strong>{a.name}</strong>
                {a.plannerNotes && a.plannerNotes[0] && (
                  <> — <span className="muted">{a.plannerNotes[0]}</span></>
                )}
              </li>
            ))}
            {schedule.skipped.length > gatedSample.length && (
              <li className="muted">
                …and {schedule.skipped.length - gatedSample.length} more.
              </li>
            )}
          </ul>
        </details>
      )}
    </section>
  );
}
