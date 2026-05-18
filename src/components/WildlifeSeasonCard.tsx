import { useMemo } from "react";
import {
  describeMonths,
  monthsInRange,
  wildlifeForMonths,
  type WildlifeKind,
} from "../data/wildlife";

type Props = {
  startISO: string;
  endISO: string;
};

const KIND_EMOJI: Record<WildlifeKind, string> = {
  bird: "🐦",
  reptile: "🐢",
  mammal: "🦝",
  marineMammal: "🐬",
  fish: "🐟",
  insect: "🦋",
};

export function WildlifeSeasonCard({ startISO, endISO }: Props) {
  const months = useMemo(() => monthsInRange(startISO, endISO), [startISO, endISO]);
  const notes = useMemo(() => wildlifeForMonths(months), [months]);
  const monthLabel = useMemo(() => describeMonths(months), [months]);

  if (notes.length === 0) return null;

  return (
    <section className="card wildlife-season-card" aria-labelledby="wildlife-season-heading">
      <div className="card-head">
        <h2 id="wildlife-season-heading">🌿 What to look for in {monthLabel}</h2>
        <p className="card-sub">
          Local wildlife you might see on the islands during your trip dates.
          Brief field-trip prompts — not a substitute for the Kiawah Conservancy
          or SCDNR pages linked below.
        </p>
      </div>

      <ul className="wildlife-season-list">
        {notes.map((n) => (
          <li key={n.id} className="wildlife-season-item">
            <div className="wildlife-season-item__head">
              <span className="wildlife-season-item__emoji" aria-hidden="true">
                {KIND_EMOJI[n.kind]}
              </span>
              <strong>{n.title}</strong>
            </div>
            <p className="wildlife-season-item__blurb">{n.blurb}</p>
            {n.where && (
              <p className="wildlife-season-item__where">
                <em>{n.where}</em>
              </p>
            )}
            <p className="wildlife-season-item__source">
              <a href={n.sourceUrl} target="_blank" rel="noreferrer">
                {n.sourceLabel}
              </a>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
