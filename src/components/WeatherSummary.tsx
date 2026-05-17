import type { DayWeather } from "../utils/runtimeWeather";

type Props = { weather: DayWeather };

export function WeatherSummary({ weather }: Props) {
  const hi = weather.highF != null ? `${Math.round(weather.highF)}°` : "—";
  const lo = weather.lowF != null ? `${Math.round(weather.lowF)}°` : "—";
  const wind =
    weather.windMphMax != null
      ? `${weather.windFromDir ?? ""} ${weather.windMphMax} mph`.trim()
      : null;
  const precip =
    weather.precipChancePct != null && weather.precipChancePct > 0
      ? `${weather.precipChancePct}%`
      : null;

  return (
    <div className="weather-summary" aria-label={`Forecast: ${weather.shortForecast}`}>
      <span className="weather-summary__emoji" aria-hidden="true">
        {weather.emoji || "🌥️"}
      </span>
      <span className="weather-summary__text">
        <strong>{weather.shortForecast}</strong>
        <span className="weather-summary__meta">
          <span title="High / low">{hi} / {lo}</span>
          {wind && <span title="Wind">· {wind}</span>}
          {precip && <span title="Precip chance">· {precip} rain</span>}
        </span>
      </span>
    </div>
  );
}
