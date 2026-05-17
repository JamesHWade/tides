import { useMemo } from "react";
import type { DayPlan } from "../data/tides";
import {
  type NapSettings,
  type TidePoint,
  flattenTides,
  interpolateHeight,
  napInterval,
  timeOn,
} from "../utils/tideUtils";
import { sunTimes } from "../utils/sunTimes";

type Props = {
  day: DayPlan;
  /** Full week timeline for smooth edge interpolation. */
  allDays: DayPlan[];
  nap: NapSettings;
  /** Optional "now" — drawn as a vertical marker if within this day. */
  now?: Date;
};

const STEP_MIN = 10;
const PAD_TOP = 0.08; // fraction of height
const PAD_BOTTOM = 0.08;

export function TideChart({ day, allDays, nap, now }: Props) {
  // Internal SVG coordinate space (kept simple; aspect ratio handled via CSS).
  const W = 1000;
  const H = 240;

  const { points, minH, maxH, dayStart, dayEnd, timeline } = useMemo(() => {
    const timeline = flattenTides(allDays);
    const dayStart = timeOn(day.date, "00:00");
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const points: TidePoint[] = [];
    for (let t = dayStart.getTime(); t <= dayEnd.getTime(); t += STEP_MIN * 60 * 1000) {
      const at = new Date(t);
      const h = interpolateHeight(timeline, at);
      if (h != null) points.push({ time: at, heightFt: h, type: "High" });
    }

    let minH = Infinity;
    let maxH = -Infinity;
    for (const d of allDays) {
      for (const ev of d.tides) {
        if (ev.heightFt < minH) minH = ev.heightFt;
        if (ev.heightFt > maxH) maxH = ev.heightFt;
      }
    }
    if (!isFinite(minH)) minH = -1;
    if (!isFinite(maxH)) maxH = 7;
    const pad = (maxH - minH) * 0.15 || 0.5;
    minH -= pad;
    maxH += pad;

    return { points, minH, maxH, dayStart, dayEnd, timeline };
  }, [day.date, allDays]);

  const spanMs = dayEnd.getTime() - dayStart.getTime();
  const xPct = (t: Date) => ((t.getTime() - dayStart.getTime()) / spanMs) * 100;
  const xFor = (t: Date) => (xPct(t) / 100) * W;
  const yFor = (h: number) => (PAD_TOP + (1 - (h - minH) / (maxH - minH)) * (1 - PAD_TOP - PAD_BOTTOM)) * H;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.time).toFixed(2)} ${yFor(p.heightFt).toFixed(2)}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${xFor(points[points.length - 1].time).toFixed(2)} ${H} L ${xFor(points[0].time).toFixed(2)} ${H} Z`
      : "";

  const nap_ = napInterval(day.date, nap);
  const napLeftPct = xPct(nap_.start);
  const napWidthPct = xPct(nap_.end) - xPct(nap_.start);

  const sun = sunTimes(day.date);
  const dayLeftPct = (sun.sunriseHours / 24) * 100;
  const dayRightPct = (sun.sunsetHours / 24) * 100;

  const nowInDay =
    now != null && now.getTime() >= dayStart.getTime() && now.getTime() <= dayEnd.getTime();
  const nowLeftPct = nowInDay ? xPct(now!) : null;
  const nowH = nowInDay ? interpolateHeight(timeline, now!) : null;
  const nowTopPct = nowH != null ? (yFor(nowH) / H) * 100 : null;

  const uid = day.date.replace(/-/g, "");
  const hourLines = [3, 6, 9, 12, 15, 18, 21];

  return (
    <figure className="tide-chart" aria-label={`Tide curve for ${day.label}`}>
      <div className="tide-chart__plot">
        {/* Daylight band */}
        {dayRightPct > dayLeftPct && (
          <div
            className="tide-chart__daylight"
            style={{ left: `${dayLeftPct}%`, width: `${dayRightPct - dayLeftPct}%` }}
            aria-hidden="true"
          />
        )}

        {/* Nap shading */}
        {napWidthPct > 0 && (
          <div
            className="tide-chart__nap"
            style={{ left: `${napLeftPct}%`, width: `${napWidthPct}%` }}
            aria-hidden="true"
            title={`Nap ${nap.napStart}–${nap.napEnd}`}
          />
        )}

        {/* The SVG curve */}
        <svg
          className="tide-chart__svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`water-${uid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7cc4e2" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#3a8fa8" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#1f6f8b" />
            </linearGradient>
          </defs>

          {/* Hour gridlines */}
          {hourLines.map((h) => {
            const x = (h / 24) * W;
            return (
              <line
                key={h}
                x1={x}
                x2={x}
                y1={0}
                y2={H}
                stroke="rgba(31,111,139,0.10)"
                strokeWidth="1"
                strokeDasharray="3 6"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* Mid-line reference */}
          <line
            x1={0}
            x2={W}
            y1={H / 2}
            y2={H / 2}
            stroke="rgba(31,111,139,0.08)"
            vectorEffect="non-scaling-stroke"
          />

          {areaPath && <path d={areaPath} fill={`url(#water-${uid})`} opacity="0.92" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#0f4a5e"
              strokeOpacity="0.6"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Tide-extreme dots and labels (HTML so they stay readable on mobile) */}
        {day.tides.map((tide) => {
          const at = timeOn(day.date, tide.time);
          const leftPct = xPct(at);
          const topPct = (yFor(tide.heightFt) / H) * 100;
          const isHigh = tide.type === "High";
          return (
            <div
              key={tide.time}
              className={`tide-chart__marker tide-chart__marker--${tide.type.toLowerCase()}`}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            >
              <span className="tide-chart__dot" />
              <span
                className={`tide-chart__label tide-chart__label--${isHigh ? "above" : "below"}`}
              >
                <span className="tide-chart__label-type">{isHigh ? "H" : "L"}</span>{" "}
                {tide.displayTime.replace(/\s?[AP]M$/, (s) => s.trim().toLowerCase())}
                <span className="tide-chart__label-height"> · {tide.heightFt.toFixed(1)}ft</span>
              </span>
            </div>
          );
        })}

        {/* NOW marker */}
        {nowLeftPct != null && nowTopPct != null && (
          <>
            <div
              className="tide-chart__now-line"
              style={{ left: `${nowLeftPct}%` }}
              aria-hidden="true"
            />
            <div
              className="tide-chart__now-dot"
              style={{ left: `${nowLeftPct}%`, top: `${nowTopPct}%` }}
              aria-hidden="true"
            />
            <div
              className="tide-chart__now-badge"
              style={{ left: `${nowLeftPct}%` }}
              aria-label="Now"
            >
              NOW
            </div>
          </>
        )}
      </div>

      {/* Axis */}
      <div className="tide-chart__axis" aria-hidden="true">
        <span>12a</span>
        <span>6a</span>
        <span>noon</span>
        <span>6p</span>
        <span>12a</span>
      </div>

      <figcaption className="visually-hidden">
        {day.tides.map((t) => `${t.type} ${t.displayTime} ${t.heightFt.toFixed(1)} ft`).join("; ")}
        {". "}
        Sunrise {sun.sunriseLabel}, sunset {sun.sunsetLabel}.
      </figcaption>
    </figure>
  );
}
