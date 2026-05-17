import { STATION, TRIP_RANGE, DATA_VERIFIED } from "../data/tides";

export function Header() {
  return (
    <header className="hero" aria-label="Family Tide Planner">
      <div className="hero-bg" aria-hidden="true">
        <svg viewBox="0 0 1440 240" preserveAspectRatio="none" className="hero-waves">
          <defs>
            <linearGradient id="hero-wave-a" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="hero-wave-b" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 140 C 240 110, 480 180, 720 140 S 1200 100, 1440 140 L1440 240 L0 240 Z"
            fill="url(#hero-wave-a)"
          />
          <path
            d="M0 175 C 200 155, 460 210, 720 180 S 1240 150, 1440 180 L1440 240 L0 240 Z"
            fill="url(#hero-wave-b)"
          />
        </svg>
      </div>

      <div className="hero-inner">
        <p className="eyebrow">Family Tide Planner</p>
        <h1>Seabrook + Kiawah Beach Week</h1>
        <p className="subtitle">
          {TRIP_RANGE.label} · tides from {STATION.name}
        </p>
        <p className="hero-note">
          Times are predictions at the Kiawah River Bridge station. Open-beach
          conditions at Beachwalker, Captain Sams, and the Seabrook accesses
          shift by a few minutes — give yourself a buffer.
        </p>
        {!DATA_VERIFIED && (
          <p className="hero-warning" role="status">
            ⚠️ Tide values in this build are estimated placeholders. Verify
            against{" "}
            <a
              href={`https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=${STATION.id}`}
              target="_blank"
              rel="noreferrer"
            >
              NOAA station {STATION.id}
            </a>{" "}
            before relying on them.
          </p>
        )}
      </div>
    </header>
  );
}
