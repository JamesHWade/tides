import { useMemo, useState } from "react";
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  describeRecurrence,
  eventAppliesTo,
  isValidEvent,
  makeEmptyEvent,
  type CustomEvent,
  type CustomEventRecurrence,
} from "../utils/customEvents";
import { eachDateISO } from "../data/tides";

type Props = {
  events: CustomEvent[];
  onChange: (next: CustomEvent[]) => void;
  /** Trip range — drives the date dropdown for "specific" events. */
  startISO: string;
  endISO: string;
};

const RECURRENCE_OPTIONS: Array<{ value: CustomEventRecurrence; label: string }> = [
  { value: "specific", label: "Just one day" },
  { value: "daily", label: "Every day of the trip" },
  { value: "weekly", label: "Specific weekdays" },
];

const HHMM_RE = /^\d{2}:\d{2}$/;

export function CustomEventsCard({ events, onChange, startISO, endISO }: Props) {
  const [draft, setDraft] = useState<CustomEvent | null>(null);
  const [showAll, setShowAll] = useState(false);

  const dateOptions = useMemo(() => eachDateISO(startISO, endISO), [startISO, endISO]);

  const startEditing = (evt?: CustomEvent) => {
    if (evt) {
      setDraft({ ...evt, weekdays: evt.weekdays ? [...evt.weekdays] : undefined });
    } else {
      setDraft(makeEmptyEvent(startISO));
    }
  };

  const cancelEdit = () => setDraft(null);

  const commit = () => {
    if (!draft || !isValidEvent(draft)) return;
    const existingIdx = events.findIndex((e) => e.id === draft.id);
    const next =
      existingIdx >= 0
        ? events.map((e, i) => (i === existingIdx ? draft : e))
        : [...events, draft];
    onChange(next);
    setDraft(null);
  };

  const remove = (id: string) => {
    onChange(events.filter((e) => e.id !== id));
  };

  const visibleEvents = useMemo(() => {
    const inRange = events.filter((e) =>
      dateOptions.some((d) => eventAppliesTo(e, d)),
    );
    return showAll ? events : inRange;
  }, [events, dateOptions, showAll]);

  const hiddenCount = events.length - visibleEvents.length;

  return (
    <section className="card commitments-card" aria-labelledby="commitments-heading">
      <div className="card-head card-head--with-action">
        <div>
          <h2 id="commitments-heading">Family commitments</h2>
          <p className="card-sub">
            Locked-in plans (dinner at the club, a tee time, a doctor's
            appointment). The day plan will route activities around them.
            Saved on this device.
          </p>
        </div>
        {!draft && (
          <button
            type="button"
            className="commitments-card__add"
            onClick={() => startEditing()}
          >
            + Add commitment
          </button>
        )}
      </div>

      {visibleEvents.length === 0 && !draft && (
        <p className="muted commitments-card__empty">
          No commitments yet. Add one — for example, “Family dinner at the
          club, Wednesday 6 PM.”
        </p>
      )}

      {visibleEvents.length > 0 && (
        <ul className="commitments-list">
          {visibleEvents.map((evt) => (
            <li key={evt.id} className="commitments-list__item">
              <div className="commitments-list__main">
                <strong>{evt.label}</strong>
                <span className="commitments-list__meta">
                  {describeRecurrence(evt)} · {fmt12(evt.startHHMM)}–{fmt12(evt.endHHMM)}
                </span>
                {evt.notes && (
                  <span className="commitments-list__notes">{evt.notes}</span>
                )}
              </div>
              <div className="commitments-list__actions">
                <button type="button" onClick={() => startEditing(evt)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="commitments-list__remove"
                  onClick={() => remove(evt.id)}
                  aria-label={`Remove ${evt.label}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hiddenCount > 0 && !draft && (
        <button
          type="button"
          className="commitments-card__toggle-all"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll
            ? "Hide commitments outside this date range"
            : `Show ${hiddenCount} commitment${hiddenCount === 1 ? "" : "s"} outside this date range`}
        </button>
      )}

      {draft && (
        <EventEditor
          draft={draft}
          onChange={setDraft}
          dateOptions={dateOptions}
          onCancel={cancelEdit}
          onSave={commit}
          isEdit={events.some((e) => e.id === draft.id)}
        />
      )}
    </section>
  );
}

function EventEditor({
  draft,
  onChange,
  dateOptions,
  onCancel,
  onSave,
  isEdit,
}: {
  draft: CustomEvent;
  onChange: (next: CustomEvent) => void;
  dateOptions: string[];
  onCancel: () => void;
  onSave: () => void;
  isEdit: boolean;
}) {
  const valid = isValidEvent(draft);

  const setField = <K extends keyof CustomEvent>(key: K, value: CustomEvent[K]) => {
    onChange({ ...draft, [key]: value });
  };

  const toggleWeekday = (day: number) => {
    const current = draft.weekdays ?? [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    onChange({ ...draft, weekdays: next });
  };

  return (
    <div className="commitments-editor" role="group" aria-label="Commitment editor">
      <label className="commitments-editor__field">
        <span>What is it?</span>
        <input
          type="text"
          value={draft.label}
          placeholder="e.g. Family dinner at the club"
          onChange={(e) => setField("label", e.target.value)}
          autoFocus
        />
      </label>

      <div className="commitments-editor__row">
        <label className="commitments-editor__field">
          <span>Starts</span>
          <input
            type="time"
            value={draft.startHHMM}
            onChange={(e) => {
              if (!HHMM_RE.test(e.target.value)) return;
              setField("startHHMM", e.target.value);
            }}
          />
        </label>
        <label className="commitments-editor__field">
          <span>Ends</span>
          <input
            type="time"
            value={draft.endHHMM}
            onChange={(e) => {
              if (!HHMM_RE.test(e.target.value)) return;
              setField("endHHMM", e.target.value);
            }}
          />
        </label>
      </div>

      <label className="commitments-editor__field">
        <span>When does it happen?</span>
        <select
          value={draft.recurrence}
          onChange={(e) => {
            const rec = e.target.value as CustomEventRecurrence;
            const next: CustomEvent = { ...draft, recurrence: rec };
            if (rec === "specific" && !next.dateISO) {
              next.dateISO = dateOptions[0];
            }
            if (rec !== "specific") next.dateISO = undefined;
            if (rec !== "weekly") next.weekdays = undefined;
            if (rec === "weekly" && !next.weekdays?.length) {
              next.weekdays = [];
            }
            onChange(next);
          }}
        >
          {RECURRENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {draft.recurrence === "specific" && (
        <label className="commitments-editor__field">
          <span>Which day?</span>
          <select
            value={draft.dateISO ?? ""}
            onChange={(e) => setField("dateISO", e.target.value)}
          >
            {dateOptions.map((d) => (
              <option key={d} value={d}>
                {humanDate(d)}
              </option>
            ))}
          </select>
        </label>
      )}

      {draft.recurrence === "weekly" && (
        <fieldset className="commitments-editor__weekdays">
          <legend>Which weekdays?</legend>
          {WEEKDAY_LONG.map((label, i) => {
            const active = draft.weekdays?.includes(i) ?? false;
            return (
              <label
                key={label}
                className={`commitments-editor__weekday ${
                  active ? "commitments-editor__weekday--active" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleWeekday(i)}
                />
                <span>{WEEKDAY_SHORT[i]}</span>
              </label>
            );
          })}
        </fieldset>
      )}

      <label className="commitments-editor__field">
        <span>Note (optional)</span>
        <input
          type="text"
          value={draft.notes ?? ""}
          placeholder="e.g. Reservation at 6:15 — show Amenity Card"
          onChange={(e) => setField("notes", e.target.value)}
        />
      </label>

      <div className="commitments-editor__actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="commitments-editor__save"
          onClick={onSave}
          disabled={!valid}
        >
          {isEdit ? "Save changes" : "Add commitment"}
        </button>
      </div>
    </div>
  );
}

function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

function humanDate(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12)));
}
