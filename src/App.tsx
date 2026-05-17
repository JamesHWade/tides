import { useEffect, useState } from "react";
import { DATA_GENERATED_AT, DATA_VERIFIED, STATION, tideDays, TRIP_RANGE } from "./data/tides";
import { DEFAULT_NAP, type NapSettings, timeOn } from "./utils/tideUtils";
import { Header } from "./components/Header";
import { NapSettingsCard } from "./components/NapSettings";
import { DayCard } from "./components/DayCard";
import { StrandFeedingPanel } from "./components/StrandFeedingPanel";
import { WeekOverview } from "./components/WeekOverview";
import { TripStatus } from "./components/TripStatus";
import { DayNav } from "./components/DayNav";

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

function todayInTripISO(now: Date): string | null {
  const start = timeOn(TRIP_RANGE.startISO, "00:00");
  const end = new Date(timeOn(TRIP_RANGE.endISO, "00:00").getTime() + 86400000);
  if (now.getTime() < start.getTime() || now.getTime() > end.getTime()) return null;
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function scrollToDay(dateISO: string) {
  const el = document.getElementById(`day-${dateISO}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("day-card--flash");
    window.setTimeout(() => el.classList.remove("day-card--flash"), 1200);
  }
}

export default function App() {
  const [nap, setNap] = useState<NapSettings>(() => loadNap());
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    try {
      localStorage.setItem(NAP_STORAGE_KEY, JSON.stringify(nap));
    } catch {
      // Ignore storage failures (private mode, quota, etc.).
    }
  }, [nap]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const todayISO = todayInTripISO(now);

  return (
    <div className="app">
      <Header />

      <main className="container">
        <TripStatus days={tideDays} />

        <section className="card overview-card" aria-labelledby="overview-heading">
          <div className="card-head">
            <h2 id="overview-heading">The whole week at a glance</h2>
            <p className="card-sub">
              Tap a day to jump to its details. Dark dots = highs, gold dots = lows.
              Gold band = daylight; pink dot = right now.
            </p>
          </div>
          <WeekOverview days={tideDays} now={now} onDayClick={scrollToDay} />
          <div className="overview-legend" aria-hidden="true">
            <span className="legend-swatch legend-water" /> Water level
            <span className="legend-swatch legend-day" /> Daylight
            <span className="legend-swatch legend-high" /> High tide
            <span className="legend-swatch legend-low" /> Low tide
            <span className="legend-swatch legend-now" /> Now
          </div>
        </section>

        <DayNav days={tideDays} todayISO={todayISO} />

        <NapSettingsCard value={nap} onChange={setNap} />

        <section aria-labelledby="days-heading">
          <h2 id="days-heading" className="section-title">
            Daily tide plan · {TRIP_RANGE.label}
          </h2>
          <div className="day-grid">
            {tideDays.map((day) => (
              <DayCard
                key={day.date}
                day={day}
                allDays={tideDays}
                nap={nap}
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
          {DATA_VERIFIED && DATA_GENERATED_AT && (
            <p className="muted">
              Predictions fetched from NOAA on{" "}
              <time dateTime={DATA_GENERATED_AT}>
                {new Date(DATA_GENERATED_AT).toLocaleString()}
              </time>
              .
            </p>
          )}
          <p className="muted">
            Built for a family beach week. Not a substitute for posted local
            guidance, lifeguards, or NOAA marine forecasts.
          </p>
        </footer>
      </main>
    </div>
  );
}
