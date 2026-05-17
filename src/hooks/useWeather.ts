import { useCallback, useEffect, useRef, useState } from "react";
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

const STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour

/**
 * Returns a merged weather map: build-time snapshot first, then any live
 * forecast that we managed to refresh in the browser overrides it. Refreshes
 * when the tab regains visibility if the data is older than an hour, since
 * NWS only ever publishes ~7 days ahead and a long-lived tab can outlive its
 * forecast.
 */
export function useWeather(enabled = true): WeatherResult {
  const [byDate, setByDate] = useState<WeatherMap>(seedFromSnapshot);
  const [status, setStatus] = useState<WeatherStatus>("idle");
  const [liveAt, setLiveAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const liveAtRef = useRef<string | null>(null);

  const fetchNow = useCallback(() => {
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
        const now = new Date().toISOString();
        liveAtRef.current = now;
        setLiveAt(now);
        setStatus("ready");
        setError(null);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setStatus(generatedWeather.length > 0 ? "ready" : "error");
        setError(err?.message ?? "Forecast unavailable");
      });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchNow();
    return () => abortRef.current?.abort();
  }, [enabled, fetchNow]);

  // Re-fetch when the tab comes back if the data is stale. NWS only ever
  // publishes ~7 days ahead, so a long-lived tab can outlive its data.
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const last = liveAtRef.current ? Date.parse(liveAtRef.current) : 0;
      if (Date.now() - last > STALE_AFTER_MS) fetchNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, fetchNow]);

  return { byDate, status, liveAt, snapshotAt: WEATHER_DATA_GENERATED_AT, error };
}

function seedFromSnapshot(): WeatherMap {
  return new Map(generatedWeather.map((w) => [w.date, w]));
}
