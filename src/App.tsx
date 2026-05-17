import { useEffect, useState } from "react";
import { DATA_GENERATED_AT, DATA_VERIFIED, STATION, tideDays, TRIP_RANGE } from "./data/tides";
import { DEFAULT_NAP, type NapSettings } from "./utils/tideUtils";
import { Header } from "./components/Header";
import { NapSettingsCard } from "./components/NapSettings";
import { DayCard } from "./components/DayCard";
import { StrandFeedingPanel } from "./components/StrandFeedingPanel";
import { DuckDbWasmNote } from "./components/DuckDbWasmNote";

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

export default function App() {
  const [nap, setNap] = useState<NapSettings>(() => loadNap());

  useEffect(() => {
    try {
      localStorage.setItem(NAP_STORAGE_KEY, JSON.stringify(nap));
    } catch {
      // Ignore storage failures (private mode, quota, etc.).
    }
  }, [nap]);

  return (
    <div className="app">
      <Header />

      <main className="container">
        <NapSettingsCard value={nap} onChange={setNap} />

        <section aria-labelledby="days-heading">
          <h2 id="days-heading" className="section-title">
            Daily tide plan · {TRIP_RANGE.label}
          </h2>
          <div className="day-grid">
            {tideDays.map((day) => (
              <DayCard key={day.date} day={day} nap={nap} />
            ))}
          </div>
        </section>

        <StrandFeedingPanel />
        <DuckDbWasmNote />

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
