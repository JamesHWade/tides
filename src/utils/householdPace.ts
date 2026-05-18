// Pure types + defaults for the "household pace" concept (earliest out, latest
// end, kids' age band). Lives outside the React hook so pure modules like the
// schedule optimizer can import it without pulling in React.

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

export const KIDS_AGE_GROUPS: ReadonlyArray<KidsAgeGroup> = [
  "toddlers",
  "littleKids",
  "olderKids",
  "mixed",
];
