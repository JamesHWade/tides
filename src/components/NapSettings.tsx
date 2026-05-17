import type { NapSettings } from "../utils/tideUtils";

type Props = {
  value: NapSettings;
  onChange: (next: NapSettings) => void;
};

export function NapSettingsCard({ value, onChange }: Props) {
  return (
    <section className="card nap-card" aria-labelledby="nap-heading">
      <div className="card-head">
        <h2 id="nap-heading">Nap window</h2>
        <p className="card-sub">
          Used to flag tide windows that collide with nap time. Saved on this
          device.
        </p>
      </div>
      <div className="nap-fields">
        <label>
          <span>Nap start</span>
          <input
            type="time"
            value={value.napStart}
            onChange={(e) => onChange({ ...value, napStart: e.target.value })}
          />
        </label>
        <label>
          <span>Nap end</span>
          <input
            type="time"
            value={value.napEnd}
            onChange={(e) => onChange({ ...value, napEnd: e.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
