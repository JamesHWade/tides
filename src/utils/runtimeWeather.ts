// Browser-side weather fetcher built on the U.S. National Weather Service
// public API (api.weather.gov). Forecasts cover roughly the next 7 days;
// requests for dates beyond that resolve to "no forecast yet."

import { STATION } from "../data/tides";

export type DayWeather = {
  date: string;
  /** Forecast high (°F), null if not yet published. */
  highF: number | null;
  /** Forecast low (°F). */
  lowF: number | null;
  /** Daytime precip probability 0–100, null if not provided. */
  precipChancePct: number | null;
  /** Top of the wind-speed range for the daytime period, in mph. */
  windMphMax: number | null;
  /** Compass abbreviation for daytime wind origin, e.g. "SW". */
  windFromDir: string | null;
  /** Short human label, e.g. "Mostly Sunny". */
  shortForecast: string;
  /** Long-form sentence from NWS, day period. */
  detailedForecast?: string;
  /** NWS icon URL (suitable for <img src>). */
  icon?: string;
  /** Convenience emoji for terse summaries. */
  emoji: string;
};

type NWSPeriod = {
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  probabilityOfPrecipitation?: { value: number | null };
  windSpeed: string | number | null;
  windDirection: string | null;
  shortForecast: string;
  detailedForecast?: string;
  icon?: string;
};

function dateOfStart(startTime: string): string {
  // startTime is "2026-05-17T06:00:00-04:00" → take the local-date portion.
  return startTime.slice(0, 10);
}

function parseMaxMph(windSpeed: string | number | null | undefined): number | null {
  if (windSpeed == null) return null;
  if (typeof windSpeed === "number") return windSpeed;
  const nums = String(windSpeed).match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  return Math.max(...nums.map(Number));
}

const EMOJI_RULES: Array<[RegExp, string]> = [
  [/thunder|t-storm/i, "⛈️"],
  [/snow|flurries/i, "🌨️"],
  [/showers|rain/i, "🌧️"],
  [/drizzle/i, "🌦️"],
  [/fog/i, "🌫️"],
  [/mostly cloudy|overcast/i, "☁️"],
  [/partly (sunny|cloudy)|partly|few clouds/i, "⛅"],
  [/mostly sunny|mostly clear/i, "🌤️"],
  [/sunny|clear/i, "☀️"],
  [/windy|breezy/i, "🌬️"],
];

export function emojiFor(label: string): string {
  for (const [re, e] of EMOJI_RULES) {
    if (re.test(label)) return e;
  }
  return "🌥️";
}

export function aggregatePeriods(periods: NWSPeriod[]): Map<string, DayWeather> {
  const out = new Map<string, DayWeather>();
  for (const p of periods) {
    const date = dateOfStart(p.startTime);
    const existing: DayWeather = out.get(date) ?? {
      date,
      highF: null,
      lowF: null,
      precipChancePct: null,
      windMphMax: null,
      windFromDir: null,
      shortForecast: "",
      emoji: "",
    };
    if (p.isDaytime) {
      existing.highF = p.temperature;
      existing.shortForecast = p.shortForecast;
      existing.detailedForecast = p.detailedForecast;
      existing.icon = p.icon;
      existing.precipChancePct = p.probabilityOfPrecipitation?.value ?? existing.precipChancePct;
      existing.windMphMax = parseMaxMph(p.windSpeed);
      existing.windFromDir = p.windDirection;
      existing.emoji = emojiFor(p.shortForecast);
    } else {
      existing.lowF = p.temperature;
      if (!existing.shortForecast) {
        existing.shortForecast = p.shortForecast;
        existing.emoji = emojiFor(p.shortForecast);
      }
      if (existing.precipChancePct == null) {
        existing.precipChancePct = p.probabilityOfPrecipitation?.value ?? null;
      }
    }
    out.set(date, existing);
  }
  return out;
}

let cachedForecastUrl: string | null = null;

async function resolveForecastUrl(signal?: AbortSignal): Promise<string> {
  if (cachedForecastUrl) return cachedForecastUrl;
  const res = await fetch(
    `https://api.weather.gov/points/${STATION.lat},${STATION.lon}`,
    { signal, headers: { Accept: "application/geo+json" } },
  );
  if (!res.ok) throw new Error(`NWS points HTTP ${res.status}`);
  const body = await res.json();
  const url = body?.properties?.forecast;
  if (typeof url !== "string") throw new Error("NWS points: missing forecast url");
  cachedForecastUrl = url;
  return url;
}

export async function fetchWeatherByDate(signal?: AbortSignal): Promise<Map<string, DayWeather>> {
  const forecastUrl = await resolveForecastUrl(signal);
  const res = await fetch(forecastUrl, {
    signal,
    headers: { Accept: "application/geo+json" },
  });
  if (!res.ok) throw new Error(`NWS forecast HTTP ${res.status}`);
  const body = await res.json();
  const periods: NWSPeriod[] = body?.properties?.periods ?? [];
  return aggregatePeriods(periods);
}
