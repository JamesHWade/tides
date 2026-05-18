// Seasonal wildlife notes for the Kiawah / Seabrook / Lowcountry stretch.
// Each entry is associated with the month range when the behavior or
// observation peaks locally, sourced from the Kiawah Conservancy, SCDNR,
// the Town of Kiawah Island Turtle Patrol, and Audubon SC. Verify before
// using as a field guide — these are field-trip prompts, not regulations.

export type WildlifeKind =
  | "bird"
  | "reptile"
  | "mammal"
  | "marineMammal"
  | "fish"
  | "insect";

export type WildlifeNote = {
  id: string;
  /** Common name with a brief "what you're looking for". */
  title: string;
  kind: WildlifeKind;
  /** Months when this is most visible (1=Jan, 12=Dec). Inclusive range. */
  months: number[];
  /** One-sentence what / where / when. */
  blurb: string;
  /**
   * Optional pointer — where on or off the islands you're most likely to
   * see it. Short, no addresses.
   */
  where?: string;
  /** Source label + URL the family can pull up on a phone. */
  sourceLabel: string;
  sourceUrl: string;
};

export const WILDLIFE: WildlifeNote[] = [
  {
    id: "loggerhead-nesting",
    title: "Loggerhead sea turtle nesting",
    kind: "reptile",
    months: [5, 6, 7, 8],
    blurb:
      "Mothers crawl ashore at night from May–August; the Kiawah Turtle Patrol walks the beach at dawn to mark and protect new nests.",
    where: "Look for staked-off nests on Kiawah's beachfront; never disturb them or use white lights after dark.",
    sourceLabel: "Town of Kiawah Island — Turtle Patrol",
    sourceUrl: "https://www.kiawahisland.org/turtle-patrol/",
  },
  {
    id: "loggerhead-hatching",
    title: "Sea turtle hatchlings",
    kind: "reptile",
    months: [7, 8, 9, 10],
    blurb:
      "Nests laid in May–June begin hatching around late July; hatchlings emerge at night and crawl toward the brightest horizon.",
    where: "If you see a marked nest cordoned off with extra ribbons, it's close to hatching — keep flashlights off and stay well back.",
    sourceLabel: "SC Department of Natural Resources — Sea Turtles",
    sourceUrl: "https://www.dnr.sc.gov/seaturtle/",
  },
  {
    id: "painted-bunting",
    title: "Painted bunting",
    kind: "bird",
    months: [4, 5, 6, 7, 8, 9],
    blurb:
      "Males look like a paint-spill of red, green, and blue. Listen for their song from the edges of maritime forest in the morning.",
    where: "Boardwalks at the Lake House, Kiawah's Marsh View Tower, and trail edges near Mingo Point. Feeders sometimes have them.",
    sourceLabel: "Audubon South Carolina",
    sourceUrl: "https://sc.audubon.org/birds/painted-bunting",
  },
  {
    id: "wood-stork",
    title: "Wood storks",
    kind: "bird",
    months: [4, 5, 6, 7, 8, 9],
    blurb:
      "Large white-and-black waders with bare gray heads — federally threatened. They forage by feel in shallow tidal ponds.",
    where: "Freshwater lagoons along Kiawah's golf-course edges and the impoundments along Bohicket Road.",
    sourceLabel: "US Fish & Wildlife — Wood Stork",
    sourceUrl: "https://www.fws.gov/species/wood-stork-mycteria-americana",
  },
  {
    id: "shorebird-closures",
    title: "Shorebird nesting closures",
    kind: "bird",
    months: [3, 4, 5, 6, 7, 8],
    blurb:
      "Least terns, Wilson's plovers, and American oystercatchers nest on the open sand; rope-and-sign closures protect them through summer.",
    where: "Captain Sams Spit (west end of Kiawah) and the north end of Seabrook. Stay on the wet sand, leash dogs.",
    sourceLabel: "Audubon South Carolina — Coastal Bird Stewardship",
    sourceUrl: "https://sc.audubon.org/conservation/coastal-bird-stewardship-program",
  },
  {
    id: "alligator-lagoons",
    title: "American alligators in the lagoons",
    kind: "reptile",
    months: [4, 5, 6, 7, 8, 9, 10],
    blurb:
      "Warm freshwater lagoons hold gators, especially around dusk. They are wild — never feed them and keep kids and dogs back from the bank.",
    where: "Any of Kiawah's interior lagoons and the Seabrook Lake House lake edge. They cross paths and roads at night.",
    sourceLabel: "SCDNR — Alligators",
    sourceUrl: "https://www.dnr.sc.gov/wildlife/alligator/",
  },
  {
    id: "bottlenose-dolphin",
    title: "Bottlenose dolphins (year-round)",
    kind: "marineMammal",
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    blurb:
      "Resident dolphins work the Kiawah River and inlets all year. The famous strand-feeding behavior peaks Sep–Nov but happens in spring too.",
    where: "Captain Sams Inlet, north end of Seabrook, and from the Beachwalker side at low-tide mudbanks.",
    sourceLabel: "Lowcountry Marine Mammal Network",
    sourceUrl: "https://www.lowcountrymarinemammalnetwork.org/",
  },
  {
    id: "diamondback-terrapin",
    title: "Diamondback terrapins",
    kind: "reptile",
    months: [4, 5, 6, 7],
    blurb:
      "Salt-marsh turtles cross roads in late spring to lay eggs on high ground. Watch (and brake) for them on Kiawah Island Pkwy and Seabrook Island Rd.",
    sourceLabel: "SCDNR — Diamondback Terrapin",
    sourceUrl: "https://www.dnr.sc.gov/wildlife/terrapin.html",
  },
  {
    id: "mullet-strand",
    title: "Mullet outmigration (peak strand-feeding)",
    kind: "fish",
    months: [9, 10, 11],
    blurb:
      "Schools of mullet move out of the marshes in fall, and the dolphins follow — the best window of the year to watch a strand-feed.",
    where: "Captain Sams Inlet and the Kiawah River side of Beachwalker, within 2 hours of a daylight low tide.",
    sourceLabel: "NOAA Fisheries — Bottlenose Dolphin",
    sourceUrl: "https://www.fisheries.noaa.gov/species/common-bottlenose-dolphin",
  },
  {
    id: "right-whale-calving",
    title: "North Atlantic right whale calving",
    kind: "marineMammal",
    months: [12, 1, 2, 3],
    blurb:
      "The Georgia/SC bight is the only known calving ground for this critically endangered species. Sightings from shore are rare but possible — call in any to the hotline.",
    sourceLabel: "NOAA Fisheries — Right Whale",
    sourceUrl: "https://www.fisheries.noaa.gov/species/north-atlantic-right-whale",
  },
  {
    id: "monarch-migration",
    title: "Monarch butterfly migration",
    kind: "insect",
    months: [9, 10, 11],
    blurb:
      "Monarchs pulse south along the barrier islands in October, drifting through dune sunflower and goldenrod patches.",
    sourceLabel: "Journey North — Monarch Tracker",
    sourceUrl: "https://journeynorth.org/monarchs",
  },
  {
    id: "marsh-clapper-rail",
    title: "Clapper rails and marsh wrens",
    kind: "bird",
    months: [3, 4, 5, 6, 7, 8, 9],
    blurb:
      "Both species call constantly from the spartina at sunrise — clappers sound like a wooden clattering, wrens like a sewing machine.",
    where: "Any boardwalk over salt marsh; the Boardwalk #1 access on Seabrook is reliably loud at dawn.",
    sourceLabel: "Cornell Lab — eBird",
    sourceUrl: "https://ebird.org/region/US-SC-019",
  },
];

/**
 * Pick the wildlife notes that apply to the given month set (1–12).
 * The result is stable-sorted by note id for a deterministic UI order.
 */
export function wildlifeForMonths(months: ReadonlySet<number>): WildlifeNote[] {
  if (months.size === 0) return [];
  return WILDLIFE.filter((w) => w.months.some((m) => months.has(m))).sort(
    (a, b) => a.id.localeCompare(b.id),
  );
}

/** Month numbers (1–12) that the inclusive YYYY-MM-DD range spans. */
export function monthsInRange(
  startISO: string,
  endISO: string,
): Set<number> {
  const out = new Set<number>();
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ey, em, ed] = endISO.split("-").map(Number);
  const start = new Date(Date.UTC(sy, (sm ?? 1) - 1, sd ?? 1));
  const end = new Date(Date.UTC(ey, (em ?? 1) - 1, ed ?? 1));
  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.add(d.getUTCMonth() + 1);
  }
  return out;
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Preserve the iteration order of the Set (which is insertion order). The
// caller — `monthsInRange` — walks the trip day-by-day, so a Dec 28–Jan 3
// range arrives as {12, 1}, and we want "December & January", not the
// numerically sorted "January & December".
export function describeMonths(months: ReadonlySet<number>): string {
  const arr = [...months];
  if (arr.length === 0) return "";
  if (arr.length === 1) return MONTH_LABELS[arr[0] - 1];
  const labels = arr.map((m) => MONTH_LABELS[m - 1]);
  if (arr.length === 2) return labels.join(" & ");
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}
