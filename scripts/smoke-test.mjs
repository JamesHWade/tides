// Smoke test for the pure logic modules. Requires a TypeScript loader
// (`tsx`); run via `npm run test:smoke`. Plain `node scripts/smoke-test.mjs`
// will fail because tsx is what teaches Node to resolve `.ts` modules.
//
// Imports go through the utils barrel (`src/utils/index.ts`) and the tides
// data module, so the script doesn't need to thumbprint `.ts` extensions —
// any other runner that respects the project's `tsconfig` paths will work.

import assert from "node:assert/strict";

const {
  aggregatePeriods,
  bestDailyRecommendation,
  emojiFor,
  formatClock,
  lowTidePlayWindow,
  scoreStrandDay,
  sunTimes,
  isActivityAllowed,
  isActivityOpenOn,
  optimizeDaySchedule,
} = await import("../src/utils/index");
const { buildDayPlans, localEventsFor } = await import("../src/data/tides");
const { ACTIVITIES, activityById } = await import("../src/data/activities");
const { DEFAULT_ACCESS } = await import("../src/hooks/useAccessSettings");

// --- 1. weather aggregator ----------------------------------------------------
const periods = [
  {
    startTime: "2026-05-17T06:00:00-04:00",
    isDaytime: true,
    temperature: 81,
    temperatureUnit: "F",
    probabilityOfPrecipitation: { value: 20 },
    windSpeed: "5 to 10 mph",
    windDirection: "SW",
    shortForecast: "Mostly Sunny",
    detailedForecast: "Calm and warm.",
    icon: "icon-url",
  },
  {
    startTime: "2026-05-17T18:00:00-04:00",
    isDaytime: false,
    temperature: 65,
    temperatureUnit: "F",
    probabilityOfPrecipitation: { value: null },
    windSpeed: 5,
    windDirection: "SW",
    shortForecast: "Clear",
  },
];
const wByDate = aggregatePeriods(periods);
const may17 = wByDate.get("2026-05-17");
assert.ok(may17, "May 17 entry exists");
assert.equal(may17.highF, 81);
assert.equal(may17.lowF, 65);
assert.equal(may17.windMphMax, 10);
assert.equal(may17.windFromDir, "SW");
assert.equal(may17.precipChancePct, 20);
assert.equal(may17.shortForecast, "Mostly Sunny");
assert.equal(emojiFor("Thunderstorms Likely"), "⛈️");
assert.equal(emojiFor("Sunny"), "☀️");
// Regression: emojiFor must not throw when called with undefined/null/empty.
assert.equal(emojiFor(undefined), "🌥️");
assert.equal(emojiFor(null), "🌥️");
assert.equal(emojiFor(""), "🌥️");
// Periods with missing shortForecast must aggregate cleanly, not throw.
const sparsePeriods = [
  { startTime: "2026-05-17T06:00:00-04:00", isDaytime: true, temperature: 80, temperatureUnit: "F", windSpeed: null, windDirection: null },
  { startTime: "2026-05-17T18:00:00-04:00", isDaytime: false, temperature: 60, temperatureUnit: "F", windSpeed: null, windDirection: null },
];
const sparse = aggregatePeriods(sparsePeriods).get("2026-05-17");
assert.ok(sparse, "sparse aggregator returned an entry");
assert.equal(sparse.emoji, "🌥️");
console.log("✓ weather aggregator");

// --- 2. sun times -------------------------------------------------------------
const sun = sunTimes("2026-05-17");
const rise = sun.sunrise.getUTCHours() + sun.sunrise.getUTCMinutes() / 60;
const set = sun.sunset.getUTCHours() + sun.sunset.getUTCMinutes() / 60;
assert.ok(rise > 5.5 && rise < 7, `sunrise sanity: ${rise}`);
assert.ok(set > 19.5 && set < 21, `sunset sanity: ${set}`);
// Winter date should produce a later sunrise (EST offset -5).
const winterSun = sunTimes("2026-12-21");
const wRise = winterSun.sunrise.getUTCHours() + winterSun.sunrise.getUTCMinutes() / 60;
assert.ok(wRise > 6.5 && wRise < 8, `Dec sunrise sanity: ${wRise}`);
console.log("✓ sun times handle DST");

// --- 3. strand scoring --------------------------------------------------------
const tripDays = buildDayPlans("2026-05-17", "2026-05-24", localEventsFor, {});
// May 17 has lows at 1:24 AM (night) and 1:51 PM (afternoon) → daytime low present.
const may17Day = tripDays.find((d) => d.date === "2026-05-17");
const sFav = scoreStrandDay(may17Day, may17);
assert.ok(["favorable", "marginal"].includes(sFav.rating), `May 17 should not be unfavorable: got ${sFav.rating}`);
assert.ok(sFav.bestWindow, "best window should be defined for a daytime low");

// Bad weather kicks it down.
const badWeather = { ...may17, windMphMax: 25, precipChancePct: 80, shortForecast: "Thunderstorms" };
const sBad = scoreStrandDay(may17Day, badWeather);
assert.ok(sBad.score < sFav.score, `bad weather lowers score (${sBad.score} < ${sFav.score})`);
assert.equal(sBad.rating, "unfavorable", `thunderstorm day should be unfavorable, got ${sBad.rating}`);

// October day with mid-morning + mid-afternoon lows, well clear of twilight.
const octDay = {
  date: "2026-10-15",
  label: "Thursday, October 15",
  tides: [
    { time: "03:00", displayTime: "3:00 AM", type: "High", heightFt: 6.5 },
    { time: "09:30", displayTime: "9:30 AM", type: "Low", heightFt: -0.4 },
    { time: "15:30", displayTime: "3:30 PM", type: "High", heightFt: 6.2 },
    { time: "21:45", displayTime: "9:45 PM", type: "Low", heightFt: -0.2 },
  ],
};
const sOct = scoreStrandDay(octDay, { windMphMax: 8, precipChancePct: 10, shortForecast: "Sunny", highF: 72, lowF: 58, windFromDir: "N", date: "2026-10-15", emoji: "☀️" });
assert.equal(sOct.rating, "favorable", `fall + calm + low ranges should be favorable, got ${sOct.rating}`);

// No-data day → unfavorable.
const emptyDay = { date: "2099-01-01", label: "Future", tides: [] };
const sEmpty = scoreStrandDay(emptyDay);
assert.equal(sEmpty.rating, "unfavorable");

// Regression: a daytime low well-clear of twilight should NOT trigger the
// "near twilight" reason (previously hard-wired by a Math.min(0, …) bug).
const noonReasons = sOct.reasons.map((r) => r.label).join(" | ");
assert.ok(
  !/near twilight/i.test(noonReasons),
  `Oct 7:15 AM / 7:45 PM lows are clear of twilight; got: ${noonReasons}`,
);
// A low at sunrise + 20 min SHOULD trigger the glare penalty.
const twilightDay = {
  date: "2026-10-15",
  label: "Thursday, October 15",
  tides: [
    { time: "00:30", displayTime: "12:30 AM", type: "High", heightFt: 6.0 },
    { time: "07:00", displayTime: "7:00 AM", type: "Low", heightFt: -0.3 }, // ~sunrise
    { time: "13:00", displayTime: "1:00 PM", type: "High", heightFt: 5.8 },
    { time: "19:15", displayTime: "7:15 PM", type: "Low", heightFt: -0.1 },
  ],
};
const sTwi = scoreStrandDay(twilightDay);
assert.ok(
  sTwi.reasons.some((r) => /near twilight/i.test(r.label)),
  "low near sunrise should trigger glare/twilight reason",
);
console.log("✓ strand scoring");

// --- 4. daylight-aware play windows -------------------------------------------
// Regression: trip data has a low tide around 1:24 AM on May 17, 2026 (well
// before the ~6:15 AM sunrise). Without a daylight filter the app used to
// recommend a "Best low-tide play" window of 11:54 PM – 2:54 AM. That is the
// nonsense this commit aims to prevent.
const may17Sun = sunTimes("2026-05-17");
const nightLow = { time: "01:24", displayTime: "1:24 AM", type: "Low", heightFt: -0.3 };
const dayLow = { time: "13:51", displayTime: "1:51 PM", type: "Low", heightFt: -0.5 };
const may17Stub = { date: "2026-05-17", label: "Sunday, May 17", tides: [nightLow, dayLow] };

// 1 AM low → no window at all when daylight is supplied.
const nightWindow = lowTidePlayWindow(may17Stub, nightLow, 90, may17Sun);
assert.equal(nightWindow, null, "nighttime low should not produce a play window");

// 1:51 PM low → unchanged window (fully inside daylight).
const dayWindow = lowTidePlayWindow(may17Stub, dayLow, 90, may17Sun);
assert.ok(dayWindow, "daytime low should produce a window");
assert.equal(formatClock(dayWindow.start), "12:21 PM");
assert.equal(formatClock(dayWindow.end), "3:21 PM");

// Backward compatibility: no daylight arg → window is returned unclipped.
const legacyWindow = lowTidePlayWindow(may17Stub, nightLow, 90);
assert.ok(legacyWindow, "no-daylight call should still return a window");

// Sunrise-straddling low → window clipped to start at sunrise.
const sunriseLow = { time: "06:30", displayTime: "6:30 AM", type: "Low", heightFt: 0.2 };
const sunriseStub = { date: "2026-05-17", label: "Sunday, May 17", tides: [sunriseLow] };
const clipped = lowTidePlayWindow(sunriseStub, sunriseLow, 90, may17Sun);
assert.ok(clipped, "sunrise-overlapping low should produce a (clipped) window");
assert.equal(
  clipped.start.getTime(),
  may17Sun.sunrise.getTime(),
  "clipped window must start at sunrise",
);

// Sunset-straddling low → window clipped to end at sunset. May 17 sunset is
// around 8:15 PM, so a 7:30 PM low's ±90 min window (6:00 – 9:00 PM) must
// have its tail trimmed to sunset.
const sunsetLow = { time: "19:30", displayTime: "7:30 PM", type: "Low", heightFt: 0.3 };
const sunsetStub = { date: "2026-05-17", label: "Sunday, May 17", tides: [sunsetLow] };
const sunsetClipped = lowTidePlayWindow(sunsetStub, sunsetLow, 90, may17Sun);
assert.ok(sunsetClipped, "sunset-overlapping low should produce a (clipped) window");
assert.equal(
  sunsetClipped.end.getTime(),
  may17Sun.sunset.getTime(),
  "clipped window must end at sunset",
);
assert.ok(
  sunsetClipped.start.getTime() < may17Sun.sunset.getTime(),
  "clipped window start must remain before sunset",
);

// Low entirely after sunset → no window at all.
const afterSunsetLow = { time: "22:00", displayTime: "10:00 PM", type: "Low", heightFt: 0.4 };
const afterSunsetStub = { date: "2026-05-17", label: "Sunday, May 17", tides: [afterSunsetLow] };
const afterSunsetWindow = lowTidePlayWindow(afterSunsetStub, afterSunsetLow, 90, may17Sun);
assert.equal(afterSunsetWindow, null, "post-sunset low should not produce a play window");

// Recommendation copy must not promise "morning beach play" for an all-night low.
const onlyNightDay = { date: "2026-05-17", label: "Sunday, May 17", tides: [nightLow] };
const recNight = bestDailyRecommendation(
  onlyNightDay,
  { napStart: "13:00", napEnd: "15:00" },
  may17Sun,
);
assert.ok(
  /outside daylight/i.test(recNight),
  `nighttime-only low should produce an outside-daylight rec, got: ${recNight}`,
);

// Daytime low + nap clear of it → cheerful afternoon rec (May 17's 1:51 PM
// low gives a 12:21 PM – 3:21 PM window; with a 9:00 AM nap there's no
// conflict so we should land on the afternoon copy, not the fallback).
const recDay = bestDailyRecommendation(
  may17Stub,
  { napStart: "09:00", napEnd: "10:30" },
  may17Sun,
);
assert.ok(
  /afternoon/i.test(recDay) && !/overlap nap/i.test(recDay),
  `daytime low with clear nap should produce an afternoon rec, got: ${recDay}`,
);
console.log("✓ daylight-aware recommendations");

// --- 5. activity access filtering --------------------------------------------
// Default settings should hide every gated activity and allow only the
// public-fallback ones (Freshfields, Bohicket, public beach walks).
const nightHeron = activityById("kiawah-night-heron-pool");
const sanctuaryPool = activityById("kiawah-sanctuary-pool");
const treehouse = activityById("kiawah-treehouse");
const beachClubPool = activityById("seabrook-beach-club-pool");
const clubDining = activityById("seabrook-club-dining");
const beachClubDining = activityById("seabrook-beach-club-dining");
const freshfields = activityById("freshfields-village");
const publicBeachWalk = activityById("public-beach-walk");
assert.ok(nightHeron, "Night Heron activity exists");
assert.ok(sanctuaryPool, "Sanctuary activity exists");
assert.ok(treehouse, "Treehouse activity exists");
assert.ok(beachClubPool, "Seabrook Beach Club pool activity exists");
assert.ok(clubDining, "Seabrook club dining activity exists");
assert.ok(beachClubDining, "Seabrook Beach Club dining activity exists");
assert.ok(freshfields, "Freshfields activity exists");
assert.ok(publicBeachWalk, "Public beach walk activity exists");

// Default access = only public activities allowed.
assert.equal(
  isActivityAllowed(nightHeron, DEFAULT_ACCESS),
  false,
  "Night Heron blocked when no Kiawah access set",
);
assert.equal(
  isActivityAllowed(sanctuaryPool, DEFAULT_ACCESS),
  false,
  "Sanctuary blocked by default",
);
assert.equal(
  isActivityAllowed(treehouse, DEFAULT_ACCESS),
  false,
  "Treehouse blocked by default",
);
assert.equal(
  isActivityAllowed(beachClubPool, DEFAULT_ACCESS),
  false,
  "Beach Club pool blocked by default",
);
assert.equal(
  isActivityAllowed(clubDining, DEFAULT_ACCESS),
  false,
  "Seabrook club dining blocked by default",
);
assert.equal(
  isActivityAllowed(freshfields, DEFAULT_ACCESS),
  true,
  "Freshfields is public by default",
);
assert.equal(
  isActivityAllowed(publicBeachWalk, DEFAULT_ACCESS),
  true,
  "Public beach walk allowed by default",
);

// Either Kiawah resort or Governor's Club unlocks Night Heron.
assert.equal(
  isActivityAllowed(nightHeron, { ...DEFAULT_ACCESS, kiawahResortGuest: true }),
  true,
  "Night Heron allowed for resort guests",
);
assert.equal(
  isActivityAllowed(nightHeron, { ...DEFAULT_ACCESS, kiawahGovernorClub: true }),
  true,
  "Night Heron allowed for Governor's Club",
);

// Sanctuary requires the Sanctuary flag specifically (allOf), not the resort one.
assert.equal(
  isActivityAllowed(sanctuaryPool, { ...DEFAULT_ACCESS, kiawahResortGuest: true }),
  false,
  "Sanctuary pool requires Sanctuary hotel flag, not resort guest",
);
assert.equal(
  isActivityAllowed(sanctuaryPool, { ...DEFAULT_ACCESS, kiawahSanctuaryGuest: true }),
  true,
  "Sanctuary pool unlocks with Sanctuary hotel flag",
);

// Treehouse: off-island family without confirmed reservation = blocked.
assert.equal(
  isActivityAllowed(treehouse, { ...DEFAULT_ACCESS, stayBase: "offIsland" }),
  false,
  "Treehouse blocked for off-island without reservation",
);
assert.equal(
  isActivityAllowed(treehouse, {
    ...DEFAULT_ACCESS,
    stayBase: "offIsland",
    kiawahConfirmedRecreationReservation: true,
  }),
  true,
  "Treehouse allowed with confirmed reservation",
);

// Seabrook Beach Club pool requires Digital Amenity Pass.
assert.equal(
  isActivityAllowed(beachClubPool, { ...DEFAULT_ACCESS, seabrookDigitalAmenityPass: true }),
  true,
  "Beach Club pool unlocks with Digital Amenity Pass",
);

// Seabrook club dining requires the Club Access Amenity Card.
assert.equal(
  isActivityAllowed(clubDining, { ...DEFAULT_ACCESS, seabrookDigitalAmenityPass: true }),
  false,
  "Club dining still blocked without Club Access Amenity Card",
);
assert.equal(
  isActivityAllowed(clubDining, { ...DEFAULT_ACCESS, seabrookClubAccessAmenityCard: true }),
  true,
  "Club dining unlocks with Club Access Amenity Card",
);

// preferPublicOnly hides every gated activity, even when flags are set.
assert.equal(
  isActivityAllowed(nightHeron, {
    ...DEFAULT_ACCESS,
    kiawahResortGuest: true,
    preferPublicOnly: true,
  }),
  false,
  "preferPublicOnly overrides gated activities",
);
assert.equal(
  isActivityAllowed(freshfields, { ...DEFAULT_ACCESS, preferPublicOnly: true }),
  true,
  "preferPublicOnly still allows public activities",
);

// Beach Club restaurant trip-week hours (May 17–24, 2026).
assert.equal(
  isActivityOpenOn(beachClubDining, "2026-05-17", "17:00", "18:00"),
  true,
  "Beach Club dining open at 5–6 PM on May 17 (early-season hours: 10 AM–6 PM)",
);
assert.equal(
  isActivityOpenOn(beachClubDining, "2026-05-17", "18:30", "19:30"),
  false,
  "Beach Club dining closed by 6 PM on May 17 (early-season)",
);
assert.equal(
  isActivityOpenOn(beachClubDining, "2026-05-22", "19:00", "19:30"),
  true,
  "Beach Club dining still open at 7 PM on May 22+ (later hours)",
);
// Pool itself opens at 9 AM during the trip week.
assert.equal(
  isActivityOpenOn(beachClubPool, "2026-05-17", "09:00", "10:00"),
  true,
  "Beach Club pool opens at 9 AM",
);
assert.equal(
  isActivityOpenOn(beachClubPool, "2026-05-17", "06:00", "08:00"),
  false,
  "Beach Club pool not open at 6 AM",
);
console.log("✓ activity access + hours");

// --- 6. schedule optimizer ---------------------------------------------------
const optDays = buildDayPlans("2026-05-17", "2026-05-24", localEventsFor, {});
const day17 = optDays.find((d) => d.date === "2026-05-17");
const day20 = optDays.find((d) => d.date === "2026-05-20");
const nap = { napStart: "13:00", napEnd: "15:00" };

// Default access: must produce a useful plan, must include the public fallback,
// must not schedule any gated activity, and must not put a strand block on a
// thunderstorm day.
const planDefault = optimizeDaySchedule({
  day: day17,
  allDays: optDays,
  nap,
  weather: { date: "2026-05-17", highF: 82, lowF: 65, precipChancePct: 20, windMphMax: 8, windFromDir: "SW", shortForecast: "Sunny", emoji: "☀️" },
  access: DEFAULT_ACCESS,
});
assert.ok(planDefault.blocks.length > 0, "Default access still yields blocks");
assert.ok(
  planDefault.publicFallback.length > 0,
  "Public fallback is always present",
);
for (const b of planDefault.blocks) {
  if (!b.activityId) continue;
  const act = activityById(b.activityId);
  assert.ok(
    !act || isActivityAllowed(act, DEFAULT_ACCESS),
    `block ${b.label} (${b.activityId}) is allowed under default access`,
  );
}

// Favorable strand day (May 17 has a 1:51 PM low) → strand block scheduled,
// trimmed against nap. With the default 13:00–15:00 nap and a 11:51–15:51
// raw strand window, the optimizer should keep the post-nap piece (~15:00–15:51,
// which is < 60 min so actually it should pick the pre-nap piece if larger).
// Either way: a strand block should exist with no nap collision.
const strandBlock = planDefault.blocks.find((b) => b.kind === "strand");
assert.ok(strandBlock, "favorable strand day should produce a strand block");
// Strand block must not overlap the nap window (13:00–15:00 in station-tz UTC).
const napStartT = new Date(`${day17.date}T13:00:00Z`);
const napEndT = new Date(`${day17.date}T15:00:00Z`);
const overlapsNap =
  strandBlock.start < napEndT && strandBlock.end > napStartT;
assert.equal(overlapsNap, false, "strand block does not collide with the nap window");

// Thunderstorm day → no strand block, indoor/public fallback steer.
const planThunder = optimizeDaySchedule({
  day: day17,
  allDays: optDays,
  nap,
  weather: { date: "2026-05-17", highF: 75, lowF: 65, precipChancePct: 80, windMphMax: 15, windFromDir: "SW", shortForecast: "Thunderstorms Likely", emoji: "⛈️" },
  access: DEFAULT_ACCESS,
});
assert.ok(
  !planThunder.blocks.some((b) => b.kind === "strand"),
  "thunderstorm day must not schedule a strand block",
);
assert.equal(
  planThunder.bestUseOfDay,
  "indoorFallback",
  "thunderstorm day labels as indoor fallback",
);
assert.ok(
  planThunder.publicFallback.length > 0,
  "thunderstorm day still has a public fallback",
);

// With full Kiawah resort access on a hot day, a Kiawah pool should appear in
// the schedule — confirming amenity access unlocks gated activities.
const planResort = optimizeDaySchedule({
  day: day20,
  allDays: optDays,
  nap,
  weather: { date: "2026-05-20", highF: 91, lowF: 72, precipChancePct: 5, windMphMax: 6, windFromDir: "S", shortForecast: "Sunny", emoji: "☀️" },
  access: { ...DEFAULT_ACCESS, kiawahResortGuest: true },
});
const hasKiawahPool = planResort.blocks.some(
  (b) =>
    b.activityId === "kiawah-night-heron-pool" ||
    b.activityId === "kiawah-west-beach-pool",
);
assert.ok(
  hasKiawahPool,
  "Kiawah pool should be scheduled on a hot day when resort access is enabled",
);

// preferPublicOnly removes every gated activity even when flags are set.
const planPublicOnly = optimizeDaySchedule({
  day: day20,
  allDays: optDays,
  nap,
  weather: { date: "2026-05-20", highF: 88, lowF: 70, precipChancePct: 10, windMphMax: 8, windFromDir: "SW", shortForecast: "Mostly Sunny", emoji: "🌤️" },
  access: { ...DEFAULT_ACCESS, kiawahResortGuest: true, preferPublicOnly: true },
});
for (const b of planPublicOnly.blocks) {
  if (!b.activityId) continue;
  const act = activityById(b.activityId);
  assert.ok(
    act && act.access.public === true,
    `preferPublicOnly must only schedule public activities; got ${b.activityId}`,
  );
}

// Every gated catalog activity should appear in the `skipped` list under
// default access (sanity check that the "available if you have access" UI
// won't be empty).
const skippedIds = new Set(planDefault.skipped.map((s) => s.activityId));
for (const a of ACTIVITIES) {
  if (a.access.public === true && !a.access.allOf?.length && !a.access.anyOf?.length) continue;
  assert.ok(
    skippedIds.has(a.id),
    `gated activity ${a.id} should appear in the skipped list under default access`,
  );
}
console.log("✓ schedule optimizer");

console.log("\nAll smoke tests passed.");
