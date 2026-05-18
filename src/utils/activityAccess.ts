import type { Activity, AccessFlag } from "../data/activities";
import type { AccessSettings } from "../hooks/useAccessSettings";
import { timeOn, windowsOverlap } from "./tideUtils";

const FLAG_LABEL: Record<AccessFlag, string> = {
  kiawahResortGuest: "Kiawah resort guest card",
  kiawahGovernorClub: "Governor's Club membership",
  kiawahSanctuaryGuest: "Sanctuary hotel stay",
  kiawahConfirmedRecreationReservation: "Confirmed Kiawah activity reservation",
  seabrookDigitalAmenityPass: "Seabrook Digital Amenity Pass",
  seabrookClubAccessAmenityCard: "Seabrook Club Access Amenity Card",
  seabrookEquestrianReservation: "Seabrook equestrian reservation",
};

function hasAll(flags: AccessFlag[] | undefined, access: AccessSettings): boolean {
  if (!flags || flags.length === 0) return true;
  return flags.every((f) => access[f] === true);
}

function hasAny(flags: AccessFlag[] | undefined, access: AccessSettings): boolean {
  if (!flags || flags.length === 0) return true;
  return flags.some((f) => access[f] === true);
}

/**
 * Whether the family can use this activity given their saved access flags.
 *
 * Rules:
 *   - `preferPublicOnly` short-circuits: the activity must be `public: true`,
 *     and any reservation-required activity is also excluded so the result
 *     matches the UI copy ("Hide every gated pool, club, and reservation-only
 *     activity").
 *   - `allOf` requires every listed flag.
 *   - `anyOf` requires at least one listed flag.
 *   - If both lists are empty/omitted but `public` is true, the activity is
 *     allowed.
 *   - Otherwise the activity is blocked.
 */
export function isActivityAllowed(
  activity: Activity,
  access: AccessSettings,
): boolean {
  const rule = activity.access;
  if (access.preferPublicOnly) {
    if (rule.public !== true) return false;
    if (activity.reservationRequired === true) return false;
    return true;
  }
  if (rule.public === true && !rule.allOf?.length && !rule.anyOf?.length) {
    return true;
  }
  // A rule with no public flag and no allOf/anyOf is a misconfiguration —
  // treat it as not allowed rather than silently passing (matches the
  // "Otherwise the activity is blocked" doc comment above).
  if (rule.public !== true && !rule.allOf?.length && !rule.anyOf?.length) {
    return false;
  }
  return hasAll(rule.allOf, access) && hasAny(rule.anyOf, access);
}

/** Human labels for any access flags the family is missing. */
export function unmetAccessLabels(
  activity: Activity,
  access: AccessSettings,
): string[] {
  const rule = activity.access;
  const missing: AccessFlag[] = [];
  if (rule.allOf) {
    for (const f of rule.allOf) {
      if (!access[f]) missing.push(f);
    }
  }
  if (rule.anyOf && rule.anyOf.length > 0 && !rule.anyOf.some((f) => access[f])) {
    // The user only needs to understand *that* one of these flags would
    // unlock the activity — surface the first as representative rather than
    // every alternative.
    missing.push(rule.anyOf[0]);
  }
  const seen = new Set<AccessFlag>();
  return missing
    .filter((f) => {
      if (seen.has(f)) return false;
      seen.add(f);
      return true;
    })
    .map((f) => FLAG_LABEL[f]);
}

/** Is the activity in season on this ISO date? */
export function isActivityInSeason(activity: Activity, dateISO: string): boolean {
  if (!activity.season) return true;
  return dateISO >= activity.season.startISO && dateISO <= activity.season.endISO;
}

/**
 * Does the activity have any hours rule whose date window contains dateISO,
 * and does any such rule's open–close span overlap [startHHMM, endHHMM]?
 *
 * Activities with no `hours` array are treated as always open.
 */
export function isActivityOpenOn(
  activity: Activity,
  dateISO: string,
  startHHMM: string,
  endHHMM: string,
): boolean {
  if (!activity.hours || activity.hours.length === 0) return true;
  const winStart = timeOn(dateISO, startHHMM);
  const winEnd = timeOn(dateISO, endHHMM);
  for (const h of activity.hours) {
    if (h.startISO && dateISO < h.startISO) continue;
    if (h.endISO && dateISO > h.endISO) continue;
    const open = timeOn(dateISO, h.open);
    const close = timeOn(dateISO, h.close);
    if (windowsOverlap(winStart, winEnd, open, close)) return true;
  }
  return false;
}

/**
 * The first hours rule that applies on dateISO, or null if none does.
 * Used by the optimizer to clip activity blocks to opening times.
 */
export function activityHoursOn(
  activity: Activity,
  dateISO: string,
): { open: Date; close: Date; note?: string } | null {
  if (!activity.hours || activity.hours.length === 0) return null;
  for (const h of activity.hours) {
    if (h.startISO && dateISO < h.startISO) continue;
    if (h.endISO && dateISO > h.endISO) continue;
    return {
      open: timeOn(dateISO, h.open),
      close: timeOn(dateISO, h.close),
      note: h.note,
    };
  }
  return null;
}
