// Build-time snapshot adapter for weather, matching the tide-snapshot pattern.

import type { DayWeather } from "../utils/runtimeWeather";
import { WEATHER_GENERATED_AT, generatedWeather } from "./weather.generated";

const SNAPSHOT_BY_DATE: Map<string, DayWeather> = new Map(
  generatedWeather.map((w) => [w.date, w]),
);

export function snapshotWeatherFor(dateISO: string): DayWeather | undefined {
  return SNAPSHOT_BY_DATE.get(dateISO);
}

export const WEATHER_DATA_VERIFIED: boolean = generatedWeather.length > 0;
export const WEATHER_DATA_GENERATED_AT: string | null = WEATHER_GENERATED_AT;
