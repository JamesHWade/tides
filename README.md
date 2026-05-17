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

## Data flow

Tide data is **fetched from NOAA at deploy time** by
`scripts/fetch-tides.mjs`:

```
NOAA datagetter API  ──►  scripts/fetch-tides.mjs  ──►  src/data/tides.generated.ts  ──►  vite build  ──►  GitHub Pages
```

The generated module is imported by `src/data/tides.ts`. When it contains
events, the app uses them and `DATA_VERIFIED` flips to `true` (the UI banner
disappears and the footer prints the fetch timestamp). When it's empty
(stub state), the app falls back to a committed placeholder pattern so local
dev still renders without network.

To refresh locally:

```bash
npm run fetch-tides   # rewrites src/data/tides.generated.ts
npm run dev
```

In CI, the workflow runs `npm run fetch-tides` before `vite build`, so every
deploy carries fresh predictions.

To change the station or date range, edit the constants at the top of
`scripts/fetch-tides.mjs` and the matching `STATION` / `TRIP_RANGE` in
`src/data/tides.ts`.

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
