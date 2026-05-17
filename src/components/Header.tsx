import { STATION, TRIP_RANGE, DATA_VERIFIED } from "../data/tides";

export function Header() {
  return (
    <header className="hero">
      <div className="hero-inner">
        <p className="eyebrow">Family Tide Planner</p>
        <h1>Seabrook + Kiawah Beach Week</h1>
        <p className="subtitle">
          {STATION.name} tide predictions · NOAA station {STATION.id} ·{" "}
          {TRIP_RANGE.label}
        </p>
        <p className="hero-note">
          Times shown are for the Kiawah River Bridge station. Open-beach
          conditions at Beachwalker, Captain Sams, and the Seabrook accesses
          can shift the timing by a few minutes — give yourself a buffer.
        </p>
        {!DATA_VERIFIED && (
          <p className="hero-warning" role="status">
            ⚠️ The tide values in this build are estimated placeholders. Verify
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
