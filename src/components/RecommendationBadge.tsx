type Variant = "play" | "watch" | "conflict" | "calm" | "info";

type Props = {
  variant: Variant;
  children: React.ReactNode;
};

const VARIANT_LABEL: Record<Variant, string> = {
  play: "Recommended",
  watch: "Watch",
  conflict: "Warning",
  calm: "Calm",
  info: "Info",
};

export function RecommendationBadge({ variant, children }: Props) {
  return (
    <span className={`badge badge-${variant}`}>
      <span className="visually-hidden">{VARIANT_LABEL[variant]}: </span>
      {children}
    </span>
  );
}
