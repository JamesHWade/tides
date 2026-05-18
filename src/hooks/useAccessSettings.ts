import { useEffect, useState } from "react";

const STORAGE_KEY = "tides.access.v1";

export type StayBase = "kiawah" | "seabrook" | "offIsland" | "unknown";

export type AccessSettings = {
  stayBase: StayBase;
  kiawahResortGuest: boolean;
  kiawahGovernorClub: boolean;
  kiawahSanctuaryGuest: boolean;
  kiawahConfirmedRecreationReservation: boolean;
  seabrookDigitalAmenityPass: boolean;
  seabrookClubAccessAmenityCard: boolean;
  seabrookEquestrianReservation: boolean;
  preferPublicOnly: boolean;
};

export const DEFAULT_ACCESS: AccessSettings = {
  stayBase: "unknown",
  kiawahResortGuest: false,
  kiawahGovernorClub: false,
  kiawahSanctuaryGuest: false,
  kiawahConfirmedRecreationReservation: false,
  seabrookDigitalAmenityPass: false,
  seabrookClubAccessAmenityCard: false,
  seabrookEquestrianReservation: false,
  preferPublicOnly: false,
};

const STAY_BASES: ReadonlyArray<StayBase> = ["kiawah", "seabrook", "offIsland", "unknown"];

function isStayBase(v: unknown): v is StayBase {
  return typeof v === "string" && (STAY_BASES as readonly string[]).includes(v);
}

function coerce(parsed: Partial<AccessSettings> | null): AccessSettings {
  if (!parsed || typeof parsed !== "object") return DEFAULT_ACCESS;
  const out: AccessSettings = { ...DEFAULT_ACCESS };
  if (isStayBase(parsed.stayBase)) out.stayBase = parsed.stayBase;
  const flags: Array<keyof AccessSettings> = [
    "kiawahResortGuest",
    "kiawahGovernorClub",
    "kiawahSanctuaryGuest",
    "kiawahConfirmedRecreationReservation",
    "seabrookDigitalAmenityPass",
    "seabrookClubAccessAmenityCard",
    "seabrookEquestrianReservation",
    "preferPublicOnly",
  ];
  for (const f of flags) {
    const v = (parsed as Record<string, unknown>)[f];
    if (typeof v === "boolean") (out as Record<string, unknown>)[f] = v;
  }
  return out;
}

function load(): AccessSettings {
  if (typeof window === "undefined") return DEFAULT_ACCESS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ACCESS;
    return coerce(JSON.parse(raw) as Partial<AccessSettings>);
  } catch {
    return DEFAULT_ACCESS;
  }
}

export function useAccessSettings(): [
  AccessSettings,
  (next: AccessSettings) => void,
] {
  const [access, setAccess] = useState<AccessSettings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
    } catch {
      // ignore quota / private mode
    }
  }, [access]);

  return [access, setAccess];
}
