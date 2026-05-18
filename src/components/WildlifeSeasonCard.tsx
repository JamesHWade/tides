import { useMemo, useState } from "react";
import {
  describeMonths,
  monthsInRange,
  wildlifeForMonths,
  type WildlifeKind,
  type WildlifeNote,
} from "../data/wildlife";
import { useWildlifeImages } from "../hooks/useWildlifeImages";
import { WildlifeModal } from "./WildlifeModal";

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

  const images = useWildlifeImages(notes);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeNote = useMemo<WildlifeNote | null>(() => {
    if (!activeId) return null;
    return notes.find((n) => n.id === activeId) ?? null;
  }, [activeId, notes]);

  if (notes.length === 0) return null;

  return (
    <section className="card wildlife-season-card" aria-labelledby="wildlife-season-heading">
      <div className="card-head">
        <h2 id="wildlife-season-heading">🌿 What to look for in {monthLabel}</h2>
        <p className="card-sub">
          Local wildlife you might see on the islands during your trip dates.
          Tap a card for a larger photo and quick natural-history notes. Photos
          come from Wikipedia (CC BY-SA).
        </p>
      </div>

      <ul className="wildlife-season-list">
        {notes.map((n) => {
          const img = images.get(n.id) ?? null;
          const thumb = img?.thumbnail ?? null;
          return (
            <li key={n.id} className="wildlife-season-item">
              <button
                type="button"
                className="wildlife-season-item__open"
                onClick={() => setActiveId(n.id)}
                aria-label={`Open photo and details for ${n.title}`}
              >
                <span className="wildlife-season-item__thumb" aria-hidden="true">
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" />
                  ) : (
                    <span className="wildlife-season-item__thumb-fallback">
                      {KIND_EMOJI[n.kind]}
                    </span>
                  )}
                </span>
                <span className="wildlife-season-item__body">
                  <span className="wildlife-season-item__head">
                    <span className="wildlife-season-item__emoji" aria-hidden="true">
                      {KIND_EMOJI[n.kind]}
                    </span>
                    <strong>{n.title}</strong>
                  </span>
                  <span className="wildlife-season-item__blurb">{n.blurb}</span>
                  {n.where && (
                    <span className="wildlife-season-item__where">
                      <em>{n.where}</em>
                    </span>
                  )}
                </span>
                <span className="wildlife-season-item__more" aria-hidden="true">
                  More ›
                </span>
              </button>
              <p className="wildlife-season-item__source">
                <a
                  href={n.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {n.sourceLabel}
                </a>
              </p>
            </li>
          );
        })}
      </ul>

      {activeNote && (
        <WildlifeModal
          note={activeNote}
          image={images.get(activeNote.id) ?? null}
          kindEmoji={KIND_EMOJI[activeNote.kind]}
          onClose={() => setActiveId(null)}
        />
      )}
    </section>
  );
}
