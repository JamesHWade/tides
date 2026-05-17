// Smoke test for the pure logic modules. Requires a TypeScript loader
// (`tsx`); run via `npm run test:smoke`. Plain `node scripts/smoke-test.mjs`
// will fail because tsx is what teaches Node to resolve `.ts` modules.
//
// Imports go through the utils barrel (`src/utils/index.ts`) and the tides
// data module, so the script doesn't need to thumbprint `.ts` extensions —
// any other runner that respects the project's `tsconfig` paths will work.

import assert from "node:assert/strict";

const { aggregatePeriods, emojiFor, scoreStrandDay, sunTimes } = await import(
  "../src/utils/index"
);
const { buildDayPlans, localEventsFor } = await import("../src/data/tides");

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

console.log("\nAll smoke tests passed.");
