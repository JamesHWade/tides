// Static catalog of family-friendly activities around Kiawah / Seabrook /
// Freshfields / Bohicket. Access rules are encoded as data so the schedule
// optimizer can filter out anything the family can't get into without booking
// or buying access on the fly.
//
// This file deliberately does not scrape live calendars or reservation pages.
// Hours, season windows, and access rules come from public-facing source URLs
// recorded next to each activity (sourceUrl + lastVerifiedISO). Verify before
// the trip.

import type { AccessSettings } from "../hooks/useAccessSettings";

export type AccessFlag = keyof Omit<
  AccessSettings,
  "stayBase" | "preferPublicOnly"
>;

export type AccessRule = {
  /** Family must have ALL of these flags set to true. */
  allOf?: AccessFlag[];
  /** Family must have AT LEAST ONE of these flags set to true. */
  anyOf?: AccessFlag[];
  /** True if this activity is open to the public with no gated credentials. */
  public?: boolean;
};

export type ActivityKind =
  | "pool"
  | "beach"
  | "strandWatch"
  | "indoor"
  | "nature"
  | "dining"
  | "shopping"
  | "event"
  | "equine"
  | "boat"
  | "playground"
  | "racquet";

export type ActivityArea =
  | "kiawah"
  | "seabrook"
  | "freshfields"
  | "bohicket"
  | "beach";

export type ActivityWeatherFit = {
  goodWeather?: boolean;
  heatRelief?: boolean;
  rainyDay?: boolean;
  windyDay?: boolean;
};

export type ActivityHours = {
  /** Inclusive start of the season-window this hours rule applies to. */
  startISO?: string;
  /** Inclusive end of the season-window this hours rule applies to. */
  endISO?: string;
  /** 24h "HH:MM". */
  open: string;
  /** 24h "HH:MM". */
  close: string;
  note?: string;
};

export type Activity = {
  id: string;
  name: string;
  area: ActivityArea;
  kind: ActivityKind;
  durationMins: number;
  access: AccessRule;
  reservationRequired?: boolean;
  kidFit: "toddlers" | "littleKids" | "olderKids" | "wholeFamily";
  weatherFit: ActivityWeatherFit;
  season?: { startISO: string; endISO: string };
  hours?: ActivityHours[];
  sourceLabel: string;
  sourceUrl: string;
  lastVerifiedISO: string;
  plannerNotes?: string[];
};

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
//
// Source notes — verify before the trip:
//
//   * Kiawah resort pools (Night Heron, West Beach) are limited to Kiawah
//     Island Golf Resort guests and Governor's Club members; entry requires
//     the resort amenity card or a Governor's Club card.
//   * The Sanctuary pools are reserved for guests of The Sanctuary hotel.
//   * The Treehouse Activity Center is a useful indoor fallback; off-island
//     visitors need a confirmed activity reservation and must show the email
//     at the security gate.
//   * Seabrook Beach Club access (towels included) requires a Seabrook Island
//     Digital Amenity Pass. Pools open at 9 AM; Beach Club restaurant hours
//     change after May 22.
//   * Seabrook on-island club dining requires the Club Access Amenity Card;
//     they accept neither cash nor credit card.
//   * Freshfields Village publishes a free, family-friendly event calendar
//     and is open to anyone; Bohicket Marina hosts public dining and
//     boat-rental access.

export const ACTIVITIES: Activity[] = [
  // --- Kiawah ---------------------------------------------------------------
  {
    id: "kiawah-night-heron-pool",
    name: "Night Heron Park pool",
    area: "kiawah",
    kind: "pool",
    durationMins: 120,
    access: { anyOf: ["kiawahResortGuest", "kiawahGovernorClub"] },
    kidFit: "wholeFamily",
    weatherFit: { goodWeather: true, heatRelief: true },
    hours: [{ open: "10:00", close: "18:00" }],
    sourceLabel: "Kiawah Island Golf Resort — pools",
    sourceUrl: "https://kiawahresort.com/amenities/pools/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: [
      "Resort/Governor's Club card required at entry — front desk re-issues if you lose yours.",
    ],
  },
  {
    id: "kiawah-west-beach-pool",
    name: "West Beach Village pool",
    area: "kiawah",
    kind: "pool",
    durationMins: 120,
    access: { anyOf: ["kiawahResortGuest", "kiawahGovernorClub"] },
    kidFit: "wholeFamily",
    weatherFit: { goodWeather: true, heatRelief: true },
    hours: [{ open: "10:00", close: "18:00" }],
    sourceLabel: "Kiawah Island Golf Resort — pools",
    sourceUrl: "https://kiawahresort.com/amenities/pools/",
    lastVerifiedISO: "2026-05-17",
  },
  {
    id: "kiawah-sanctuary-pool",
    name: "The Sanctuary pools",
    area: "kiawah",
    kind: "pool",
    durationMins: 120,
    access: { allOf: ["kiawahSanctuaryGuest"] },
    kidFit: "wholeFamily",
    weatherFit: { goodWeather: true, heatRelief: true },
    hours: [{ open: "09:00", close: "19:00" }],
    sourceLabel: "The Sanctuary at Kiawah Island Golf Resort",
    sourceUrl: "https://kiawahresort.com/the-sanctuary/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: ["Sanctuary hotel guests only — not open to villa renters."],
  },
  {
    id: "kiawah-treehouse",
    name: "Treehouse Activity Center",
    area: "kiawah",
    kind: "indoor",
    durationMins: 90,
    access: {
      anyOf: [
        "kiawahResortGuest",
        "kiawahGovernorClub",
        "kiawahConfirmedRecreationReservation",
      ],
    },
    reservationRequired: true,
    kidFit: "littleKids",
    weatherFit: { rainyDay: true, heatRelief: true },
    hours: [{ open: "09:00", close: "17:00" }],
    sourceLabel: "Kiawah Island Recreation — Treehouse",
    sourceUrl: "https://kiawahresort.com/things-to-do/family-activities/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: [
      "Off-island guests need a confirmed activity reservation; show the email at the security gate.",
    ],
  },
  {
    id: "kiawah-nature-center",
    name: "Kiawah Nature Center",
    area: "kiawah",
    kind: "nature",
    durationMins: 60,
    access: {
      anyOf: ["kiawahResortGuest", "kiawahGovernorClub"],
    },
    kidFit: "wholeFamily",
    weatherFit: { rainyDay: true, goodWeather: true },
    hours: [{ open: "09:00", close: "17:00" }],
    sourceLabel: "Kiawah Island Recreation — Nature programs",
    sourceUrl: "https://kiawahresort.com/things-to-do/nature-programs/",
    lastVerifiedISO: "2026-05-17",
  },
  {
    id: "kiawah-art-studio",
    name: "Kiawah Art & Craft Studio",
    area: "kiawah",
    kind: "indoor",
    durationMins: 75,
    access: { anyOf: ["kiawahResortGuest", "kiawahGovernorClub"] },
    reservationRequired: true,
    kidFit: "littleKids",
    weatherFit: { rainyDay: true, heatRelief: true },
    hours: [{ open: "10:00", close: "16:00" }],
    sourceLabel: "Kiawah Island Recreation",
    sourceUrl: "https://kiawahresort.com/things-to-do/family-activities/",
    lastVerifiedISO: "2026-05-17",
  },
  {
    id: "kiawah-bowling-arcade",
    name: "Night Heron Park bowling & arcade",
    area: "kiawah",
    kind: "indoor",
    durationMins: 90,
    access: { anyOf: ["kiawahResortGuest", "kiawahGovernorClub"] },
    kidFit: "wholeFamily",
    weatherFit: { rainyDay: true },
    hours: [{ open: "12:00", close: "21:00" }],
    sourceLabel: "Kiawah Island Recreation",
    sourceUrl: "https://kiawahresort.com/things-to-do/family-activities/",
    lastVerifiedISO: "2026-05-17",
  },
  {
    id: "kiawah-night-heron-playground",
    name: "Night Heron Park playground",
    area: "kiawah",
    kind: "playground",
    durationMins: 45,
    access: { anyOf: ["kiawahResortGuest", "kiawahGovernorClub"] },
    kidFit: "littleKids",
    weatherFit: { goodWeather: true },
    hours: [{ open: "07:00", close: "20:00" }],
    sourceLabel: "Kiawah Island Recreation — Night Heron Park",
    sourceUrl: "https://kiawahresort.com/things-to-do/family-activities/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: [
      "Shaded play structure next to the pool — easy 30-min stop before or after pool time.",
    ],
  },

  // --- Seabrook -------------------------------------------------------------
  {
    id: "seabrook-beach-club-pool",
    name: "Seabrook Beach Club pool",
    area: "seabrook",
    kind: "pool",
    durationMins: 120,
    access: { allOf: ["seabrookDigitalAmenityPass"] },
    kidFit: "wholeFamily",
    weatherFit: { goodWeather: true, heatRelief: true },
    hours: [{ open: "09:00", close: "19:00" }],
    sourceLabel: "Seabrook Island Club — Beach Club",
    sourceUrl: "https://discoverseabrook.com/the-club/the-beach-club/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: ["Oceanfront pool + chair/towel service with the Digital Amenity Pass."],
  },
  {
    id: "seabrook-small-family-pool",
    name: "Seabrook small family pool",
    area: "seabrook",
    kind: "pool",
    durationMins: 90,
    access: { allOf: ["seabrookDigitalAmenityPass"] },
    kidFit: "toddlers",
    weatherFit: { goodWeather: true, heatRelief: true },
    hours: [{ open: "09:00", close: "18:00" }],
    sourceLabel: "Seabrook Island Club — pools",
    sourceUrl: "https://discoverseabrook.com/the-club/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: ["Quieter wading pool next to the Beach Club — best for toddlers."],
  },
  {
    id: "seabrook-lake-house-pool",
    name: "Lake House pool",
    area: "seabrook",
    kind: "pool",
    durationMins: 120,
    access: { allOf: ["seabrookDigitalAmenityPass"] },
    kidFit: "wholeFamily",
    weatherFit: { goodWeather: true, heatRelief: true },
    hours: [{ open: "09:00", close: "19:00" }],
    sourceLabel: "Seabrook Island Club — The Lake House",
    sourceUrl: "https://discoverseabrook.com/the-club/the-lake-house/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: [
      "Inland family pool at the Lake House — quieter than the Beach Club on hot afternoons.",
    ],
  },
  {
    id: "seabrook-lake-house-splash",
    name: "Lake House splash zone",
    area: "seabrook",
    kind: "pool",
    durationMins: 60,
    access: { allOf: ["seabrookDigitalAmenityPass"] },
    kidFit: "toddlers",
    weatherFit: { goodWeather: true, heatRelief: true },
    hours: [{ open: "09:00", close: "18:00" }],
    sourceLabel: "Seabrook Island Club — The Lake House",
    sourceUrl: "https://discoverseabrook.com/the-club/the-lake-house/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: ["Zero-entry splash area — easy water play for under-5s."],
  },
  {
    id: "seabrook-lake-house-playground",
    name: "Lake House playground",
    area: "seabrook",
    kind: "playground",
    durationMins: 45,
    access: { allOf: ["seabrookDigitalAmenityPass"] },
    kidFit: "littleKids",
    weatherFit: { goodWeather: true },
    hours: [{ open: "07:00", close: "20:00" }],
    sourceLabel: "Seabrook Island Club — The Lake House",
    sourceUrl: "https://discoverseabrook.com/the-club/the-lake-house/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: [
      "Shaded playground next to the Lake House — pair with the splash zone or a Lake House meal.",
    ],
  },
  {
    id: "seabrook-racquet-club",
    name: "Seabrook Racquet Club (tennis / pickleball)",
    area: "seabrook",
    kind: "racquet",
    durationMins: 75,
    access: { allOf: ["seabrookRacquetClubReservation"] },
    reservationRequired: true,
    kidFit: "olderKids",
    weatherFit: { goodWeather: true },
    hours: [{ open: "08:00", close: "19:00" }],
    sourceLabel: "Seabrook Island Racquet Club",
    sourceUrl: "https://discoverseabrook.com/the-club/the-racquet-club/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: [
      "Court reservations book in advance — call the pro shop the day before.",
    ],
  },
  {
    id: "seabrook-beach-club-dining",
    name: "Beach Club restaurant (Seabrook)",
    area: "seabrook",
    kind: "dining",
    durationMins: 75,
    access: { allOf: ["seabrookDigitalAmenityPass"] },
    kidFit: "wholeFamily",
    weatherFit: { rainyDay: true, goodWeather: true, heatRelief: true },
    // Trip-week hours: through May 21 → 10 AM – 6 PM; May 22+ → 10 AM – 8 PM.
    hours: [
      {
        startISO: "2026-05-17",
        endISO: "2026-05-21",
        open: "10:00",
        close: "18:00",
        note: "Through May 21, 2026",
      },
      {
        startISO: "2026-05-22",
        endISO: "2026-12-31",
        open: "10:00",
        close: "20:00",
        note: "Starting May 22, 2026",
      },
    ],
    sourceLabel: "Seabrook Beach Club dining",
    sourceUrl: "https://discoverseabrook.com/the-club/the-beach-club/",
    lastVerifiedISO: "2026-05-17",
  },
  {
    id: "seabrook-club-dining",
    name: "Seabrook on-island club dining",
    area: "seabrook",
    kind: "dining",
    durationMins: 75,
    access: { allOf: ["seabrookClubAccessAmenityCard"] },
    kidFit: "wholeFamily",
    weatherFit: { rainyDay: true, goodWeather: true },
    hours: [{ open: "17:00", close: "21:00" }],
    sourceLabel: "Seabrook Island Club — dining",
    sourceUrl: "https://discoverseabrook.com/the-club/dining/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: ["Club Access Amenity Card required — no cash or credit card accepted."],
  },
  {
    id: "seabrook-equestrian-pony-ride",
    name: "Seabrook equestrian pony ride",
    area: "seabrook",
    kind: "equine",
    durationMins: 60,
    access: { allOf: ["seabrookEquestrianReservation"] },
    reservationRequired: true,
    kidFit: "littleKids",
    weatherFit: { goodWeather: true },
    hours: [{ open: "09:00", close: "17:00" }],
    sourceLabel: "Seabrook Equestrian Center",
    sourceUrl: "https://discoverseabrook.com/the-club/equestrian-center/",
    lastVerifiedISO: "2026-05-17",
  },

  // --- Freshfields / Bohicket (public fallback) -----------------------------
  {
    id: "freshfields-village",
    name: "Freshfields Village",
    area: "freshfields",
    kind: "shopping",
    durationMins: 75,
    access: { public: true },
    kidFit: "wholeFamily",
    weatherFit: { goodWeather: true, rainyDay: true },
    hours: [{ open: "10:00", close: "21:00" }],
    sourceLabel: "Freshfields Village",
    sourceUrl: "https://freshfieldsvillage.com/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: [
      "Open-air green, shops, ice cream, and a free family event calendar.",
    ],
  },
  {
    id: "freshfields-event",
    name: "Freshfields Village event",
    area: "freshfields",
    kind: "event",
    durationMins: 60,
    access: { public: true },
    kidFit: "wholeFamily",
    weatherFit: { goodWeather: true },
    hours: [{ open: "17:00", close: "20:00" }],
    sourceLabel: "Freshfields Village events",
    sourceUrl: "https://freshfieldsvillage.com/events/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: ["Check the Freshfields events page for the trip week."],
  },
  {
    id: "bohicket-marina-walk",
    name: "Bohicket Marina stroll",
    area: "bohicket",
    kind: "nature",
    durationMins: 45,
    access: { public: true },
    kidFit: "wholeFamily",
    weatherFit: { goodWeather: true },
    hours: [{ open: "08:00", close: "21:00" }],
    sourceLabel: "Bohicket Marina",
    sourceUrl: "https://bohicket.com/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: ["Free parking, dining, ice cream; boat ramp views for kids."],
  },
  {
    id: "bohicket-boat-rental",
    name: "Bohicket boat / watersports rental",
    area: "bohicket",
    kind: "boat",
    durationMins: 120,
    access: { public: true },
    reservationRequired: true,
    kidFit: "olderKids",
    weatherFit: { goodWeather: true },
    hours: [{ open: "09:00", close: "17:00" }],
    sourceLabel: "Bohicket Marina watersports",
    sourceUrl: "https://bohicket.com/",
    lastVerifiedISO: "2026-05-17",
  },
  {
    id: "public-beach-walk",
    name: "Public beach walk (Beachwalker Park)",
    area: "beach",
    kind: "beach",
    durationMins: 60,
    access: { public: true },
    kidFit: "wholeFamily",
    weatherFit: { goodWeather: true, heatRelief: false },
    hours: [{ open: "06:00", close: "21:00" }],
    sourceLabel: "Beachwalker Park (Charleston County Parks)",
    sourceUrl: "https://www.ccprc.com/1827/Kiawah-Beachwalker-Park",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: [
      "Public access to Kiawah's west end — daily parking fee, lifeguards in season.",
    ],
  },
  {
    id: "low-tide-beach-play",
    name: "Low-tide beach play",
    area: "beach",
    kind: "beach",
    durationMins: 90,
    access: { public: true },
    kidFit: "wholeFamily",
    weatherFit: { goodWeather: true },
    hours: [{ open: "06:00", close: "21:00" }],
    sourceLabel: "Tide planner",
    sourceUrl: "https://tidesandcurrents.noaa.gov/",
    lastVerifiedISO: "2026-05-17",
    plannerNotes: [
      "Centered on a daylight low: flat sand, shallow pools, easy for little feet.",
    ],
  },
];

export function activityById(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}
