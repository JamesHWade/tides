import { useId } from "react";
import { TRIP_RANGE, type DateRange } from "../data/tides";
import { MAX_RANGE_DAYS } from "../hooks/useDateRange";

type Props = {
  value: DateRange;
  isTrip: boolean;
  onChange: (next: DateRange) => void;
  onReset: () => void;
  /** Optional status footer (loading / source). */
  statusLine?: React.ReactNode;
};

function daysBetween(startISO: string, endISO: string): number {
  const s = new Date(startISO + "T00:00:00Z").getTime();
  const e = new Date(endISO + "T00:00:00Z").getTime();
  return Math.round((e - s) / 86_400_000) + 1;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DateRangePicker({ value, isTrip, onChange, onReset, statusLine }: Props) {
  const startId = useId();
  const endId = useId();
  const span = daysBetween(value.startISO, value.endISO);

  const shiftRange = (days: number) =>
    onChange({
      startISO: shiftISO(value.startISO, days),
      endISO: shiftISO(value.endISO, days),
    });

  const jumpToToday = () => {
    const t = todayISO();
    onChange({
      startISO: t,
      endISO: shiftISO(t, Math.max(0, span - 1)),
    });
  };

  return (
    <section className="card range-card" aria-labelledby="range-heading">
      <div className="card-head range-card__head">
        <div>
          <h2 id="range-heading">Dates</h2>
          <p className="card-sub">
            Default is the family trip. Pick any range up to {MAX_RANGE_DAYS} days
            — tides will be fetched from NOAA on demand.
          </p>
        </div>
        {!isTrip && (
          <button type="button" className="range-card__reset" onClick={onReset}>
            ↺ Trip week
          </button>
        )}
      </div>

      <div className="range-fields">
        <label htmlFor={startId}>
          <span>Start</span>
          <input
            id={startId}
            type="date"
            value={value.startISO}
            onChange={(e) => {
              const startISO = e.target.value || value.startISO;
              const endISO = value.endISO < startISO ? startISO : value.endISO;
              onChange({ startISO, endISO });
            }}
          />
        </label>
        <label htmlFor={endId}>
          <span>End</span>
          <input
            id={endId}
            type="date"
            value={value.endISO}
            min={value.startISO}
            onChange={(e) => {
              const endISO = e.target.value || value.endISO;
              onChange({ startISO: value.startISO, endISO });
            }}
          />
        </label>
        <div className="range-fields__shifts" role="group" aria-label="Shift range">
          <button type="button" onClick={() => shiftRange(-span)} title="Shift earlier" aria-label="Shift earlier">
            ‹
          </button>
          <button type="button" onClick={jumpToToday} title="Center on today">
            Today
          </button>
          <button type="button" onClick={() => shiftRange(span)} title="Shift later" aria-label="Shift later">
            ›
          </button>
        </div>
      </div>

      <div className="range-card__meta">
        <span>
          {span} day{span === 1 ? "" : "s"} · {value.startISO} → {value.endISO}
        </span>
        {isTrip && (
          <span className="range-card__trip-pill" aria-label="Default trip range">
            Trip week · {TRIP_RANGE.label}
          </span>
        )}
        {statusLine && <span className="range-card__status">{statusLine}</span>}
      </div>
    </section>
  );
}
