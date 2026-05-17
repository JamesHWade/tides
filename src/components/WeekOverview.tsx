import { useMemo } from "react";
import type { DayPlan } from "../data/tides";
import { flattenTides, interpolateHeight, timeOn } from "../utils/tideUtils";
import { sunTimes } from "../utils/sunTimes";

type Props = {
  days: DayPlan[];
  now?: Date;
  onDayClick?: (dateISO: string) => void;
};

const STEP_MIN = 30;
const PAD_TOP = 0.18;
const PAD_BOTTOM = 0.08;
const W = 1000;
const H = 300;

export function WeekOverview({ days, now, onDayClick }: Props) {
  const { points, minH, maxH, start, end, timeline } = useMemo(() => {
    if (days.length === 0) {
      return {
        points: [],
        minH: 0,
        maxH: 1,
        start: new Date(),
        end: new Date(),
        timeline: [],
      };
    }
    const start = timeOn(days[0].date, "00:00");
    const end = new Date(timeOn(days[days.length - 1].date, "00:00").getTime() + 86400000);
    const timeline = flattenTides(days);

    const points: Array<{ t: Date; h: number }> = [];
    for (let t = start.getTime(); t <= end.getTime(); t += STEP_MIN * 60 * 1000) {
      const at = new Date(t);
      const h = interpolateHeight(timeline, at);
      if (h != null) points.push({ t: at, h });
    }

    let minH = Infinity;
    let maxH = -Infinity;
    for (const d of days) {
      for (const ev of d.tides) {
        if (ev.heightFt < minH) minH = ev.heightFt;
        if (ev.heightFt > maxH) maxH = ev.heightFt;
      }
    }
    if (!isFinite(minH)) minH = -1;
    if (!isFinite(maxH)) maxH = 7;
    const pad = (maxH - minH) * 0.18 || 0.5;
    minH -= pad;
    maxH += pad;
    return { points, minH, maxH, start, end, timeline };
  }, [days]);

  const span = end.getTime() - start.getTime();
  const xPct = (t: Date) => ((t.getTime() - start.getTime()) / span) * 100;
  const xFor = (t: Date) => (xPct(t) / 100) * W;
  const yFor = (h: number) =>
    (PAD_TOP + (1 - (h - minH) / (maxH - minH)) * (1 - PAD_TOP - PAD_BOTTOM)) * H;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.t).toFixed(2)} ${yFor(p.h).toFixed(2)}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${xFor(points[points.length - 1].t).toFixed(2)} ${H} L ${xFor(points[0].t).toFixed(2)} ${H} Z`
      : "";

  const nowInTrip =
    now != null && now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
  const nowLeftPct = nowInTrip ? xPct(now!) : null;
  const nowH = nowInTrip ? interpolateHeight(timeline, now!) : null;
  const nowTopPct = nowH != null ? (yFor(nowH) / H) * 100 : null;

  return (
    <div className="week-overview">
      {/* Day headers (HTML for readable text on all screens) */}
      <div className="week-overview__day-strip">
        {days.map((d) => {
          const dayStart = timeOn(d.date, "00:00");
          const dayEnd = new Date(dayStart.getTime() + 86400000);
          const left = xPct(dayStart);
          const width = xPct(dayEnd) - xPct(dayStart);
          const [wk, rest] = d.label.split(",");
          return (
            <button
              type="button"
              key={d.date}
              className="week-overview__day-cell"
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={() => onDayClick?.(d.date)}
              aria-label={`Jump to ${d.label}`}
            >
              <span className="week-overview__day-weekday">{wk.slice(0, 3)}</span>
              <span className="week-overview__day-date">
                {rest?.trim().replace(/^\w+ /, "")}
              </span>
            </button>
          );
        })}
      </div>

      {/* The plot */}
      <div className="week-overview__plot">
        {/* Daylight tints, one per day */}
        {days.map((d) => {
          const sun = sunTimes(d.date);
          const left = xPct(sun.sunrise);
          const right = xPct(sun.sunset);
          if (right <= left) return null;
          return (
            <div
              key={`sun-${d.date}`}
              className="week-overview__daylight"
              style={{ left: `${left}%`, width: `${right - left}%` }}
              aria-hidden="true"
            />
          );
        })}

        {/* Day separator lines */}
        {days.slice(1).map((d) => {
          const dayStart = timeOn(d.date, "00:00");
          const left = xPct(dayStart);
          return (
            <div
              key={`sep-${d.date}`}
              className="week-overview__day-sep"
              style={{ left: `${left}%` }}
              aria-hidden="true"
            />
          );
        })}

        <svg
          className="week-overview__svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Tide curve for the full trip"
        >
          <defs>
            <linearGradient id="ow-water" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7cc4e2" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#357f97" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#114a5e" />
            </linearGradient>
          </defs>

          {areaPath && <path d={areaPath} fill="url(#ow-water)" opacity="0.92" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#0f4a5e"
              strokeOpacity="0.55"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Tide extrema dots */}
        {days.flatMap((d) =>
          d.tides.map((ev) => {
            const at = timeOn(d.date, ev.time);
            const left = xPct(at);
            const top = (yFor(ev.heightFt) / H) * 100;
            const isHigh = ev.type === "High";
            return (
              <div
                key={`${d.date}-${ev.time}`}
                className={`week-overview__dot week-overview__dot--${isHigh ? "high" : "low"}`}
                style={{ left: `${left}%`, top: `${top}%` }}
                title={`${ev.type} ${ev.displayTime} · ${ev.heightFt.toFixed(1)} ft`}
              />
            );
          }),
        )}

        {/* Now marker */}
        {nowLeftPct != null && nowTopPct != null && (
          <>
            <div
              className="week-overview__now-line"
              style={{ left: `${nowLeftPct}%` }}
              aria-hidden="true"
            />
            <div
              className="week-overview__now-dot"
              style={{ left: `${nowLeftPct}%`, top: `${nowTopPct}%` }}
              aria-hidden="true"
            />
            <div
              className="week-overview__now-badge"
              style={{ left: `${nowLeftPct}%` }}
            >
              NOW
            </div>
          </>
        )}
      </div>
    </div>
  );
}
