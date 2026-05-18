import { useEffect, useState } from "react";
import {
  DEFAULT_PACE,
  KIDS_AGE_GROUPS,
  type HouseholdPace,
  type KidsAgeGroup,
} from "../utils/householdPace";

// Re-export so existing component imports keep working without a churn diff.
export { DEFAULT_PACE } from "../utils/householdPace";
export type { HouseholdPace, KidsAgeGroup } from "../utils/householdPace";

const STORAGE_KEY = "tides.pace.v1";

function isKidsAge(v: unknown): v is KidsAgeGroup {
  return typeof v === "string" && (KIDS_AGE_GROUPS as readonly string[]).includes(v);
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
