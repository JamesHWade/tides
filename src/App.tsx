import { useEffect, useMemo, useState } from "react";
import { DATA_GENERATED_AT, DATA_VERIFIED, STATION, TRIP_RANGE } from "./data/tides";
import {
  DEFAULT_NAP,
  type NapSettings,
  dateISOOf,
  nowInStationTZ,
} from "./utils/tideUtils";
import { optimizeDaySchedule, pickBestDays } from "./utils/scheduleOptimizer";
import { Header } from "./components/Header";
import { NapSettingsCard } from "./components/NapSettings";
import { AccessSettingsCard } from "./components/AccessSettings";
import { BestDaySummary } from "./components/BestDaySummary";
import { CustomEventsCard } from "./components/CustomEventsCard";
import { DayCard } from "./components/DayCard";
import { StrandFeedingPanel } from "./components/StrandFeedingPanel";
import { WildlifeSeasonCard } from "./components/WildlifeSeasonCard";
import { WeekOverview } from "./components/WeekOverview";
import { TripStatus } from "./components/TripStatus";
import { DayNav } from "./components/DayNav";
import { DateRangePicker } from "./components/DateRangePicker";
import { useAccessSettings } from "./hooks/useAccessSettings";
import { useCustomEvents } from "./hooks/useCustomEvents";
import { useDateRange } from "./hooks/useDateRange";
import { useHouseholdPace } from "./hooks/useHouseholdPace";
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

function noonUtc(dateISO: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12));
}

function rangeLabel(startISO: string, endISO: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const yearFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" });
  const s = noonUtc(startISO);
  const e = noonUtc(endISO);
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
  const {
    days,
    status,
    error,
    snapshotCoverage,
    placeholderCoverage,
    fetchedCoverage,
  } = useTideDays(range);
  const weather = useWeather();
  const [access, setAccess] = useAccessSettings();
  const [pace, setPace] = useHouseholdPace();
  const [customEvents, setCustomEvents] = useCustomEvents();

  const bestDays = useMemo(() => {
    if (days.length === 0) return {};
    const schedules = days.map((d) =>
      optimizeDaySchedule({
        day: d,
        allDays: days,
        nap,
        weather: weather.byDate.get(d.date),
        access,
        pace,
        customEvents,
        now,
      }),
    );
    // For the "best public-only day" pick, score a parallel set of schedules
    // computed as if preferPublicOnly were on — fallback list length alone is
    // a fixed-size set and not informative.
    const publicOnlyAccess = { ...access, preferPublicOnly: true };
    const publicOnly = days.map((d) =>
      optimizeDaySchedule({
        day: d,
        allDays: days,
        nap,
        weather: weather.byDate.get(d.date),
        access: publicOnlyAccess,
        pace,
        customEvents,
        now,
      }),
    );
    return pickBestDays(schedules, publicOnly);
  }, [days, nap, pace, weather.byDate, access, customEvents, now]);

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
  const todayDay = useMemo(
    () => (todayISO ? days.find((d) => d.date === todayISO) ?? null : null),
    [days, todayISO],
  );
  const otherDays = useMemo(
    () => days.filter((d) => d.date !== todayISO),
    [days, todayISO],
  );
  const titleRange = useMemo(
    () => rangeLabel(range.startISO, range.endISO),
    [range.startISO, range.endISO],
  );

  const statusLine: React.ReactNode = (() => {
    if (status === "loading") return "⏳ Fetching tides…";
    if (status === "error") return `⚠ ${error ?? "Tide fetch failed"}`;
    if (placeholderCoverage === 1) {
      return "⚠ Placeholder pattern only — run `npm run fetch-tides`";
    }
    if (snapshotCoverage === 1) return "✓ NOAA snapshot covers this range";
    if (snapshotCoverage > 0 && fetchedCoverage > 0) {
      return "✓ Snapshot + live NOAA fetch";
    }
    if (placeholderCoverage > 0 && fetchedCoverage > 0) {
      return "✓ Placeholder + live NOAA fetch";
    }
    if (snapshotCoverage > 0) return "✓ NOAA snapshot (partial)";
    if (fetchedCoverage > 0) return "✓ Live NOAA fetch";
    return "—";
  })();

  return (
    <div className="app">
      <Header range={range} />

      <main className="container">
        <TripStatus days={days} now={now} range={range} />

        {todayDay && (
          <section className="today-section" aria-label="Today">
            <DayCard
              day={todayDay}
              allDays={days}
              nap={nap}
              pace={pace}
              weather={weather.byDate.get(todayDay.date)}
              access={access}
              customEvents={customEvents}
              now={now}
              isToday
            />
          </section>
        )}

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

        <BestDaySummary best={bestDays} onJump={scrollToDay} />

        <WildlifeSeasonCard startISO={range.startISO} endISO={range.endISO} />

        <NapSettingsCard
          nap={nap}
          pace={pace}
          onNapChange={setNap}
          onPaceChange={setPace}
        />

        <CustomEventsCard
          events={customEvents}
          onChange={setCustomEvents}
          startISO={range.startISO}
          endISO={range.endISO}
        />

        <AccessSettingsCard value={access} onChange={setAccess} />

        {otherDays.length > 0 && (
          <section aria-labelledby="days-heading">
            <h2 id="days-heading" className="section-title">
              Daily tide plan · {titleRange}
            </h2>
            <div className="day-grid">
              {otherDays.map((day) => (
                <DayCard
                  key={day.date}
                  day={day}
                  allDays={days}
                  nap={nap}
                  pace={pace}
                  weather={weather.byDate.get(day.date)}
                  access={access}
                  customEvents={customEvents}
                  now={now}
                  isToday={false}
                />
              ))}
            </div>
          </section>
        )}

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
            {weather.status === "stale" && (
              <> · ⚠ live refresh failed, showing cached forecast</>
            )}
            {weather.status === "error" && (
              <> · ⚠ forecast unavailable</>
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
