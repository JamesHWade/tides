import { useEffect, useState } from "react";

const STORAGE_KEY = "tides.pace.v1";

export type KidsAgeGroup = "toddlers" | "littleKids" | "olderKids" | "mixed";

export type HouseholdPace = {
  /** Earliest realistic "out the door" time, 24h HH:MM. */
  earliestStart: string;
  /** Latest realistic evening end time, 24h HH:MM. */
  latestEnd: string;
  /**
   * Age band of the kids in the trip. Lets the scheduler down-rank or hide
   * plans aimed at the wrong band (a toddler doesn't want a tennis lesson;
   * older kids don't need the splash zone).
   */
  kidsAge: KidsAgeGroup;
};

export const DEFAULT_PACE: HouseholdPace = {
  earliestStart: "08:30",
  latestEnd: "19:30",
  kidsAge: "littleKids",
};

const AGE_GROUPS: ReadonlyArray<KidsAgeGroup> = [
  "toddlers",
  "littleKids",
  "olderKids",
  "mixed",
];

function isKidsAge(v: unknown): v is KidsAgeGroup {
  return typeof v === "string" && (AGE_GROUPS as readonly string[]).includes(v);
}

function isHHMM(v: unknown): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}

function coerce(parsed: Partial<HouseholdPace> | null): HouseholdPace {
  if (!parsed || typeof parsed !== "object") return DEFAULT_PACE;
  return {
    earliestStart: isHHMM(parsed.earliestStart)
      ? parsed.earliestStart
      : DEFAULT_PACE.earliestStart,
    latestEnd: isHHMM(parsed.latestEnd) ? parsed.latestEnd : DEFAULT_PACE.latestEnd,
    kidsAge: isKidsAge(parsed.kidsAge) ? parsed.kidsAge : DEFAULT_PACE.kidsAge,
  };
}

function load(): HouseholdPace {
  if (typeof window === "undefined") return DEFAULT_PACE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PACE;
    return coerce(JSON.parse(raw) as Partial<HouseholdPace>);
  } catch {
    return DEFAULT_PACE;
  }
}

export function useHouseholdPace(): [
  HouseholdPace,
  (next: HouseholdPace) => void,
] {
  const [pace, setPace] = useState<HouseholdPace>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pace));
    } catch {
      // ignore quota / private mode
    }
  }, [pace]);

  return [pace, setPace];
}
