import type { AccessSettings } from "../hooks/useAccessSettings";

type Props = {
  value: AccessSettings;
  onChange: (next: AccessSettings) => void;
};

type FlagRow = {
  key: keyof Omit<AccessSettings, "stayBase">;
  label: string;
  hint?: string;
};

const KIAWAH_FLAGS: FlagRow[] = [
  {
    key: "kiawahResortGuest",
    label: "Kiawah Island Golf Resort guest",
    hint: "Resort amenity card unlocks Night Heron, West Beach pools and rec.",
  },
  {
    key: "kiawahGovernorClub",
    label: "Governor's Club member",
    hint: "Same pool / amenity access as resort guests.",
  },
  {
    key: "kiawahSanctuaryGuest",
    label: "Staying at The Sanctuary hotel",
    hint: "Sanctuary pools are limited to Sanctuary hotel guests.",
  },
  {
    key: "kiawahConfirmedRecreationReservation",
    label: "Have a confirmed Kiawah activity reservation",
    hint: "Off-island guests must show the email at the security gate.",
  },
];

const SEABROOK_FLAGS: FlagRow[] = [
  {
    key: "seabrookDigitalAmenityPass",
    label: "Seabrook Digital Amenity Pass",
    hint: "Beach Club + pools + towel service.",
  },
  {
    key: "seabrookClubAccessAmenityCard",
    label: "Seabrook Club Access Amenity Card",
    hint: "On-island club dining. No cash or credit card accepted.",
  },
  {
    key: "seabrookEquestrianReservation",
    label: "Confirmed equestrian reservation",
    hint: "Pony rides and trail rides at the Equestrian Center.",
  },
];

export function AccessSettingsCard({ value, onChange }: Props) {
  const update = <K extends keyof AccessSettings>(key: K, v: AccessSettings[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <section className="card access-card" aria-labelledby="access-heading">
      <div className="card-head">
        <h2 id="access-heading">Amenity access</h2>
        <p className="card-sub">
          Used to hide plans your family cannot access. Saved on this device.
        </p>
      </div>

      <div className="access-fields">
        <label className="access-base">
          <span>Where you're staying</span>
          <select
            value={value.stayBase}
            onChange={(e) => update("stayBase", e.target.value as AccessSettings["stayBase"])}
          >
            <option value="unknown">Not sure yet</option>
            <option value="kiawah">Kiawah Island</option>
            <option value="seabrook">Seabrook Island</option>
            <option value="offIsland">Off-island</option>
          </select>
        </label>

        <fieldset className="access-group">
          <legend>Kiawah</legend>
          {KIAWAH_FLAGS.map((row) => (
            <AccessCheckbox
              key={row.key}
              row={row}
              checked={value[row.key] as boolean}
              onChange={(v) => update(row.key, v)}
            />
          ))}
        </fieldset>

        <fieldset className="access-group">
          <legend>Seabrook</legend>
          {SEABROOK_FLAGS.map((row) => (
            <AccessCheckbox
              key={row.key}
              row={row}
              checked={value[row.key] as boolean}
              onChange={(v) => update(row.key, v)}
            />
          ))}
        </fieldset>

        <fieldset className="access-group">
          <legend>Public fallback</legend>
          <AccessCheckbox
            row={{
              key: "preferPublicOnly",
              label: "Show me only public-access plans",
              hint: "Hide every gated pool, club, and reservation-only activity.",
            }}
            checked={value.preferPublicOnly}
            onChange={(v) => update("preferPublicOnly", v)}
          />
        </fieldset>
      </div>
    </section>
  );
}

function AccessCheckbox({
  row,
  checked,
  onChange,
}: {
  row: FlagRow;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="access-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <strong>{row.label}</strong>
        {row.hint && <span className="access-check__hint">{row.hint}</span>}
      </span>
    </label>
  );
}
