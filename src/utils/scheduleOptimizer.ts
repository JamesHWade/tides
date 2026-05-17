// Pure-logic schedule optimizer. Given a day's tides, weather, nap window,
// and amenity-access settings, produce a small list of recommended blocks
// (morning / nap / afternoon / evening) plus a public fallback.
//
// The optimizer never schedules an activity the family cannot get into. It
// surfaces gated activities separately so the UI can say "available if you
// have access" without putting them in the main plan.

import type { DayPlan } from "../data/tides";
import type { Activity } from "../data/activities";
import { ACTIVITIES } from "../data/activities";
import type { AccessSettings } from "../hooks/useAccessSettings";
import type { DayWeather } from "./runtimeWeather";
import {
  addMinutes,
  conflictsWithNap,
  formatClock,
  lowTidePlayWindow,
  napInterval,
  timeOn,
  windowsOverlap,
  type NapSettings,
  type Window,
} from "./tideUtils";
import { sunTimes } from "./sunTimes";
import { scoreStrandDay } from "./strandScore";
import {
  activityHoursOn,
  isActivityAllowed,
  isActivityInSeason,
} from "./activityAccess";

export type ScheduleBlockKind =
  | "fixed"
  | "tide"
  | "strand"
  | "activity"
  | "meal"
  | "fallback";

export type ScheduleBlock = {
  id: string;
  label: string;
  start: Date;
  end: Date;
  activityId?: string;
  kind: ScheduleBlockKind;
  confidence: "high" | "medium" | "low";
  reason: string;
  warnings?: string[];
};

export type BestUseOfDay =
  | "strandAttempt"
  | "beachPlay"
  | "poolDay"
  | "indoorFallback"
  | "travelLight";

export type DaySchedule = {
  date: string;
  /** Internal sortable score; not shown to the user. */
  score: number;
  /** One-line "best plan with your access" headline. */
  headline: string;
  bestUseOfDay: BestUseOfDay;
  blocks: ScheduleBlock[];
  /** Activities skipped because they're gated by missing access flags. */
  skipped: Array<{ activityId: string; reason: string }>;
  /** Public-only suggestions, always populated. */
  publicFallback: ScheduleBlock[];
  /** Labels for gated areas hidden from the main plan, e.g. "Kiawah pools". */
  hiddenAreasNote: string | null;
};

export type ScheduleInput = {
  day: DayPlan;
  allDays: DayPlan[];
  nap: NapSettings;
  weather?: DayWeather;
  access: AccessSettings;
  now?: Date;
};

const PUBLIC_FALLBACK_IDS = [
  "freshfields-village",
  "bohicket-marina-walk",
  "public-beach-walk",
];

// ---------------------------------------------------------------------------
// Weather classification
// ---------------------------------------------------------------------------

type WeatherMood =
  | "thunder"
  | "rainy"
  | "hot"
  | "windy"
  | "mild"
  | "unknown";

function moodFor(weather: DayWeather | undefined): WeatherMood {
  if (!weather) return "unknown";
  if (/thunder|t-storm/i.test(weather.shortForecast)) return "thunder";
  if (weather.precipChancePct != null && weather.precipChancePct >= 60) return "rainy";
  if (weather.highF != null && weather.highF >= 88) return "hot";
  if (weather.windMphMax != null && weather.windMphMax >= 20) return "windy";
  return "mild";
}

function poolBoost(mood: WeatherMood): number {
  switch (mood) {
    case "hot":
      return 3;
    case "mild":
      return 2;
    case "windy":
      return 1;
    case "rainy":
    case "thunder":
      return -3;
    default:
      return 1;
  }
}

function indoorBoost(mood: WeatherMood): number {
  switch (mood) {
    case "thunder":
      return 4;
    case "rainy":
      return 3;
    case "hot":
      return 2;
    default:
      return 0;
  }
}

function outdoorPenalty(mood: WeatherMood): number {
  switch (mood) {
    case "thunder":
      return -4;
    case "rainy":
      return -2;
    case "windy":
      return -1;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Activity scoring
// ---------------------------------------------------------------------------

function activityScore(
  a: Activity,
  mood: WeatherMood,
  dateISO: string,
): number {
  let score = 0;
  if (!isActivityInSeason(a, dateISO)) return -10;

  switch (a.kind) {
    case "pool":
      score += poolBoost(mood);
      break;
    case "indoor":
      score += indoorBoost(mood);
      // Indoor is also fine on a mild day, just less compelling.
      if (mood === "mild") score += 0.5;
      break;
    case "nature":
    case "beach":
    case "boat":
    case "equine":
    case "shopping":
    case "event":
      score += 2 + outdoorPenalty(mood);
      break;
    case "dining":
      score += 1;
      break;
    case "strandWatch":
      // Strand is anchored by scoreStrandDay rather than the activity catalog.
      score += 1;
      break;
  }

  if (a.reservationRequired) score -= 0.5; // small friction penalty
  if (a.access.public) score += 0.25;
  return score;
}

// ---------------------------------------------------------------------------
// Block construction helpers
// ---------------------------------------------------------------------------

function clampToHours(
  desiredStart: Date,
  desiredEnd: Date,
  hours: { open: Date; close: Date } | null,
): { start: Date; end: Date } | null {
  let s = desiredStart;
  let e = desiredEnd;
  if (hours) {
    if (e <= hours.open || s >= hours.close) return null;
    if (s < hours.open) s = hours.open;
    if (e > hours.close) e = hours.close;
  }
  if (e.getTime() - s.getTime() < 30 * 60_000) return null;
  return { start: s, end: e };
}

function buildActivityBlock(
  activity: Activity,
  dateISO: string,
  desiredStart: Date,
  durationMins: number,
  reason: string,
  kind: ScheduleBlockKind = "activity",
): ScheduleBlock | null {
  const hours = activityHoursOn(activity, dateISO);
  const desiredEnd = addMinutes(desiredStart, durationMins);
  const clamped = clampToHours(desiredStart, desiredEnd, hours);
  if (!clamped) return null;
  const warnings: string[] = [];
  if (activity.reservationRequired) {
    warnings.push("Reservation required");
  }
  if (hours?.note) warnings.push(hours.note);
  return {
    id: `${activity.id}-${dateISO}-${desiredStart.toISOString()}`,
    label: activity.name,
    start: clamped.start,
    end: clamped.end,
    activityId: activity.id,
    kind,
    confidence: activity.reservationRequired ? "medium" : "high",
    reason,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function fixedBlock(
  id: string,
  label: string,
  start: Date,
  end: Date,
  reason: string,
  kind: ScheduleBlockKind = "fixed",
  confidence: ScheduleBlock["confidence"] = "high",
): ScheduleBlock {
  return { id, label, start, end, kind, confidence, reason };
}

// ---------------------------------------------------------------------------
// Best use of day
// ---------------------------------------------------------------------------

function pickBestUseOfDay(
  mood: WeatherMood,
  hasStrandWindow: boolean,
  hasBeachWindow: boolean,
  isTravelDay: boolean,
): BestUseOfDay {
  if (isTravelDay) return "travelLight";
  if (mood === "thunder" || mood === "rainy") return "indoorFallback";
  if (hasStrandWindow) return "strandAttempt";
  if (mood === "hot") return "poolDay";
  if (hasBeachWindow) return "beachPlay";
  return "indoorFallback";
}

function isTravelNote(notes: string[] | undefined): boolean {
  if (!notes) return false;
  return notes.some((n) => /travel/i.test(n));
}

// ---------------------------------------------------------------------------
// Strand block helpers
// ---------------------------------------------------------------------------

/**
 * Trim a strand window against the nap interval. Returns the largest
 * remaining contiguous piece, or null if it's < 60 minutes.
 *
 * Nap fully inside the window splits it into two pieces — we keep the longer.
 */
function trimAgainstNap(
  win: { start: Date; end: Date },
  nap: { start: Date; end: Date },
): { start: Date; end: Date } | null {
  if (!windowsOverlap(win.start, win.end, nap.start, nap.end)) {
    return win;
  }
  const candidates: Array<{ start: Date; end: Date }> = [];
  if (nap.start > win.start) {
    candidates.push({ start: win.start, end: nap.start });
  }
  if (nap.end < win.end) {
    candidates.push({ start: nap.end, end: win.end });
  }
  candidates.sort(
    (a, b) => b.end.getTime() - b.start.getTime() - (a.end.getTime() - a.start.getTime()),
  );
  const best = candidates[0];
  if (!best) return null;
  if (best.end.getTime() - best.start.getTime() < 60 * 60_000) return null;
  return best;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function optimizeDaySchedule(input: ScheduleInput): DaySchedule {
  const { day, nap, weather, access } = input;
  const mood = moodFor(weather);
  const naps = napInterval(day.date, nap);
  const sun = sunTimes(day.date);
  const strand = scoreStrandDay(day, weather);
  const isTravelDay = isTravelNote(day.notes);

  const blocks: ScheduleBlock[] = [];
  const skipped: Array<{ activityId: string; reason: string }> = [];

  // 1. Fixed nap block — anchors the day visually.
  blocks.push(
    fixedBlock(
      `nap-${day.date}`,
      "Nap window",
      naps.start,
      naps.end,
      `Nap ${formatClock(naps.start)}–${formatClock(naps.end)}`,
      "fixed",
    ),
  );

  // 2. Travel-day annotation when applicable.
  if (isTravelDay) {
    blocks.push(
      fixedBlock(
        `travel-${day.date}`,
        "Travel day — keep plans flexible",
        timeOn(day.date, "08:00"),
        timeOn(day.date, "10:00"),
        "Travel / transition day — short, low-effort plans only.",
        "fixed",
        "low",
      ),
    );
  }

  // 3. Strand block. Skip on thunderstorm days.
  let strandBlock: ScheduleBlock | null = null;
  let usedStrandLowTime: string | null = null;
  if (
    strand.bestWindow &&
    mood !== "thunder" &&
    (strand.rating === "favorable" || strand.rating === "marginal")
  ) {
    const trimmed = trimAgainstNap(strand.bestWindow, naps);
    if (trimmed) {
      strandBlock = {
        id: `strand-${day.date}`,
        label: "Strand-feeding watch + low-tide beach walk",
        start: trimmed.start,
        end: trimmed.end,
        kind: "strand",
        confidence: strand.rating === "favorable" ? "high" : "medium",
        reason: `Anchored to the ${strand.bestWindow.low.displayTime.toLowerCase()} low. Stay ≥15 yds from the waterline; sightings are never guaranteed.`,
      };
      blocks.push(strandBlock);
      usedStrandLowTime = strand.bestWindow.low.time;
    }
  }

  // 4. Beach-play block on a daylight low (skip duplicate if strand block
  // already occupies the same low).
  const lows = day.tides.filter((t) => t.type === "Low");
  const playWindows: Array<{ win: Window; lowTime: string }> = lows
    .map((l) => {
      const w = lowTidePlayWindow(day, l, 90, sun);
      return w ? { win: w, lowTime: l.time } : null;
    })
    .filter((x): x is { win: Window; lowTime: string } => x != null);

  // Pick the best daylight play window that doesn't fully collide with nap.
  let chosenPlay: { win: Window; lowTime: string } | null = null;
  for (const candidate of playWindows) {
    if (usedStrandLowTime === candidate.lowTime) continue;
    if (conflictsWithNap(candidate.win, naps)) continue;
    if (
      strandBlock &&
      windowsOverlap(
        candidate.win.start,
        candidate.win.end,
        strandBlock.start,
        strandBlock.end,
      )
    ) {
      continue;
    }
    chosenPlay = candidate;
    break;
  }
  if (chosenPlay) {
    blocks.push({
      id: `play-${day.date}-${chosenPlay.lowTime}`,
      label: "Low-tide beach play",
      start: chosenPlay.win.start,
      end: chosenPlay.win.end,
      kind: "tide",
      confidence: "high",
      reason: `Centered on the ${chosenPlay.win.tide?.displayTime.toLowerCase()} low (${chosenPlay.win.tide?.heightFt.toFixed(1)} ft). Flat sand and shallow pools.`,
    });
  }

  // 5. Choose one allowed activity per "slot": morning and afternoon-after-nap.
  type Slot = { name: string; start: Date; end: Date };
  const slots: Slot[] = [
    {
      name: "morning",
      start: timeOn(day.date, "09:00"),
      end: naps.start,
    },
    {
      name: "afternoon",
      start: naps.end,
      end: timeOn(day.date, "19:00"),
    },
  ];

  const allowed: Activity[] = [];
  const gated: Activity[] = [];
  for (const a of ACTIVITIES) {
    if (!isActivityInSeason(a, day.date)) continue;
    if (isActivityAllowed(a, access)) allowed.push(a);
    else gated.push(a);
  }

  for (const slot of slots) {
    // Don't double-book a slot that's already covered by strand or play.
    const occupied = blocks.some(
      (b) =>
        b.kind !== "fixed" &&
        windowsOverlap(b.start, b.end, slot.start, slot.end),
    );
    if (occupied) continue;
    if (slot.end.getTime() - slot.start.getTime() < 45 * 60_000) continue;

    // Rank allowed activities for this slot.
    const ranked = allowed
      .map((a) => ({ a, s: activityScore(a, mood, day.date) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);

    let chosenBlock: ScheduleBlock | null = null;
    for (const { a, s } of ranked) {
      const desiredStart = slot.start;
      const dur = Math.min(a.durationMins, slot.end.getTime() - slot.start.getTime());
      const block = buildActivityBlock(
        a,
        day.date,
        desiredStart,
        dur,
        `${slotReason(slot.name, mood, a)} · score ${s.toFixed(1)}`,
      );
      if (block) {
        chosenBlock = block;
        break;
      }
    }
    if (chosenBlock) blocks.push(chosenBlock);
  }

  // 6. Public fallback list — always present.
  const publicFallback: ScheduleBlock[] = [];
  for (const id of PUBLIC_FALLBACK_IDS) {
    const a = ACTIVITIES.find((x) => x.id === id);
    if (!a) continue;
    const block = buildActivityBlock(
      a,
      day.date,
      timeOn(day.date, "16:00"),
      a.durationMins,
      "Open to anyone — no club credentials needed.",
      "fallback",
    );
    if (block) publicFallback.push(block);
  }

  // 7. Skipped (gated) list — for "available if you have access" UI.
  for (const a of gated) {
    skipped.push({
      activityId: a.id,
      reason: "Requires access you haven't enabled yet.",
    });
  }

  // 8. Sort blocks by start time.
  blocks.sort((a, b) => a.start.getTime() - b.start.getTime());

  // 9. Compute the rollup.
  const bestUse = pickBestUseOfDay(
    mood,
    !!strandBlock,
    !!chosenPlay,
    isTravelDay,
  );

  const dayScore = computeDayScore({
    strand,
    napFit: chosenPlay ? 1 : 0.6,
    mood,
    allowedActivityCount: allowed.length,
    publicFallbackCount: publicFallback.length,
    isTravelDay,
  });

  const headline = composeHeadline(bestUse, mood, strand.rating, isTravelDay);
  const hiddenAreasNote = composeHiddenAreasNote(access);

  return {
    date: day.date,
    score: dayScore,
    headline,
    bestUseOfDay: bestUse,
    blocks,
    skipped,
    publicFallback,
    hiddenAreasNote,
  };
}

// ---------------------------------------------------------------------------
// Copy helpers
// ---------------------------------------------------------------------------

function slotReason(slot: string, mood: WeatherMood, a: Activity): string {
  if (a.kind === "pool" && mood === "hot") return "Hot day — pool for heat relief";
  if (a.kind === "indoor" && (mood === "rainy" || mood === "thunder")) {
    return "Rain/thunder — indoor fallback";
  }
  if (a.kind === "dining") return "Dining option in this slot";
  if (slot === "morning") return "Morning slot before nap";
  return "Afternoon slot after nap";
}

function composeHeadline(
  use: BestUseOfDay,
  mood: WeatherMood,
  rating: "favorable" | "marginal" | "unfavorable",
  isTravelDay: boolean,
): string {
  if (isTravelDay) return "Travel day — keep plans short and flexible.";
  switch (use) {
    case "strandAttempt":
      return rating === "favorable"
        ? "Best strand-feeding attempt of the day."
        : "Strand-feeding attempt with a marginal window.";
    case "beachPlay":
      return "Low-tide beach play is the highlight today.";
    case "poolDay":
      return mood === "hot"
        ? "Hot day — lean into pool time and shade."
        : "Pool day — easy heat relief.";
    case "indoorFallback":
      return mood === "thunder"
        ? "Thunder in the forecast — indoor/public fallback plan."
        : "Rainy or quiet day — indoor and public-area plan.";
    case "travelLight":
      return "Travel day — keep plans light.";
  }
}

function composeHiddenAreasNote(access: AccessSettings): string | null {
  const hidden: string[] = [];
  if (!access.kiawahResortGuest && !access.kiawahGovernorClub) {
    hidden.push("Kiawah pools");
  }
  if (!access.kiawahSanctuaryGuest) hidden.push("Sanctuary pools");
  if (!access.seabrookDigitalAmenityPass) hidden.push("Seabrook Beach Club");
  if (!access.seabrookClubAccessAmenityCard) hidden.push("Seabrook club dining");
  if (hidden.length === 0) return null;
  return hidden.join(" · ");
}

// ---------------------------------------------------------------------------
// Internal day score
// ---------------------------------------------------------------------------

function computeDayScore(args: {
  strand: ReturnType<typeof scoreStrandDay>;
  napFit: number;
  mood: WeatherMood;
  allowedActivityCount: number;
  publicFallbackCount: number;
  isTravelDay: boolean;
}): number {
  const strandNorm = Math.max(0, Math.min(1, (args.strand.score + 2) / 6));
  const weatherComfort = (() => {
    switch (args.mood) {
      case "thunder":
        return 0.1;
      case "rainy":
        return 0.3;
      case "windy":
        return 0.55;
      case "hot":
        return 0.6;
      case "mild":
        return 0.9;
      case "unknown":
        return 0.6;
    }
  })();
  const allowedQuality = Math.min(1, args.allowedActivityCount / 6);
  const publicQuality = Math.min(1, args.publicFallbackCount / 3);
  const travelPenalty = args.isTravelDay ? 8 : 0;
  return (
    strandNorm * 35 +
    args.napFit * 15 +
    weatherComfort * 15 +
    allowedQuality * 20 +
    publicQuality * 10 -
    travelPenalty
  );
}

// ---------------------------------------------------------------------------
// Best-of-range helpers
// ---------------------------------------------------------------------------

export type BestDays = {
  strand?: DaySchedule;
  pool?: DaySchedule;
  indoor?: DaySchedule;
  publicOnly?: DaySchedule;
};

export function pickBestDays(schedules: DaySchedule[]): BestDays {
  const result: BestDays = {};
  const strandPick = schedules
    .filter((s) => s.bestUseOfDay === "strandAttempt")
    .sort((a, b) => b.score - a.score)[0];
  if (strandPick) result.strand = strandPick;
  const poolPick = schedules
    .filter((s) => s.bestUseOfDay === "poolDay")
    .sort((a, b) => b.score - a.score)[0];
  if (poolPick) result.pool = poolPick;
  const indoorPick = schedules
    .filter((s) => s.bestUseOfDay === "indoorFallback")
    .sort((a, b) => b.score - a.score)[0];
  if (indoorPick) result.indoor = indoorPick;
  const publicPick = schedules
    .filter((s) => s.publicFallback.length > 0)
    .sort((a, b) => b.publicFallback.length - a.publicFallback.length)[0];
  if (publicPick) result.publicOnly = publicPick;
  return result;
}
