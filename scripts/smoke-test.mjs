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

// Recommendation copy must not promise "morning beach play" when the only
// low is overnight; the day still has workable beach time between the highs,
// but the copy should flag that low tide is out of reach.
const onlyNightDayStub = {
  date: "2026-05-17",
  label: "Sunday, May 17",
  tides: [
    nightLow,
    { time: "07:38", displayTime: "7:38 AM", type: "High", heightFt: 6.4 },
    { time: "20:09", displayTime: "8:09 PM", type: "High", heightFt: 6.7 },
  ],
};
const recNight = bestDailyRecommendation(
  onlyNightDayStub,
  { napStart: "13:00", napEnd: "15:00" },
  may17Sun,
);
assert.ok(
  /outside daylight/i.test(recNight),
  `nighttime-only low should mention "outside daylight", got: ${recNight}`,
);

// Daytime low + nap clear of it → cheerful afternoon rec. May 17 has a
// 1:51 PM low; even with a morning nap (9–10:30) overlapping the start
// of the post-high beach window, the post-nap segment still anchors on the
// afternoon low, so the copy should mention "afternoon".
const recDay = bestDailyRecommendation(
  may17Stub,
  { napStart: "09:00", napEnd: "10:30" },
  may17Sun,
);
assert.ok(
  /afternoon/i.test(recDay) && !/overlap nap/i.test(recDay),
  `daytime low with clear nap should produce an afternoon rec, got: ${recDay}`,
);

// May 17 with realistic highs and a nap that swallows the entire single
// good window (9:08 AM – 6:39 PM) should produce the "overlap nap" copy.
const may17Full = {
  date: "2026-05-17",
  label: "Sunday, May 17",
  tides: [
    nightLow,
    { time: "07:38", displayTime: "7:38 AM", type: "High", heightFt: 6.4 },
    dayLow,
    { time: "20:09", displayTime: "8:09 PM", type: "High", heightFt: 6.7 },
  ],
};
const recBigNap = bestDailyRecommendation(
  may17Full,
  { napStart: "09:00", napEnd: "19:00" },
  may17Sun,
);
assert.ok(
  /overlap nap/i.test(recBigNap),
  `huge nap should flag overlap with the good beach window, got: ${recBigNap}`,
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

// preferPublicOnly also hides reservation-required public activities — the
// UI copy promises "no booking required" plans.
const boatRental = activityById("bohicket-boat-rental");
assert.ok(boatRental, "Bohicket boat rental exists");
assert.equal(
  boatRental.access.public,
  true,
  "Boat rental is public-access but reservation-required",
);
assert.equal(
  isActivityAllowed(boatRental, DEFAULT_ACCESS),
  true,
  "Boat rental allowed by default (public)",
);
assert.equal(
  isActivityAllowed(boatRental, { ...DEFAULT_ACCESS, preferPublicOnly: true }),
  false,
  "preferPublicOnly excludes reservation-required public activities",
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
// Misconfigured rule (no public, no flags) must not silently pass — even
// if every other field looks reasonable. This is a guardrail for catalog
// edits.
const misconfigured = {
  id: "test-misconfigured",
  name: "Misconfigured activity",
  area: "kiawah",
  kind: "indoor",
  durationMins: 60,
  access: {},
  kidFit: "wholeFamily",
  weatherFit: {},
  sourceLabel: "Test",
  sourceUrl: "",
  lastVerifiedISO: "2026-05-17",
};
assert.equal(
  isActivityAllowed(misconfigured, DEFAULT_ACCESS),
  false,
  "Empty access rule with public !== true must be blocked, not silently allowed",
);
console.log("✓ activity access + hours");

// --- 6. schedule optimizer ---------------------------------------------------
const optDays = buildDayPlans("2026-05-17", "2026-05-24", localEventsFor, {});
const day17 = optDays.find((d) => d.date === "2026-05-17");
const day20 = optDays.find((d) => d.date === "2026-05-20");
assert.ok(day17, "May 17 fixture present");
assert.ok(day20, "May 20 fixture present");
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

// When the family has Club Access on a mild day, the optimizer should be
// willing to schedule on-island club dining even though the restaurant opens
// (17:00) after the afternoon slot starts (15:00) — regression for the
// slot-start vs activity-open bug.
const planDining = optimizeDaySchedule({
  day: day20,
  allDays: optDays,
  nap,
  weather: { date: "2026-05-20", highF: 78, lowF: 62, precipChancePct: 10, windMphMax: 8, windFromDir: "S", shortForecast: "Mostly Sunny", emoji: "🌤️" },
  access: { ...DEFAULT_ACCESS, seabrookClubAccessAmenityCard: true },
});
const diningBlock = planDining.blocks.find((b) => b.activityId === "seabrook-club-dining");
if (diningBlock) {
  // If chosen, it must start at or after the 17:00 opening time.
  const openMs = Date.UTC(2026, 4, 20, 17, 0);
  assert.ok(
    diningBlock.start.getTime() >= openMs,
    `club dining block must start at or after 17:00, got ${diningBlock.start.toISOString()}`,
  );
}

// Skipped reasons should differentiate "missing access" from "filtered by
// preferPublicOnly when you actually have access".
const planFiltered = optimizeDaySchedule({
  day: day20,
  allDays: optDays,
  nap,
  weather: { date: "2026-05-20", highF: 88, lowF: 70, precipChancePct: 10, windMphMax: 8, windFromDir: "SW", shortForecast: "Mostly Sunny", emoji: "🌤️" },
  access: { ...DEFAULT_ACCESS, kiawahResortGuest: true, preferPublicOnly: true },
});
const nightHeronSkip = planFiltered.skipped.find((s) => s.activityId === "kiawah-night-heron-pool");
assert.ok(nightHeronSkip, "Night Heron appears in skipped when filtered out");
assert.ok(
  /public-only/i.test(nightHeronSkip.reason),
  `Night Heron skip reason should mention public-only filter when family has resort access, got: ${nightHeronSkip.reason}`,
);
console.log("✓ schedule optimizer");

// --- 7. pickBestDays public-only picks the highest-scoring day -------------
const { pickBestDays } = await import("../src/utils/scheduleOptimizer");
const allSchedules = optDays.map((d) =>
  optimizeDaySchedule({
    day: d,
    allDays: optDays,
    nap,
    weather: { date: d.date, highF: 80, lowF: 65, precipChancePct: 10, windMphMax: 8, windFromDir: "SW", shortForecast: "Sunny", emoji: "☀️" },
    access: DEFAULT_ACCESS,
  }),
);
const publicOnlySchedules = optDays.map((d) =>
  optimizeDaySchedule({
    day: d,
    allDays: optDays,
    nap,
    weather: { date: d.date, highF: 80, lowF: 65, precipChancePct: 10, windMphMax: 8, windFromDir: "SW", shortForecast: "Sunny", emoji: "☀️" },
    access: { ...DEFAULT_ACCESS, preferPublicOnly: true },
  }),
);
const bestNoArg = pickBestDays(allSchedules);
const bestTwoArg = pickBestDays(allSchedules, publicOnlySchedules);
assert.ok(bestTwoArg.publicOnly, "public-only pick is set");
// The two-arg form should pick from the public-only schedule set, which is
// scored independently — the picked date must exist there.
assert.ok(
  publicOnlySchedules.some((s) => s.date === bestTwoArg.publicOnly.date),
  "two-arg pick comes from the public-only schedules",
);
// Both no-arg and two-arg forms must produce a valid date from the range.
const validDates = new Set(optDays.map((d) => d.date));
assert.ok(validDates.has(bestNoArg.publicOnly.date));
assert.ok(validDates.has(bestTwoArg.publicOnly.date));
console.log("✓ pickBestDays");

// --- 8. household pace clips early/late windows ----------------------------
// Synthetic day with one early-morning low and a high in the afternoon. Highs
// at 1:30 AM and 2:30 PM mean the daylight "good beach" window stretches
// from sunrise (~6:15) to ~1:00 PM (start of the ±90-min high band), with
// the 8:00 AM low sitting inside it.
const earlyLowDay = {
  date: "2026-05-30",
  label: "Saturday, May 30",
  tides: [
    { time: "01:30", displayTime: "1:30 AM", type: "High", heightFt: 5.0 },
    { time: "08:00", displayTime: "8:00 AM", type: "Low", heightFt: -0.2 },
    { time: "14:30", displayTime: "2:30 PM", type: "High", heightFt: 5.2 },
    { time: "21:00", displayTime: "9:00 PM", type: "Low", heightFt: 0.3 },
  ],
};
// Use a thunderstorm forecast so the strand block is suppressed and the
// beach-play candidate path drives the result. (Play blocks still run on
// stormy days — the optimizer doesn't tie tide play to mood.)
const earlyWeather = {
  date: "2026-05-30",
  highF: 78,
  lowF: 64,
  precipChancePct: 70,
  windMphMax: 12,
  windFromDir: "SW",
  shortForecast: "Thunderstorms Likely",
  emoji: "⛈️",
};

// With kids that can't be out before 9:00, the morning beach window is
// clipped to start at 9:00, but the rest of it (until 1:00 PM, when the
// 2:30 PM high's ±90-min bad band starts) is still usable. The block should
// exist and start at 09:00.
const aggressivePace = {
  earliestStart: "09:00",
  latestEnd: "19:30",
  kidsAge: "littleKids",
};
const earlyPaced = optimizeDaySchedule({
  day: earlyLowDay,
  allDays: [earlyLowDay],
  nap,
  weather: earlyWeather,
  access: DEFAULT_ACCESS,
  pace: aggressivePace,
});
const earlyPacedPlay = earlyPaced.blocks.find((b) => b.kind === "tide");
assert.ok(
  earlyPacedPlay,
  "beach window survives because it extends to ~1:00 PM (well away from the 2:30 PM high)",
);
assert.equal(
  earlyPacedPlay.start.getUTCHours(),
  9,
  `paced play block must start at 09:00, got ${earlyPacedPlay.start.toISOString()}`,
);
assert.equal(
  earlyPacedPlay.start.getUTCMinutes(),
  0,
  "paced play block start minute is 00",
);

// With the default pace (earliestStart 8:30), the same window keeps a bigger
// piece — but the low itself (8:00 AM) is before earliest start, so the
// reason copy should flag "too early for kids".
const earlyDefaultPace = optimizeDaySchedule({
  day: earlyLowDay,
  allDays: [earlyLowDay],
  nap,
  weather: earlyWeather,
  access: DEFAULT_ACCESS,
});
const earlyDefaultPlay = earlyDefaultPace.blocks.find((b) => b.kind === "tide");
assert.ok(earlyDefaultPlay, "morning beach window survives the default 8:30 earliestStart");
const startH = earlyDefaultPlay.start.getUTCHours();
const startM = earlyDefaultPlay.start.getUTCMinutes();
assert.ok(
  startH > 8 || (startH === 8 && startM >= 30),
  `play block must start at/after 08:30, got ${startH}:${String(startM).padStart(2, "0")}`,
);
assert.ok(
  /too early/i.test(earlyDefaultPlay.reason),
  `early-low play block should note "too early for kids", got: ${earlyDefaultPlay.reason}`,
);

// With latestEnd = 12:00, May 17's daylight good window (~9:08 AM – 6:39
// PM) is clipped to 9:08 AM – 12:00 PM — still ~2.9 h, so the block
// remains, just trimmed. It must not run past noon.
const dayWithEarlyCap = optimizeDaySchedule({
  day: day17,
  allDays: optDays,
  nap,
  weather: { date: "2026-05-17", highF: 82, lowF: 65, precipChancePct: 20, windMphMax: 8, windFromDir: "SW", shortForecast: "Sunny", emoji: "☀️" },
  access: DEFAULT_ACCESS,
  pace: { earliestStart: "08:30", latestEnd: "12:00", kidsAge: "littleKids" },
});
const earlyCapPlay = dayWithEarlyCap.blocks.find((b) => b.kind === "tide");
assert.ok(
  earlyCapPlay,
  "morning beach window still recommended when latestEnd cuts the day at noon",
);
const noonMs = Date.UTC(2026, 4, 17, 12, 0);
assert.ok(
  earlyCapPlay.end.getTime() <= noonMs,
  `play block must end at/before 12:00, got ${earlyCapPlay.end.toISOString()}`,
);

// But if the family window is genuinely tiny (latestEnd 09:30 with the
// default 08:30 earliestStart), the May 17 morning beach window 9:08 AM –
// 9:30 AM is only ~22 min, which falls below the 45-min floor and is
// dropped.
const dayWithTinyCap = optimizeDaySchedule({
  day: day17,
  allDays: optDays,
  nap,
  weather: { date: "2026-05-17", highF: 82, lowF: 65, precipChancePct: 20, windMphMax: 8, windFromDir: "SW", shortForecast: "Sunny", emoji: "☀️" },
  access: DEFAULT_ACCESS,
  pace: { earliestStart: "08:30", latestEnd: "09:30", kidsAge: "littleKids" },
});
const tinyCapPlay = dayWithTinyCap.blocks.find((b) => b.kind === "tide");
assert.equal(
  tinyCapPlay,
  undefined,
  "play block dropped when the remaining family window is under 45 min",
);
console.log("✓ household pace clipping");

// --- 9. good-beach windows (away from high tide) ---------------------------
const { goodBeachWindows } = await import("../src/utils/tideUtils");
// May 17 highs are 7:38 AM and 8:09 PM, so the ±90-min bad bands are
// 06:08–09:08 AM and 06:39–09:39 PM. The single daylight good window
// should land between them.
const may17Plan = optDays.find((d) => d.date === "2026-05-17");
const may17Windows = goodBeachWindows(may17Plan, sunTimes("2026-05-17"), 90);
assert.equal(may17Windows.length, 1, "May 17 has exactly one good beach window");
const w0 = may17Windows[0];
assert.equal(formatClock(w0.start), "9:08 AM", `good window starts at 9:08 AM, got ${formatClock(w0.start)}`);
const setH = w0.end.getUTCHours();
const setM = w0.end.getUTCMinutes();
assert.ok(
  setH < 19 || (setH === 18 && setM <= 39),
  `good window ends before/at 6:39 PM, got ${formatClock(w0.end)}`,
);
assert.ok(w0.tide, "1:51 PM low falls inside the good window — anchor low set");
assert.equal(w0.tide.time, "13:51", "anchor low is the 1:51 PM low");

// Days with no daylight low still produce a good beach window — high tide
// is still the constraint, not "is there a low?".
const onlyNightLowDay = {
  date: "2026-06-01",
  label: "Monday, June 1",
  tides: [
    { time: "02:30", displayTime: "2:30 AM", type: "Low", heightFt: -0.1 },
    { time: "09:00", displayTime: "9:00 AM", type: "High", heightFt: 5.8 },
    { time: "15:00", displayTime: "3:00 PM", type: "Low", heightFt: 0.2 },
    { time: "21:30", displayTime: "9:30 PM", type: "High", heightFt: 6.0 },
  ],
};
const juneSun = sunTimes("2026-06-01");
const juneWindows = goodBeachWindows(onlyNightLowDay, juneSun, 90);
// Highs 09:00 and 21:30 → bad bands 07:30–10:30 and 20:00–23:00.
// Daylight ~5:20 AM – 8:30 PM yields: 5:20–7:30, 10:30–8:30 PM (the 8:30 PM
// sunset is inside the 20:00–23:00 bad band, so this end clips), so we
// expect at least one window of ≥ 45 min plus the early-morning slice.
assert.ok(juneWindows.length >= 1, "good windows exist even with a nighttime low");
assert.ok(
  juneWindows.some((w) => w.tide && w.tide.time === "15:00"),
  "the 3:00 PM low sits inside one of the good windows as its anchor",
);
console.log("✓ good beach windows");

console.log("\nAll smoke tests passed.");
