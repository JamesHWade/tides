import { useEffect, useRef, useState } from "react";
import { WEATHER_DATA_GENERATED_AT } from "../data/weather";
import { generatedWeather } from "../data/weather.generated";
import { fetchWeatherByDate, type DayWeather } from "../utils/runtimeWeather";

export type WeatherStatus = "idle" | "loading" | "ready" | "error";

export type WeatherMap = Map<string, DayWeather>;

export type WeatherResult = {
  byDate: WeatherMap;
  status: WeatherStatus;
  /** Last live-refresh time (from a successful fetch), null if never. */
  liveAt: string | null;
  /** Build-time snapshot timestamp, null if no snapshot shipped. */
  snapshotAt: string | null;
  error: string | null;
};

/**
 * Returns a merged weather map: build-time snapshot first, then any live
 * forecast that we managed to refresh in the browser overrides it.
 */
export function useWeather(enabled = true): WeatherResult {
  const [byDate, setByDate] = useState<WeatherMap>(seedFromSnapshot);
  const [status, setStatus] = useState<WeatherStatus>("idle");
  const [liveAt, setLiveAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    const ac = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ac;
    setStatus("loading");
    fetchWeatherByDate(ac.signal)
      .then((map) => {
        if (ac.signal.aborted) return;
        setByDate((prev) => {
          const next = new Map(prev);
          for (const [k, v] of map) next.set(k, v);
          return next;
        });
        setLiveAt(new Date().toISOString());
        setStatus("ready");
        setError(null);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setStatus(generatedWeather.length > 0 ? "ready" : "error");
        setError(err?.message ?? "Forecast unavailable");
      });
    return () => ac.abort();
    // We deliberately depend only on `enabled`; the snapshot doesn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { byDate, status, liveAt, snapshotAt: WEATHER_DATA_GENERATED_AT, error };
}

function seedFromSnapshot(): WeatherMap {
  return new Map(generatedWeather.map((w) => [w.date, w]));
}
