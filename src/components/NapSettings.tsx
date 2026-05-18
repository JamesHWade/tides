import type { NapSettings } from "../utils/tideUtils";
import type { HouseholdPace, KidsAgeGroup } from "../hooks/useHouseholdPace";

type Props = {
  nap: NapSettings;
  pace: HouseholdPace;
  onNapChange: (next: NapSettings) => void;
  onPaceChange: (next: HouseholdPace) => void;
};

const AGE_OPTIONS: Array<{ value: KidsAgeGroup; label: string }> = [
  { value: "toddlers", label: "Toddlers (under 2)" },
  { value: "littleKids", label: "Little kids (2–5)" },
  { value: "olderKids", label: "Older kids (6+)" },
  { value: "mixed", label: "Mixed ages" },
];

const HHMM_RE = /^\d{2}:\d{2}$/;

// Skip propagation for transient invalid states. Time inputs hand us an empty
// string mid-edit (and on browser-native "clear"); without this guard, an
// empty earliestStart silently parses as 00:00 and the scheduler starts
// recommending pre-dawn windows.
function isValidHHMM(v: string): boolean {
  return HHMM_RE.test(v);
}

export function NapSettingsCard({ nap, pace, onNapChange, onPaceChange }: Props) {
  return (
    <section className="card nap-card" aria-labelledby="nap-heading">
      <div className="card-head">
        <h2 id="nap-heading">Daily rhythm</h2>
        <p className="card-sub">
          When can the kids realistically be out, and when do they nap? Used to
          clip beach windows and activity slots so the schedule doesn't suggest
          a 6:15 AM beach trip with toddlers. Saved on this device.
        </p>
      </div>
      <div className="nap-fields">
        <label>
          <span>Earliest out</span>
          <input
            type="time"
            value={pace.earliestStart}
            onChange={(e) => {
              if (!isValidHHMM(e.target.value)) return;
              onPaceChange({ ...pace, earliestStart: e.target.value });
            }}
          />
        </label>
        <label>
          <span>Nap start</span>
          <input
            type="time"
            value={nap.napStart}
            onChange={(e) => {
              if (!isValidHHMM(e.target.value)) return;
              onNapChange({ ...nap, napStart: e.target.value });
            }}
          />
        </label>
        <label>
          <span>Nap end</span>
          <input
            type="time"
            value={nap.napEnd}
            onChange={(e) => {
              if (!isValidHHMM(e.target.value)) return;
              onNapChange({ ...nap, napEnd: e.target.value });
            }}
          />
        </label>
        <label>
          <span>Latest activity</span>
          <input
            type="time"
            value={pace.latestEnd}
            onChange={(e) => {
              if (!isValidHHMM(e.target.value)) return;
              onPaceChange({ ...pace, latestEnd: e.target.value });
            }}
          />
        </label>
        <label className="nap-fields__age">
          <span>Kid age</span>
          <select
            value={pace.kidsAge}
            onChange={(e) =>
              onPaceChange({
                ...pace,
                kidsAge: e.target.value as KidsAgeGroup,
              })
            }
          >
            {AGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
