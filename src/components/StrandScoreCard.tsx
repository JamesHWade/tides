import { formatBestWindow, ratingLabel, type StrandScore } from "../utils/strandScore";

type Props = { score: StrandScore };

const RATING_CLASS: Record<StrandScore["rating"], string> = {
  favorable: "strand-score--favorable",
  marginal: "strand-score--marginal",
  unfavorable: "strand-score--unfavorable",
  "off-season": "strand-score--unfavorable",
};

const RATING_EMOJI: Record<StrandScore["rating"], string> = {
  favorable: "🐬",
  marginal: "⚖️",
  unfavorable: "✕",
  "off-season": "🪨",
};

export function StrandScoreCard({ score }: Props) {
  const window = formatBestWindow(score.bestWindow);
  return (
    <div className={`strand-score ${RATING_CLASS[score.rating]}`}>
      <div className="strand-score__head">
        <span className="strand-score__rating">
          <span aria-hidden="true">{RATING_EMOJI[score.rating]}</span>{" "}
          Strand-feeding {ratingLabel(score.rating).toLowerCase()}
        </span>
        {window && <span className="strand-score__window">{window}</span>}
      </div>
      <ul className="strand-score__reasons">
        {score.reasons.map((r) => (
          <li key={r.label} className={`strand-score__reason strand-score__reason--${r.tone}`}>
            <span aria-hidden="true" className="strand-score__bullet">
              {r.tone === "plus" ? "+" : r.tone === "minus" ? "−" : "·"}
            </span>
            <span>{r.label}</span>
          </li>
        ))}
      </ul>
      <p className="strand-score__caveat">
        Wildlife activity is never guaranteed. Stay ≥15 yards (45 ft) from the
        waterline — federal harassment penalties apply.
      </p>
    </div>
  );
}
