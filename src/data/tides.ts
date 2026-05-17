// Kiawah River Bridge, SC — NOAA tide station 8667062
// Trip range: Sunday, May 17, 2026 → Sunday, May 24, 2026
//
// At deploy time, scripts/fetch-tides.mjs pulls real NOAA predictions and
// writes them to ./tides.generated.ts. When that file is non-empty we use
// it and surface DATA_VERIFIED = true; otherwise we fall back to the
// placeholder semidiurnal pattern below so local dev and offline previews
// still render. Regenerate locally with `npm run fetch-tides`.

import { GENERATED_AT, generatedTideDays } from "./tides.generated";

export type TideType = "High" | "Low";

export type TideEvent = {
  /** 24h "HH:MM" — local Eastern time. */
  time: string;
  /** Display time, 12-hour with AM/PM. */
  displayTime: string;
  type: TideType;
  /** Predicted height in feet (MLLW). */
  heightFt: number;
};

export type DayPlan = {
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** Human label, e.g. "Sunday, May 17". */
  label: string;
  tides: TideEvent[];
  /** Optional free-form family notes for this day. */
  notes?: string[];
};

export const STATION = {
  id: "8667062",
  name: "Kiawah River Bridge, SC",
  datum: "MLLW",
  timeZone: "America/New_York",
};

export const TRIP_RANGE = {
  startISO: "2026-05-17",
  endISO: "2026-05-24",
  label: "May 17–24, 2026",
};

const t = (time: string, displayTime: string, type: TideType, heightFt: number): TideEvent => ({
  time,
  displayTime,
  type,
  heightFt,
});

/**
 * Placeholder pattern — plausible semidiurnal values near the May 16, 2026
 * new moon spring tides, used only when tides.generated.ts is empty.
 */
const PLACEHOLDER_TIDE_DAYS: DayPlan[] = [
  {
    date: "2026-05-17",
    label: "Sunday, May 17",
    tides: [
      t("01:24", "1:24 AM", "Low", -0.3),
      t("07:38", "7:38 AM", "High", 6.4),
      t("13:51", "1:51 PM", "Low", -0.5),
      t("20:09", "8:09 PM", "High", 6.7),
    ],
    notes: ["Travel / arrival day — keep beach plans flexible."],
  },
  {
    date: "2026-05-18",
    label: "Monday, May 18",
    tides: [
      t("02:18", "2:18 AM", "Low", -0.4),
      t("08:32", "8:32 AM", "High", 6.3),
      t("14:45", "2:45 PM", "Low", -0.4),
      t("21:03", "9:03 PM", "High", 6.5),
    ],
  },
  {
    date: "2026-05-19",
    label: "Tuesday, May 19",
    tides: [
      t("03:12", "3:12 AM", "Low", -0.2),
      t("09:26", "9:26 AM", "High", 6.0),
      t("15:39", "3:39 PM", "Low", -0.2),
      t("21:57", "9:57 PM", "High", 6.2),
    ],
  },
  {
    date: "2026-05-20",
    label: "Wednesday, May 20",
    tides: [
      t("04:06", "4:06 AM", "Low", 0.0),
      t("10:20", "10:20 AM", "High", 5.7),
      t("16:33", "4:33 PM", "Low", 0.1),
      t("22:51", "10:51 PM", "High", 5.9),
    ],
  },
  {
    date: "2026-05-21",
    label: "Thursday, May 21",
    tides: [
      t("05:00", "5:00 AM", "Low", 0.3),
      t("11:14", "11:14 AM", "High", 5.3),
      t("17:27", "5:27 PM", "Low", 0.4),
      t("23:45", "11:45 PM", "High", 5.5),
    ],
  },
  {
    date: "2026-05-22",
    label: "Friday, May 22",
    tides: [
      t("05:54", "5:54 AM", "Low", 0.5),
      t("12:08", "12:08 PM", "High", 4.9),
      t("18:21", "6:21 PM", "Low", 0.7),
    ],
  },
  {
    date: "2026-05-23",
    label: "Saturday, May 23",
    tides: [
      t("00:39", "12:39 AM", "High", 5.1),
      t("06:48", "6:48 AM", "Low", 0.7),
      t("13:02", "1:02 PM", "High", 4.6),
      t("19:15", "7:15 PM", "Low", 0.8),
    ],
  },
  {
    date: "2026-05-24",
    label: "Sunday, May 24",
    tides: [
      t("01:33", "1:33 AM", "High", 4.9),
      t("07:42", "7:42 AM", "Low", 0.7),
      t("13:56", "1:56 PM", "High", 4.4),
      t("20:09", "8:09 PM", "Low", 0.8),
    ],
    notes: ["Travel / departure day."],
  },
];

export const DATA_VERIFIED: boolean = generatedTideDays.length > 0;
export const tideDays: DayPlan[] = DATA_VERIFIED ? generatedTideDays : PLACEHOLDER_TIDE_DAYS;
export const DATA_GENERATED_AT: string | null = GENERATED_AT;
