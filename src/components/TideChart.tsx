import { useEffect, useMemo, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";
import type { DayPlan } from "../data/tides";
import {
  type NapSettings,
  flattenTides,
  formatClock,
  interpolateHeight,
  napInterval,
  timeOn,
} from "../utils/tideUtils";
import { sunTimes } from "../utils/sunTimes";

type Props = {
  day: DayPlan;
  allDays: DayPlan[];
  nap: NapSettings;
  now?: Date;
};

const STEP_MIN = 10;

type Sample = { time: Date; heightFt: number };

// Chart geometry — must be kept in sync with Plot's margin/size config below
// because the "now" overlay positions itself in the same pixel space.
const MARGIN_LEFT = 36;
const MARGIN_RIGHT = 14;
const MARGIN_TOP = 26;
const NARROW_BREAK = 480;

function chartHeight(w: number) {
  return w < NARROW_BREAK ? 200 : 240;
}

function marginBottom(w: number) {
  return w < NARROW_BREAK ? 36 : 30;
}

export function TideChart({ day, allDays, nap, now }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // The Plot's data — intentionally does NOT depend on `now`. The "now"
  // overlay is rendered as positioned divs over the chart so the Plot is
  // only rebuilt when its underlying data changes, not on the per-minute
  // tick from App.
  const { points, dayStart, dayEnd, minH, maxH, timeline } = useMemo(() => {
    const timeline = flattenTides(allDays);
    const dayStart = timeOn(day.date, "00:00");
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const points: Sample[] = [];
    for (let t = dayStart.getTime(); t <= dayEnd.getTime(); t += STEP_MIN * 60 * 1000) {
      const at = new Date(t);
      const h = interpolateHeight(timeline, at);
      if (h != null) points.push({ time: at, heightFt: h });
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

    return { points, dayStart, dayEnd, minH, maxH, timeline };
  }, [day.date, allDays]);

  const sun = useMemo(() => sunTimes(day.date), [day.date]);
  const napRange = useMemo(
    () => napInterval(day.date, nap),
    [day.date, nap.napStart, nap.napEnd],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = width || el.clientWidth || 600;
    const isNarrow = w < NARROW_BREAK;
    const height = chartHeight(w);

    const tideMarkers = day.tides.map((t) => ({
      time: timeOn(day.date, t.time),
      heightFt: t.heightFt,
      type: t.type,
      label: `${t.type === "High" ? "H" : "L"} ${shortTime(t.displayTime)}${
        isNarrow ? "" : ` · ${t.heightFt.toFixed(1)}ft`
      }`,
    }));

    const napOverlap =
      napRange.start.getTime() < dayEnd.getTime() &&
      napRange.end.getTime() > dayStart.getTime();

    const sunOverlap =
      sun.sunrise.getTime() < dayEnd.getTime() &&
      sun.sunset.getTime() > dayStart.getTime();

    const plot = Plot.plot({
      width: w,
      height,
      marginTop: MARGIN_TOP,
      marginBottom: marginBottom(w),
      marginLeft: MARGIN_LEFT,
      marginRight: MARGIN_RIGHT,
      style: {
        background: "transparent",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: isNarrow ? "10px" : "11px",
        color: "#3b5663",
        overflow: "visible",
      },
      x: {
        // `type: "utc"` is intentional — the codebase stores Eastern wall-clock
        // moments in the UTC fields of a Date (see the convention at the top
        // of utils/tideUtils.ts). Plot reading them in UTC keeps the axis and
        // marks aligned. Do NOT change this to a real timezone or every tick
        // shifts by 4–5 hours.
        type: "utc",
        domain: [dayStart, dayEnd],
        tickFormat: (d: Date) => formatHour(d),
        ticks: isNarrow ? 4 : 8,
        label: null,
      },
      y: {
        domain: [minH, maxH],
        label: "ft (MLLW)",
        labelAnchor: "top",
        ticks: 4,
        tickFormat: (d: number) => d.toFixed(0),
        grid: true,
      },
      marks: [
        sunOverlap
          ? Plot.rect([{ start: sun.sunrise, end: sun.sunset }], {
              x1: "start",
              x2: "end",
              y1: minH,
              y2: maxH,
              fill: "#ffd28a",
              fillOpacity: 0.18,
            })
          : null,
        napOverlap
          ? Plot.rect([{ start: napRange.start, end: napRange.end }], {
              x1: "start",
              x2: "end",
              y1: minH,
              y2: maxH,
              fill: "#b03a2e",
              fillOpacity: 0.08,
              stroke: "#b03a2e",
              strokeOpacity: 0.4,
              strokeDasharray: "3,3",
            })
          : null,
        Plot.areaY(points, {
          x: "time",
          y: "heightFt",
          fill: "#7cc4e2",
          fillOpacity: 0.55,
          curve: "natural",
        }),
        Plot.lineY(points, {
          x: "time",
          y: "heightFt",
          stroke: "#0f4a5e",
          strokeWidth: 1.6,
          curve: "natural",
        }),
        Plot.ruleY([0], { stroke: "#0f4a5e", strokeOpacity: 0.12 }),
        Plot.dot(tideMarkers, {
          x: "time",
          y: "heightFt",
          r: 5,
          fill: (d: { type: string }) => (d.type === "High" ? "#0f4a5e" : "#ffc857"),
          stroke: "#fff",
          strokeWidth: 1.5,
        }),
        Plot.text(
          tideMarkers.filter((d) => d.type === "High"),
          {
            x: "time",
            y: "heightFt",
            text: "label",
            dy: -14,
            fontSize: isNarrow ? 9 : 10,
            fontWeight: 600,
            fill: "#0f4a5e",
            stroke: "white",
            strokeWidth: 3,
            paintOrder: "stroke",
          },
        ),
        Plot.text(
          tideMarkers.filter((d) => d.type === "Low"),
          {
            x: "time",
            y: "heightFt",
            text: "label",
            dy: 16,
            fontSize: isNarrow ? 9 : 10,
            fontWeight: 600,
            fill: "#7a5b00",
            stroke: "white",
            strokeWidth: 3,
            paintOrder: "stroke",
          },
        ),
      ].filter(Boolean) as Plot.Markish[],
    });

    el.replaceChildren(plot);
    return () => {
      plot.remove();
    };
  }, [day, points, dayStart, dayEnd, minH, maxH, napRange, sun, width]);

  // Re-render on resize so axes/labels reflow on rotation.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (!w) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(Math.round(w)));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // "Now" overlay positions, in pixels matching the Plot's coordinate system.
  // Recomputing this each render is cheap; only the overlay re-renders on the
  // per-minute tick, not the whole Plot.
  const nowOverlay = useMemo(() => {
    if (!now) return null;
    if (now.getTime() < dayStart.getTime() || now.getTime() > dayEnd.getTime()) return null;
    const w = width || 600;
    const h = chartHeight(w);
    const mBottom = marginBottom(w);
    const innerW = w - MARGIN_LEFT - MARGIN_RIGHT;
    const innerH = h - MARGIN_TOP - mBottom;
    const span = dayEnd.getTime() - dayStart.getTime();
    const x = MARGIN_LEFT + ((now.getTime() - dayStart.getTime()) / span) * innerW;
    const nowH = interpolateHeight(timeline, now);
    const yFor = (val: number) =>
      MARGIN_TOP + (1 - (val - minH) / (maxH - minH)) * innerH;
    const dotY = nowH != null ? yFor(nowH) : null;
    return { x, dotY, lineTop: MARGIN_TOP, lineHeight: innerH, plotHeight: h };
  }, [now, dayStart, dayEnd, minH, maxH, timeline, width]);

  return (
    <figure className="tide-chart" aria-label={`Tide curve for ${day.label}`}>
      <div className="tide-chart__plot-wrap">
        <div ref={containerRef} className="tide-chart__plot" />
        {nowOverlay && (
          <>
            <div
              className="tide-chart__now-line"
              style={{
                left: `${nowOverlay.x}px`,
                top: `${nowOverlay.lineTop}px`,
                height: `${nowOverlay.lineHeight}px`,
              }}
              aria-hidden="true"
            />
            {nowOverlay.dotY != null && (
              <div
                className="tide-chart__now-dot"
                style={{ left: `${nowOverlay.x}px`, top: `${nowOverlay.dotY}px` }}
                aria-hidden="true"
              />
            )}
            <div
              className="tide-chart__now-badge"
              style={{ left: `${nowOverlay.x}px`, top: `${nowOverlay.lineTop - 14}px` }}
              aria-label="Now"
            >
              NOW
            </div>
          </>
        )}
      </div>
      <figcaption className="visually-hidden">
        {day.tides.map((t) => `${t.type} ${t.displayTime} ${t.heightFt.toFixed(1)} ft`).join("; ")}
        {". "}
        Sunrise {formatClock(sun.sunrise)}, sunset {formatClock(sun.sunset)}.
      </figcaption>
    </figure>
  );
}

function shortTime(displayTime: string): string {
  return displayTime.replace(/\s?[AP]M$/, (s) => s.trim().toLowerCase());
}

function formatHour(d: Date): string {
  const h = d.getUTCHours();
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  if (h < 12) return `${h}a`;
  return `${h - 12}p`;
}
