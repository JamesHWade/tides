# Seabrook + Kiawah Family Tide Planner

A small React + Vite app for planning a family beach week around tides at the
**Kiawah River Bridge, SC** NOAA station, naps, weather, and dolphin
strand‑feeding observation windows.

Default trip range: **May 17 – May 24, 2026** (Sunday → Sunday). The date
picker accepts any range up to 21 days; tides and forecast are fetched on
demand.

## What it does

For each day in the chosen range it shows:

- High and low tide events (time + height)
- A per‑day tide curve rendered with **Observable Plot** (daylight band, nap
  shading, "now" indicator)
- A derived **best low‑tide play window** (±90 min around each low)
- A **strand‑feeding observation score** (favorable / marginal / unfavorable)
  that combines tide phase, tidal range, daylight overlap, season, and the
  forecast wind / precip
- A **nap conflict** badge when a recommended window overlaps the configured
  nap
- The next ~7 days of **NWS weather** (high/low, wind, precip chance) as a
  per‑day summary

Nap window and chosen date range persist to `localStorage`.

## Data flow

Two data feeds, both with the same "build‑time snapshot + runtime refresh"
pattern:

```
NOAA datagetter  ──►  scripts/fetch-tides.mjs    ──►  src/data/tides.generated.ts
NWS api.weather.gov ─►  scripts/fetch-weather.mjs ──►  src/data/weather.generated.ts
                                                            │
                                              vite build ◄──┘
                                                            │
                                              GitHub Pages ◄┘
```

At runtime the app:

- Uses the snapshot when the requested date is in it (offline‑safe, instant).
- Otherwise fetches from NOAA / NWS in the browser
  (`src/utils/runtime{Tides,Weather}.ts`).
- Falls back to a committed placeholder pattern for the default trip dates so
  local dev works without network.

To refresh locally:

```bash
npm run fetch-tides     # rewrites src/data/tides.generated.ts
npm run fetch-weather   # rewrites src/data/weather.generated.ts (best‑effort)
npm run fetch-data      # both
npm run dev
```

CI runs both fetches before `vite build`; the weather step is allowed to
fail (NWS occasionally rate‑limits) without breaking the deploy.

## Tide station / weather point

- Tides: **Kiawah River Bridge, SC** — NOAA station **8667062**, MLLW.
- Weather: NWS gridpoint for the station coordinates (Charleston CHS office).

Sources:
<https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8667062>
<https://www.weather.gov/chs/>

To change the station or default trip range, edit `STATION` / `TRIP_RANGE` in
`src/data/tides.ts` and the matching constants at the top of
`scripts/fetch-tides.mjs` and `scripts/fetch-weather.mjs`.

## Strand‑feeding scoring

The per‑day score is computed in `src/utils/strandScore.ts`. Biology comes
from peer‑reviewed and outreach sources (Petricig 1995, Duffy‑Echevarria
2008, NOAA Fisheries, Lowcountry Marine Mammal Network); wind and precip
inputs are observer‑comfort heuristics, not biology, and the UI labels them
as such. Key encoded rules:

- Best window: low tide ±2 hours, restricted to daylight.
- Tidal range / minimum low height proxies for mud‑bank exposure (spring
  tides are weighted up).
- Season bonus: Sep–Nov peak (fall mullet outmigration), May–Aug solid,
  Jan–Feb dampened.
- Wind ≥20 mph or heavy precip drops the score; thunderstorms drop it
  further.

Observation distances surfaced in the app match NOAA Fisheries / LMMN
guidance: **15 yards (45 ft) on land, 50 yards (150 ft) from a vessel**.
Harassment of marine mammals is a federal offense under the MMPA — penalties
up to $100,000 and one year in jail per violation.

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

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every
push to `main`.

To enable it:

1. In the GitHub repo settings, set **Pages → Source** to **GitHub Actions**.
2. If the repo name is something other than `tides`, set the `base` in
   `vite.config.ts` (or `VITE_BASE=/your-repo-name/` in CI) so assets resolve
   under `https://<user>.github.io/<repo>/`.
3. Push to `main`. The `deploy` job will publish `dist/` to Pages.

For a user/organization root page, set `base: "/"`.

## Project layout

```
src/
  App.tsx
  main.tsx
  styles.css
  data/
    tides.ts                # types, default trip, snapshot + placeholder
    tides.generated.ts      # CI‑written NOAA snapshot
    weather.ts              # weather snapshot adapter
    weather.generated.ts    # CI‑written NWS snapshot
  hooks/
    useDateRange.ts         # picker state + localStorage
    useTideDays.ts          # snapshot + runtime fetch merge
    useWeather.ts           # snapshot + live refresh
  utils/
    tideUtils.ts            # interpolation, windows, nap conflict
    sunTimes.ts              # sunrise/sunset, DST‑aware
    runtimeTides.ts          # browser NOAA fetch
    runtimeWeather.ts        # browser NWS fetch + aggregation
    strandScore.ts           # per‑day scoring
  components/
    Header.tsx
    TripStatus.tsx
    DateRangePicker.tsx
    WeekOverview.tsx
    DayNav.tsx
    NapSettings.tsx
    DayCard.tsx
    TideChart.tsx            # Observable Plot per‑day chart
    WeatherSummary.tsx
    StrandScoreCard.tsx
    StrandFeedingPanel.tsx
    RecommendationBadge.tsx
scripts/
  fetch-tides.mjs
  fetch-weather.mjs
  smoke-test.mjs             # node tsx scripts/smoke-test.mjs
  screenshot.mjs             # local Playwright capture
.github/workflows/deploy.yml
```

## Why no DuckDB‑WASM (yet)

The app still holds a small, bounded set of records per session — a few dozen
tide events and a 7‑day forecast. Shipping a multi‑megabyte in‑browser SQL
engine to query that would be the wrong trade. If this grows into a beach
history with years of predictions, weather, and trip journals, the data
layer is intentionally adapter‑shaped so swapping in DuckDB later is local.

## License

Personal/family use. No warranty — verify tides and conditions against
official NOAA / NWS forecasts before making real plans.
