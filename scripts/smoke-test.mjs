// Smoke test for the pure logic modules. Run with `node scripts/smoke-test.mjs`.
// Doesn't render React; just exercises the data transforms so we catch the
// stuff TypeScript can't catch (e.g. nonsensical thresholds, NaN propagation).

import assert from "node:assert/strict";

// Import compiled-ish .ts via vite's esbuild loader. We invoke through tsx if
// available; otherwise the user can run via Node 22 + --experimental-strip-types.
// Easiest: rely on the dynamic-import w/ .ts not being supported and fall back
// to a manual port of the strand scorer for sanity. Here we go via the bundle.

// Smoke test the runtime weather aggregator and strand scorer by re-implementing
// only the boundary contract via the same input shapes.

const { aggregatePeriods, emojiFor } = await import("../src/utils/runtimeWeather.ts");
const { scoreStrandDay } = await import("../src/utils/strandScore.ts");
const { sunTimes } = await import("../src/utils/sunTimes.ts");
const { buildDayPlans, localEventsFor } = await import("../src/data/tides.ts");

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

// October day with a daytime low (fabricate) → favorable.
const octDay = {
  date: "2026-10-15",
  label: "Thursday, October 15",
  tides: [
    { time: "01:00", displayTime: "1:00 AM", type: "High", heightFt: 6.5 },
    { time: "07:15", displayTime: "7:15 AM", type: "Low", heightFt: -0.4 },
    { time: "13:30", displayTime: "1:30 PM", type: "High", heightFt: 6.2 },
    { time: "19:45", displayTime: "7:45 PM", type: "Low", heightFt: -0.2 },
  ],
};
const sOct = scoreStrandDay(octDay, { windMphMax: 8, precipChancePct: 10, shortForecast: "Sunny", highF: 72, lowF: 58, windFromDir: "N", date: "2026-10-15", emoji: "☀️" });
assert.equal(sOct.rating, "favorable", `fall + calm + low ranges should be favorable, got ${sOct.rating}`);

// No-data day → unfavorable.
const emptyDay = { date: "2099-01-01", label: "Future", tides: [] };
const sEmpty = scoreStrandDay(emptyDay);
assert.equal(sEmpty.rating, "unfavorable");
console.log("✓ strand scoring");

console.log("\nAll smoke tests passed.");
