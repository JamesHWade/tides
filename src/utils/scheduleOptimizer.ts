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
import {
  DEFAULT_PACE,
  type HouseholdPace,
  type KidsAgeGroup,
} from "./householdPace";
import type { DayWeather } from "./runtimeWeather";
import {
  addMinutes,
  formatClock,
  goodBeachWindows,
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
  /**
   * Family pace: earliest realistic "out the door" time, latest sane evening
   * end time, and kid age group. Falls back to a sensible default — the
   * smoke tests and any older callers can omit it.
   */
  pace?: HouseholdPace;
  now?: Date;
};

const PUBLIC_FALLBACK_IDS = [
  "freshfields-village",
  "bohicket-marina-walk",
  "public-beach-walk",
];

// Local mirrors of activityAccess's hasAll / hasAny. Kept inline so the
// optimizer can report *why* a gated activity is hidden without re-running
// isActivityAllowed (which collapses several causes into a single boolean).
function hasAllOfRule(
  flags: ReadonlyArray<keyof AccessSettings> | undefined,
  access: AccessSettings,
): boolean {
  if (!flags || flags.length === 0) return true;
  return flags.every((f) => access[f] === true);
}

function hasAnyOfRule(
  flags: ReadonlyArray<keyof AccessSettings> | undefined,
  access: AccessSettings,
): boolean {
  if (!flags || flags.length === 0) return true;
  return flags.some((f) => access[f] === true);
}

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

function ageFit(a: Activity, group: KidsAgeGroup): number {
  // Soft preference, not a hard filter — a "littleKids" trip should still
  // see "wholeFamily" picks rise to the top, with "toddlers"-only or
  // "olderKids"-only options scored down but still visible in the gated
  // list.
  if (a.kidFit === "wholeFamily" || group === "mixed") return 0;
  if (a.kidFit === group) return 0.5;
  // Adjacent bands (toddler/littleKids, littleKids/olderKids) are mild
  // mismatches; opposite ends (toddlers/olderKids) are bigger ones.
  const dist =
    (group === "toddlers" && a.kidFit === "olderKids") ||
    (group === "olderKids" && a.kidFit === "toddlers")
      ? 2
      : 1;
  return -1 * dist;
}

function activityScore(
  a: Activity,
  mood: WeatherMood,
  dateISO: string,
  pace: HouseholdPace,
): number {
  let score = 0;
  if (!isActivityInSeason(a, dateISO)) return -10;
  score += ageFit(a, pace.kidsAge);

  switch (a.kind) {
    case "pool":
      score += poolBoost(mood);
      break;
    case "indoor":
      score += indoorBoost(mood);
      // Indoor is also fine on a mild day, just less compelling.
      if (mood === "mild") score += 0.5;
      break;
    case "playground":
      // A 30–45 min outdoor stop — most welcome on mild/cool days, painful in
      // extreme heat where the metal/plastic structures bake.
      score += 1.5 + outdoorPenalty(mood);
      if (mood === "hot") score -= 1;
      break;
    case "racquet":
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
 * Trim a window against the nap interval. Returns every remaining
 * contiguous piece (≥ 60 min), sorted longest-first. Nap fully inside the
 * window produces two pieces; nap at one end produces one. The caller is
 * responsible for any further clipping (e.g. family hours) before picking.
 */
function trimAgainstNap(
  win: { start: Date; end: Date },
  nap: { start: Date; end: Date },
): Array<{ start: Date; end: Date }> {
  if (!windowsOverlap(win.start, win.end, nap.start, nap.end)) {
    return [win];
  }
  const candidates: Array<{ start: Date; end: Date }> = [];
  if (nap.start > win.start) {
    candidates.push({ start: win.start, end: nap.start });
  }
  if (nap.end < win.end) {
    candidates.push({ start: nap.end, end: win.end });
  }
  return candidates
    .filter((c) => c.end.getTime() - c.start.getTime() >= 60 * 60_000)
    .sort(
      (a, b) =>
        b.end.getTime() - b.start.getTime() - (a.end.getTime() - a.start.getTime()),
    );
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function optimizeDaySchedule(input: ScheduleInput): DaySchedule {
  const { day, nap, weather, access } = input;
  const pace = input.pace ?? DEFAULT_PACE;
  const mood = moodFor(weather);
  const naps = napInterval(day.date, nap);
  const sun = sunTimes(day.date);
  const strand = scoreStrandDay(day, weather);
  const isTravelDay = isTravelNote(day.notes);
  const familyStart = timeOn(day.date, pace.earliestStart);
  const familyEnd = timeOn(day.date, pace.latestEnd);

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

  // Helper bound to this day's family-pace window. Returns null if the
  // remaining piece is < 45 min (no point recommending a 20-min slot).
  const clipToFamilyHours = (win: { start: Date; end: Date }) => {
    if (win.end <= familyStart || win.start >= familyEnd) return null;
    const s = win.start < familyStart ? familyStart : win.start;
    const e = win.end > familyEnd ? familyEnd : win.end;
    if (e.getTime() - s.getTime() < 45 * 60_000) return null;
    return { start: s, end: e };
  };

  // Pick the best remaining nap-trimmed + family-clipped segment from a raw
  // window. Considers every piece left after the nap split, not just the
  // largest — a short pre-nap segment that survives the family clip is
  // better than a long post-nap segment that doesn't.
  const pickBestPacedSegment = (
    raw: { start: Date; end: Date },
  ): { start: Date; end: Date } | null => {
    const segments = trimAgainstNap(raw, naps);
    let best: { start: Date; end: Date } | null = null;
    let bestLen = 0;
    for (const seg of segments) {
      const paced = clipToFamilyHours(seg);
      if (!paced) continue;
      const len = paced.end.getTime() - paced.start.getTime();
      if (len > bestLen) {
        best = paced;
        bestLen = len;
      }
    }
    return best;
  };

  // 3. Strand block. Skip on thunderstorm days.
  let strandBlock: ScheduleBlock | null = null;
  let usedStrandLowTime: string | null = null;
  if (
    strand.bestWindow &&
    mood !== "thunder" &&
    (strand.rating === "favorable" || strand.rating === "marginal")
  ) {
    const pacedStrand = pickBestPacedSegment(strand.bestWindow);
    if (pacedStrand) {
      strandBlock = {
        id: `strand-${day.date}`,
        label: "Strand-feeding watch + low-tide beach walk",
        start: pacedStrand.start,
        end: pacedStrand.end,
        kind: "strand",
        confidence: strand.rating === "favorable" ? "high" : "medium",
        reason: `Anchored to the ${strand.bestWindow.low.displayTime.toLowerCase()} low. Stay ≥15 yds from the waterline; sightings are never guaranteed.`,
      };
      blocks.push(strandBlock);
      usedStrandLowTime = strand.bestWindow.low.time;
    }
  }

  // 4. Beach-play block. Beach time is good anywhere except ±90 min of high
  // tide; the time near a low is just the best of it. Each candidate window
  // is nap-trimmed, family-clipped, and ranked. If a strand block already
  // covers a window's anchor low, prefer a different window.
  const beachWindows = goodBeachWindows(day, sun, 90);
  type PlayCandidate = {
    raw: Window;
    paced: { start: Date; end: Date };
    /** Whether the chosen segment still includes the low-tide moment. */
    nearLow: boolean;
    /** The anchor low (if any), kept even when the segment splits off. */
    anchorLow?: typeof beachWindows[number]["tide"];
  };
  const playCandidates: PlayCandidate[] = [];
  for (const w of beachWindows) {
    const paced = pickBestPacedSegment(w);
    if (!paced) continue;
    const lowCenter = w.tide ? timeOn(day.date, w.tide.time).getTime() : null;
    const nearLow =
      lowCenter != null &&
      lowCenter >= paced.start.getTime() &&
      lowCenter <= paced.end.getTime();
    playCandidates.push({ raw: w, paced, nearLow, anchorLow: w.tide });
  }

  // Rank: prefer windows anchored on a daylight low; longer is better.
  playCandidates.sort((a, b) => {
    if (a.nearLow !== b.nearLow) return a.nearLow ? -1 : 1;
    const aLen = a.paced.end.getTime() - a.paced.start.getTime();
    const bLen = b.paced.end.getTime() - b.paced.start.getTime();
    return bLen - aLen;
  });

  let chosenPlay: PlayCandidate | null = null;
  for (const cand of playCandidates) {
    if (
      cand.anchorLow &&
      usedStrandLowTime === cand.anchorLow.time &&
      cand.nearLow
    ) {
      continue;
    }
    if (
      strandBlock &&
      windowsOverlap(
        cand.paced.start,
        cand.paced.end,
        strandBlock.start,
        strandBlock.end,
      )
    ) {
      continue;
    }
    chosenPlay = cand;
    break;
  }
  if (chosenPlay) {
    const low = chosenPlay.anchorLow;
    const pacedStartMins =
      chosenPlay.paced.start.getUTCHours() * 60 +
      chosenPlay.paced.start.getUTCMinutes();
    const lowTimeMins = low
      ? (() => {
          const [h, m] = low.time.split(":").map(Number);
          return (h ?? 0) * 60 + (m ?? 0);
        })()
      : null;
    // "Early low": the low is before the chosen segment, but specifically
    // close enough that the after-low side is the segment we picked. We
    // require the low to be no more than ~2 h before the segment start —
    // otherwise the segment is on the wrong side of the nap (or the day),
    // and the "too early, but the sand stays workable" copy would be
    // misleading.
    const earlyLow =
      low != null &&
      lowTimeMins != null &&
      lowTimeMins < pacedStartMins &&
      pacedStartMins - lowTimeMins <= 120;
    const idSuffix = low ? low.time : chosenPlay.paced.start.toISOString();
    let reason: string;
    if (chosenPlay.nearLow && low) {
      reason = `Centered on the ${low.displayTime.toLowerCase()} low (${low.heightFt.toFixed(1)} ft). Flat sand and shallow pools.`;
    } else if (earlyLow && low) {
      reason = `Low was at ${low.displayTime.toLowerCase()} — too early for kids, but you're well clear of high tide for a few hours after.`;
    } else {
      // Anchor low (if any) is far from the segment — nap or family hours
      // put it out of reach. Don't mention it; the segment is good for
      // being away from high tide, not for being near a low.
      reason = "Well away from high tide — the wet-sand strip is workable even without a nearby low.";
    }
    blocks.push({
      id: `play-${day.date}-${idSuffix}`,
      label: chosenPlay.nearLow ? "Low-tide beach play" : "Beach time (away from high tide)",
      start: chosenPlay.paced.start,
      end: chosenPlay.paced.end,
      kind: "tide",
      confidence: chosenPlay.nearLow ? "high" : "medium",
      reason,
    });
  }

  // 5. Choose one allowed activity per "slot": morning and afternoon-after-nap.
  // Slot boundaries are clamped to the family's earliestStart / latestEnd on
  // both sides so a 6 AM "morning slot" never offers anything, a 9 AM
  // latestEnd doesn't leak past nap, and a 16:00 earliestStart pushes the
  // afternoon slot forward instead of starting at 15:00.
  type Slot = { name: string; start: Date; end: Date };
  const slots: Slot[] = [
    {
      name: "morning",
      start: familyStart > naps.start ? naps.start : familyStart,
      end: familyEnd < naps.start ? familyEnd : naps.start,
    },
    {
      name: "afternoon",
      start: familyStart > naps.end ? familyStart : naps.end,
      end: familyEnd < naps.end ? naps.end : familyEnd,
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
      .map((a) => ({ a, s: activityScore(a, mood, day.date, pace) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);

    let chosenBlock: ScheduleBlock | null = null;
    for (const { a, s } of ranked) {
      // Start at the later of slot-open and activity-open so a dining option
      // with `open: 17:00` can still land in a 15:00–19:00 afternoon slot.
      const hours = activityHoursOn(a, day.date);
      const desiredStart =
        hours && hours.open > slot.start ? hours.open : slot.start;
      if (desiredStart >= slot.end) continue;
      const dur = Math.min(
        a.durationMins,
        slot.end.getTime() - desiredStart.getTime(),
      );
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

  // 6. Public fallback list — always present, anchored to the family's
  // late-afternoon window (or clamped if their day ends earlier). When the
  // day is so short that `familyEnd - 90 min` would precede `familyStart`,
  // clamp up to `familyStart` so the fallback never schedules before the
  // family is even out the door.
  const publicFallback: ScheduleBlock[] = [];
  const sixteenHundred = timeOn(day.date, "16:00");
  const fallbackStart = (() => {
    if (familyEnd >= sixteenHundred) return sixteenHundred;
    const candidate = addMinutes(familyEnd, -90);
    return candidate < familyStart ? familyStart : candidate;
  })();
  for (const id of PUBLIC_FALLBACK_IDS) {
    const a = ACTIVITIES.find((x) => x.id === id);
    if (!a) continue;
    const block = buildActivityBlock(
      a,
      day.date,
      fallbackStart,
      a.durationMins,
      "Open to anyone — no club credentials needed.",
      "fallback",
    );
    if (block) publicFallback.push(block);
  }

  // 7. Skipped list — for the "available if you have access" UI. When the
  // family has the credentials but turned on preferPublicOnly, the activity
  // was hidden by their own filter, not by missing access — explain that.
  for (const a of gated) {
    const hasFlags =
      hasAllOfRule(a.access.allOf, access) &&
      hasAnyOfRule(a.access.anyOf, access);
    let reason: string;
    if (access.preferPublicOnly && hasFlags && a.access.public !== true) {
      reason = "Hidden by your public-only preference.";
    } else if (
      access.preferPublicOnly &&
      a.access.public === true &&
      a.reservationRequired === true
    ) {
      reason = "Hidden by public-only preference (needs reservation).";
    } else {
      reason = "Requires access you haven't enabled yet.";
    }
    skipped.push({ activityId: a.id, reason });
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

/**
 * Pick "best day for X" across a range.
 *
 * The strand/pool/indoor picks rank by each schedule's own `score`. For the
 * public-only pick, fallback list length is uninformative (it's a fixed
 * 3-item set), so callers can pass a second `publicOnlySchedules` array
 * — schedules computed once with `preferPublicOnly: true` — and the highest
 * `score` from that set is used.
 */
export function pickBestDays(
  schedules: DaySchedule[],
  publicOnlySchedules?: DaySchedule[],
): BestDays {
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
  const publicSource = publicOnlySchedules ?? schedules;
  const publicPick = publicSource
    .slice()
    .sort((a, b) => b.score - a.score)[0];
  if (publicPick) result.publicOnly = publicPick;
  return result;
}
