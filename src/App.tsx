import { useEffect, useMemo, useState } from "react";
import { DATA_GENERATED_AT, DATA_VERIFIED, STATION, TRIP_RANGE } from "./data/tides";
import {
  DEFAULT_NAP,
  type NapSettings,
  dateISOOf,
  nowInStationTZ,
} from "./utils/tideUtils";
import { Header } from "./components/Header";
import { NapSettingsCard } from "./components/NapSettings";
import { DayCard } from "./components/DayCard";
import { StrandFeedingPanel } from "./components/StrandFeedingPanel";
import { WeekOverview } from "./components/WeekOverview";
import { TripStatus } from "./components/TripStatus";
import { DayNav } from "./components/DayNav";
import { DateRangePicker } from "./components/DateRangePicker";
import { useDateRange } from "./hooks/useDateRange";
import { useTideDays } from "./hooks/useTideDays";
import { useWeather } from "./hooks/useWeather";

const NAP_STORAGE_KEY = "tides.nap.v1";

function loadNap(): NapSettings {
  try {
    const raw = localStorage.getItem(NAP_STORAGE_KEY);
    if (!raw) return DEFAULT_NAP;
    const parsed = JSON.parse(raw) as Partial<NapSettings>;
    if (typeof parsed.napStart === "string" && typeof parsed.napEnd === "string") {
      return { napStart: parsed.napStart, napEnd: parsed.napEnd };
    }
    return DEFAULT_NAP;
  } catch {
    return DEFAULT_NAP;
  }
}

function dateInRangeISO(now: Date, startISO: string, endISO: string): string | null {
  const iso = dateISOOf(now);
  if (iso < startISO || iso > endISO) return null;
  return iso;
}

function scrollToDay(dateISO: string) {
  const el = document.getElementById(`day-${dateISO}`);
  if (!el) return;
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  el.classList.add("day-card--flash");
  window.setTimeout(() => el.classList.remove("day-card--flash"), 1200);
}

function rangeLabel(startISO: string, endISO: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const yearFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" });
  const s = new Date(startISO + "T12:00:00Z");
  const e = new Date(endISO + "T12:00:00Z");
  if (startISO === endISO) return `${fmt.format(s)}, ${yearFmt.format(s)}`;
  if (s.getUTCFullYear() === e.getUTCFullYear()) {
    return `${fmt.format(s)} – ${fmt.format(e)}, ${yearFmt.format(s)}`;
  }
  return `${fmt.format(s)}, ${yearFmt.format(s)} – ${fmt.format(e)}, ${yearFmt.format(e)}`;
}

export default function App() {
  const [nap, setNap] = useState<NapSettings>(() => loadNap());
  const [now, setNow] = useState<Date>(() => nowInStationTZ());
  const { range, setRange, resetToTrip } = useDateRange();
  const { days, status, error, snapshotCoverage } = useTideDays(range);
  const weather = useWeather();

  useEffect(() => {
    try {
      localStorage.setItem(NAP_STORAGE_KEY, JSON.stringify(nap));
    } catch {
      // Ignore storage failures (private mode, quota, etc.).
    }
  }, [nap]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(nowInStationTZ()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const todayISO = dateInRangeISO(now, range.startISO, range.endISO);
  const titleRange = useMemo(
    () => rangeLabel(range.startISO, range.endISO),
    [range.startISO, range.endISO],
  );

  const statusLine: React.ReactNode = (() => {
    if (status === "loading") return "⏳ Fetching tides…";
    if (status === "error") return `⚠ ${error ?? "Tide fetch failed"}`;
    if (snapshotCoverage === 1) return "✓ Snapshot covers this range";
    if (snapshotCoverage > 0) return "✓ Mixed snapshot + live fetch";
    return "✓ Live NOAA fetch";
  })();

  return (
    <div className="app">
      <Header range={range} />

      <main className="container">
        <TripStatus days={days} now={now} range={range} />

        <DateRangePicker
          value={range}
          isTrip={range.isTrip}
          onChange={setRange}
          onReset={resetToTrip}
          statusLine={statusLine}
        />

        <section className="card overview-card" aria-labelledby="overview-heading">
          <div className="card-head">
            <h2 id="overview-heading">The whole range at a glance</h2>
            <p className="card-sub">
              Tap a day to jump to its details. Dark dots = highs, gold dots = lows.
              Gold band = daylight; pink dot = right now.
            </p>
          </div>
          <WeekOverview days={days} now={now} onDayClick={scrollToDay} />
          <div className="overview-legend" aria-hidden="true">
            <span className="legend-swatch legend-water" /> Water level
            <span className="legend-swatch legend-day" /> Daylight
            <span className="legend-swatch legend-high" /> High tide
            <span className="legend-swatch legend-low" /> Low tide
            <span className="legend-swatch legend-now" /> Now
          </div>
        </section>

        <DayNav days={days} todayISO={todayISO} />

        <NapSettingsCard value={nap} onChange={setNap} />

        <section aria-labelledby="days-heading">
          <h2 id="days-heading" className="section-title">
            Daily tide plan · {titleRange}
          </h2>
          <div className="day-grid">
            {days.map((day) => (
              <DayCard
                key={day.date}
                day={day}
                allDays={days}
                nap={nap}
                weather={weather.byDate.get(day.date)}
                now={now}
                isToday={day.date === todayISO}
              />
            ))}
          </div>
        </section>

        <StrandFeedingPanel />

        <footer className="site-footer">
          <p>
            Tide source: <strong>{STATION.name}</strong> (NOAA station{" "}
            <a
              href={`https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=${STATION.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {STATION.id}
            </a>
            ), datum {STATION.datum}.
          </p>
          <p className="muted">
            Forecast:{" "}
            <a href="https://www.weather.gov/chs/" target="_blank" rel="noreferrer">
              NOAA / NWS Charleston
            </a>
            {weather.liveAt && (
              <>
                {" · refreshed "}
                <time dateTime={weather.liveAt}>
                  {new Date(weather.liveAt).toLocaleTimeString()}
                </time>
              </>
            )}
            {!weather.liveAt && weather.snapshotAt && (
              <>
                {" · snapshot "}
                <time dateTime={weather.snapshotAt}>
                  {new Date(weather.snapshotAt).toLocaleString()}
                </time>
              </>
            )}
            .
          </p>
          {DATA_VERIFIED && DATA_GENERATED_AT && range.isTrip && (
            <p className="muted">
              Trip tides snapshot fetched from NOAA on{" "}
              <time dateTime={DATA_GENERATED_AT}>
                {new Date(DATA_GENERATED_AT).toLocaleString()}
              </time>
              .
            </p>
          )}
          <p className="muted">
            Built for a family beach week. Default trip range: {TRIP_RANGE.label}. Not a
            substitute for posted local guidance, lifeguards, or NOAA marine forecasts.
          </p>
        </footer>
      </main>
    </div>
  );
}
