import type { BestDays } from "../utils/scheduleOptimizer";

type Props = { best: BestDays; onJump?: (dateISO: string) => void };

type Pick = { label: string; dateISO: string; detail: string };

export function BestDaySummary({ best, onJump }: Props) {
  const picks: Pick[] = [];
  if (best.strand) {
    picks.push({
      label: "Best strand-feeding attempt",
      dateISO: best.strand.date,
      detail: best.strand.headline,
    });
  }
  if (best.pool) {
    picks.push({
      label: "Best pool / heat-relief day",
      dateISO: best.pool.date,
      detail: best.pool.headline,
    });
  }
  if (best.indoor) {
    picks.push({
      label: "Best rainy-day fallback",
      dateISO: best.indoor.date,
      detail: best.indoor.headline,
    });
  }
  if (best.publicOnly) {
    picks.push({
      label: "Best public-only day",
      dateISO: best.publicOnly.date,
      detail: best.publicOnly.headline,
    });
  }

  if (picks.length === 0) return null;

  return (
    <section className="card best-day-summary" aria-labelledby="best-day-heading">
      <div className="card-head">
        <h2 id="best-day-heading">Best day for…</h2>
        <p className="card-sub">
          Quick picks across your selected range. Tap to jump.
        </p>
      </div>
      <ul className="best-day-list">
        {picks.map((p) => (
          <li key={p.label}>
            <button
              type="button"
              className="best-day-pick"
              onClick={() => onJump?.(p.dateISO)}
            >
              <span className="best-day-pick__label">{p.label}</span>
              <span className="best-day-pick__date">{formatShort(p.dateISO)}</span>
              <span className="best-day-pick__detail">{p.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatShort(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dt);
}
