import type { DayPlan } from "../data/tides";

type Props = {
  days: DayPlan[];
  todayISO?: string | null;
};

function shortLabel(label: string): { weekday: string; date: string } {
  // "Sunday, May 17" → { weekday: "Sun", date: "May 17" }
  const [wk, rest] = label.split(",");
  return { weekday: wk.slice(0, 3), date: rest?.trim() ?? "" };
}

export function DayNav({ days, todayISO }: Props) {
  return (
    <nav className="day-nav" aria-label="Jump to a day">
      <div className="day-nav__inner">
        {days.map((d) => {
          const s = shortLabel(d.label);
          const isToday = d.date === todayISO;
          return (
            <a
              key={d.date}
              href={`#day-${d.date}`}
              className={`day-nav__chip ${isToday ? "day-nav__chip--today" : ""}`}
            >
              <span className="day-nav__weekday">{s.weekday}</span>
              <span className="day-nav__date">{s.date}</span>
              {isToday && <span className="day-nav__today-dot" aria-hidden="true" />}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
