# Seabrook + Kiawah Family Tide Planner

A small React + Vite app for planning a family beach week around tides at the
**Kiawah River Bridge, SC** NOAA station, naps, and possible dolphin
strand‑feeding observation windows.

Trip range: **May 17 – May 24, 2026** (Sunday → Sunday).

## What it does

For each day in the trip it shows:

- High and low tide events (time + height)
- A simple horizontal tide timeline with the nap window shaded in
- A derived **best low‑tide play window** (±90 min around each low)
- A conservative **possible strand‑feeding watch window** with safety reminders
- A **nap conflict** badge when a recommended window overlaps the configured nap

Nap start/end are editable and persist to `localStorage` on the device.

## Tide station

- Station: **Kiawah River Bridge, SC**
- NOAA station ID: **8667062**
- Datum: MLLW · Time zone: local (LST/LDT)

Live source:
<https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8667062>

## ⚠️ Data verification

The tide values currently committed in `src/data/tides.ts` are **estimated
placeholders** — plausible semidiurnal values for the new‑moon spring tides
of mid‑May 2026, but **not** pulled from NOAA. The build environment that
generated this scaffold had no network access to `tidesandcurrents.noaa.gov`.

Before relying on this app for real beach planning:

1. Open the NOAA predictions page for station 8667062, set the date range to
   2026‑05‑17 → 2026‑05‑24, and select the **High/Low** interval.
2. Copy the times (12‑hour) and heights (feet, MLLW) into the matching entries
   in `src/data/tides.ts`.
3. Flip `DATA_VERIFIED` to `true` in that file. The warning banner in the UI
   will disappear automatically.

The `TideEvent` shape (`time`, `displayTime`, `type`, `heightFt`) is
deliberately close to NOAA's `hilo` interval output for easy copy/paste.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL.

## Build

```bash
npm run build
npm run preview   # optional smoke test of the production bundle
```

## Deploy

This repo includes a GitHub Actions workflow at
`.github/workflows/deploy.yml` that builds and publishes to GitHub Pages on
every push to `main`.

To enable it:

1. In the GitHub repo settings, set **Pages → Source** to **GitHub Actions**.
2. If the repo name is something other than `tides`, update the `base` in
   `vite.config.ts` (or set `VITE_BASE=/your-repo-name/` in CI) so asset URLs
   resolve under `https://<user>.github.io/<repo>/`.
3. Push to `main`. The `deploy` job will publish `dist/` to Pages.

For a user/organization root page (`https://<user>.github.io/`), set
`base: "/"`.

## Updating tide data

Edit `src/data/tides.ts`. Each day is one object in the `tideDays` array with
an ordered list of `TideEvent`s. Helper `t(time, displayTime, type, heightFt)`
keeps entries terse.

## Project layout

```
src/
  App.tsx
  main.tsx
  styles.css
  data/tides.ts             # station info + week of events
  utils/tideUtils.ts        # window derivation, nap conflict, formatting
  components/
    Header.tsx
    DayCard.tsx
    TideTimeline.tsx
    NapSettings.tsx
    RecommendationBadge.tsx
    StrandFeedingPanel.tsx
    DuckDbWasmNote.tsx
.github/workflows/deploy.yml
```

## Why no DuckDB‑WASM (yet)

This app holds **one week of tide events at a single station** — a few dozen
rows in a static TypeScript array. Shipping a multi‑megabyte in‑browser SQL
engine to query that would be the wrong trade.

DuckDB‑WASM becomes interesting if this grows into a beach‑history planner
with multiple years of predictions, weather, wildlife sightings, and trip
journals. The architecture is intentionally simple now so that swap is easy
later: keep `tides.ts` as the data adapter and replace its export with a
DuckDB query.

## Wildlife ethics

Strand feeding is a rare, wild behavior. The windows surfaced in this app
are opportunities, not promises. Follow the on‑page guidance:

- Stay back **at least 15 yards (45 ft)** from the waterline when dolphins
  are nearby.
- Never approach, follow, touch, or feed dolphins.
- Keep children quiet and above the wrack line; dogs leashed and back.
- Follow posted signs and any volunteers from the Lowcountry Marine Mammal
  Network or local stewards.

## License

Personal/family use. No warranty — verify tides and conditions against
official NOAA forecasts before making real plans.
