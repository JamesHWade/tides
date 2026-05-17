// Build-time snapshot adapter for weather, matching the tide-snapshot pattern.
// `useWeather` consumes the data through this module so swapping the
// underlying source (DuckDB, IndexedDB, a different API) stays a local edit.

import type { DayWeather } from "../utils/runtimeWeather";
import { WEATHER_GENERATED_AT, generatedWeather } from "./weather.generated";

/** Materialize the build-time snapshot as a date-keyed map. */
export function seedWeatherSnapshot(): Map<string, DayWeather> {
  return new Map(generatedWeather.map((w) => [w.date, w] as const));
}

export const WEATHER_DATA_GENERATED_AT: string | null = WEATHER_GENERATED_AT;
