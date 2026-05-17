// Score a day for *observing* bottlenose-dolphin strand feeding in the
// Kiawah River / Captain Sams Inlet area. The biology and limits encoded
// here come from public, peer-reviewed and outreach sources — see
// docs/strand-feeding-research.md in the conversation that produced this
// file. Some inputs (wind, rain) are observer-comfort heuristics rather
// than biology, and are labeled as such in the UI copy.

import type { DayPlan, TideEvent } from "../data/tides";
import type { DayWeather } from "./runtimeWeather";
import { timeOn, addMinutes, windowsOverlap, formatClock } from "./tideUtils";
import { sunTimes } from "./sunTimes";

export type StrandRating = "favorable" | "marginal" | "unfavorable";

export type StrandReason = {
  /** Short label, e.g. "Low tide in daylight". */
  label: string;
  /** "+" supports, "−" weakens, "·" neutral context. */
  tone: "plus" | "minus" | "neutral";
};

export type StrandScore = {
  rating: StrandRating;
  /** Numeric score for sorting; not shown to the user. Range roughly -5..+6. */
  score: number;
  reasons: StrandReason[];
  /** The best window of the day to be on the bank, if any. */
  bestWindow: { start: Date; end: Date; low: TideEvent } | null;
};

/** Inclusive ranges by month (1-12). */
const SEASON_BONUS: Record<number, number> = {
  1: -1, // Jan: prey scarce in creeks
  2: -1,
  3: 0,
  4: 0,
  5: 0.5,
  6: 0.5,
  7: 0.5,
  8: 0.5,
  9: 1.5, // Sep–Nov: fall mullet outmigration peak
  10: 1.5,
  11: 1.5,
  12: 0,
};

function monthOf(dateISO: string): number {
  return Number(dateISO.slice(5, 7));
}

/**
 * Compute a strand-feeding observation score for a single day.
 *
 * The scoring blends:
 *   - whether a low tide falls in daylight (Petricig 1995: behavior occurs
 *     day or night, but observers need light)
 *   - tidal range / low-tide height proxy for "mud bank exposure" (Oceanography
 *     piece notes spring tides expose more bank)
 *   - season (mullet outmigration Sep–Nov is the peak)
 *   - wind & rain as observer-comfort heuristics
 */
export function scoreStrandDay(day: DayPlan, weather?: DayWeather): StrandScore {
  const reasons: StrandReason[] = [];
  let score = 0;

  const lows = day.tides.filter((t) => t.type === "Low");
  if (lows.length === 0) {
    return {
      rating: "unfavorable",
      score: -5,
      reasons: [{ label: "No low-tide data for this date", tone: "minus" }],
      bestWindow: null,
    };
  }

  const sun = sunTimes(day.date);

  // Score each low tide as a candidate viewing window; keep the best.
  type Candidate = { low: TideEvent; start: Date; end: Date; localScore: number };
  let best: Candidate | null = null;
  for (const low of lows) {
    const center = timeOn(day.date, low.time);
    const start = addMinutes(center, -120); // ±2 h biology window
    const end = addMinutes(center, 120);

    const daylightOverlap = windowsOverlap(start, end, sun.sunrise, sun.sunset);
    if (!daylightOverlap) continue; // nighttime low, useless for observation

    // Penalize lows whose center sits close to sunrise/sunset (dim light /
    // glare). Distance is min(|center - sunrise|, |center - sunset|) regardless
    // of whether center is just inside or just outside daylight.
    const distToTwilightMin = Math.min(
      Math.abs(center.getTime() - sun.sunrise.getTime()) / 60_000,
      Math.abs(center.getTime() - sun.sunset.getTime()) / 60_000,
    );
    const glarePenalty = distToTwilightMin < 60 ? -0.5 : 0;

    const localScore = 1 + glarePenalty; // base "low in daylight" credit
    if (!best || localScore > best.localScore) {
      best = { low, start, end, localScore };
    }
  }

  // Daylight low
  if (best) {
    score += best.localScore;
    reasons.push({
      label: `Low tide ${best.low.displayTime} falls in daylight`,
      tone: "plus",
    });
    if (best.localScore < 1) {
      reasons.push({
        label: "Low tide is near twilight — glare may hurt visibility",
        tone: "minus",
      });
    }
  } else {
    score -= 2;
    reasons.push({
      label: "All low tides are at night — nothing to watch from shore",
      tone: "minus",
    });
  }

  // Tidal-range / mud exposure proxy
  const heights = day.tides.map((t) => t.heightFt);
  const range = Math.max(...heights) - Math.min(...heights);
  const minLow = Math.min(...lows.map((l) => l.heightFt));
  if (range >= 6.5) {
    score += 1.5;
    reasons.push({
      label: `Big tidal swing today (~${range.toFixed(1)} ft) — exposes more mud bank`,
      tone: "plus",
    });
  } else if (range >= 5.5) {
    score += 0.5;
    reasons.push({
      label: `Moderate swing (~${range.toFixed(1)} ft)`,
      tone: "neutral",
    });
  } else {
    score -= 0.5;
    reasons.push({
      label: `Smaller swing (~${range.toFixed(1)} ft) — less bank exposed`,
      tone: "minus",
    });
  }
  if (minLow <= 0) {
    score += 0.5;
    reasons.push({
      label: `Spring-tide-style low (${minLow.toFixed(1)} ft)`,
      tone: "plus",
    });
  }

  // Season — mullet outmigration peak Sep–Nov.
  const month = monthOf(day.date);
  const seasonBonus = SEASON_BONUS[month] ?? 0;
  score += seasonBonus;
  if (month >= 9 && month <= 11) {
    reasons.push({
      label: "Fall mullet outmigration — peak observation season",
      tone: "plus",
    });
  } else if (month >= 5 && month <= 8) {
    reasons.push({
      label: "Active calving / baitfish season — solid window",
      tone: "neutral",
    });
  } else if (month <= 2) {
    reasons.push({
      label: "Mid-winter — fewer reported sightings in the creeks",
      tone: "minus",
    });
  }

  // Weather (observer comfort, not biology).
  if (weather) {
    if (weather.windMphMax != null) {
      if (weather.windMphMax >= 20) {
        score -= 1;
        reasons.push({
          label: `Windy (${weather.windMphMax} mph forecast) — choppy water hides bow waves`,
          tone: "minus",
        });
      } else if (weather.windMphMax <= 10) {
        score += 0.5;
        reasons.push({
          label: `Calm (${weather.windMphMax} mph) — easier to spot fish leaps`,
          tone: "plus",
        });
      }
    }
    if (weather.precipChancePct != null && weather.precipChancePct >= 60) {
      score -= 1;
      reasons.push({
        label: `${weather.precipChancePct}% chance of rain — bring rain shells or skip`,
        tone: "minus",
      });
    }
    if (/thunder/i.test(weather.shortForecast)) {
      score -= 2;
      reasons.push({
        label: "Thunderstorms forecast — do not stand on an exposed bank",
        tone: "minus",
      });
    }
  } else {
    reasons.push({
      label: "No weather forecast yet — biology score only",
      tone: "neutral",
    });
  }

  // Rating buckets — chosen so a typical sunny-mid-tide-with-daylight day is
  // "marginal" and a deep-low + calm + daylight day climbs to "favorable".
  let rating: StrandRating;
  if (!best) rating = "unfavorable";
  else if (score >= 2.5) rating = "favorable";
  else if (score >= 0.5) rating = "marginal";
  else rating = "unfavorable";

  return {
    rating,
    score,
    reasons,
    bestWindow: best ? { start: best.start, end: best.end, low: best.low } : null,
  };
}

export function ratingLabel(r: StrandRating): string {
  switch (r) {
    case "favorable":
      return "Favorable";
    case "marginal":
      return "Marginal";
    case "unfavorable":
      return "Unfavorable";
  }
}

export function formatBestWindow(w: StrandScore["bestWindow"]): string | null {
  if (!w) return null;
  return `${formatClock(w.start)} – ${formatClock(w.end)}`;
}

