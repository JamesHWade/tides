import { useMemo, useState } from "react";
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
    hint: "Beach Club, Lake House pool/splash/playground, towel service.",
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
  {
    key: "seabrookRacquetClubReservation",
    label: "Confirmed Racquet Club reservation",
    hint: "Tennis and pickleball at the Racquet Club.",
  },
];

const STAY_BASE_LABEL: Record<AccessSettings["stayBase"], string> = {
  kiawah: "Kiawah Island",
  seabrook: "Seabrook Island",
  offIsland: "Off-island",
  unknown: "Not set",
};

const FLAG_SHORT_LABEL: Record<FlagRow["key"], string> = {
  kiawahResortGuest: "Kiawah resort",
  kiawahGovernorClub: "Governor's Club",
  kiawahSanctuaryGuest: "Sanctuary stay",
  kiawahConfirmedRecreationReservation: "Kiawah activity rsvp",
  seabrookDigitalAmenityPass: "Seabrook Amenity Pass",
  seabrookClubAccessAmenityCard: "Seabrook Club Access",
  seabrookEquestrianReservation: "Equestrian rsvp",
  seabrookRacquetClubReservation: "Racquet rsvp",
  preferPublicOnly: "Public only",
};

function isConfigured(v: AccessSettings): boolean {
  if (v.stayBase !== "unknown") return true;
  return Object.entries(v).some(
    ([k, val]) => k !== "stayBase" && val === true,
  );
}

function activeFlagLabels(v: AccessSettings): string[] {
  const labels: string[] = [];
  for (const key of Object.keys(FLAG_SHORT_LABEL) as Array<keyof typeof FLAG_SHORT_LABEL>) {
    if (v[key] === true) labels.push(FLAG_SHORT_LABEL[key]);
  }
  return labels;
}

export function AccessSettingsCard({ value, onChange }: Props) {
  const configured = useMemo(() => isConfigured(value), [value]);
  // Collapsed by default once anything is configured. From there the user
  // drives open/close with the Edit / Hide buttons — we don't auto-collapse
  // mid-edit when a checkbox flips.
  const [open, setOpen] = useState<boolean>(!configured);

  const update = <K extends keyof AccessSettings>(key: K, v: AccessSettings[K]) =>
    onChange({ ...value, [key]: v });

  if (!open) {
    const labels = activeFlagLabels(value);
    return (
      <section className="card access-card access-card--compact" aria-labelledby="access-heading">
        <div className="access-summary">
          <div className="access-summary__text">
            <h2 id="access-heading" className="access-summary__title">
              Amenity access
            </h2>
            <p className="access-summary__base">
              Staying: <strong>{STAY_BASE_LABEL[value.stayBase]}</strong>
            </p>
            {labels.length > 0 ? (
              <ul className="access-summary__chips" aria-label="Active amenities">
                {labels.map((l) => (
                  <li key={l} className="access-summary__chip">
                    {l}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="access-summary__none muted">
                No amenity flags set — schedule will use the public fallback.
              </p>
            )}
          </div>
          <button
            type="button"
            className="access-summary__edit"
            onClick={() => setOpen(true)}
            aria-expanded="false"
          >
            Edit access
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card access-card" aria-labelledby="access-heading">
      <div className="card-head card-head--with-action">
        <div>
          <h2 id="access-heading">Amenity access</h2>
          <p className="card-sub">
            Used to hide plans your family cannot access. Saved on this device.
          </p>
        </div>
        {configured && (
          <button
            type="button"
            className="access-summary__edit access-summary__edit--collapse"
            onClick={() => setOpen(false)}
            aria-expanded="true"
          >
            Hide
          </button>
        )}
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
