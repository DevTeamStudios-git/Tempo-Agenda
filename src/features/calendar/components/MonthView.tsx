"use client";
import { useMemo } from "react";
import { addDays, dayKey, formatClock, formatClockWithFormat } from "@/lib/dates/date-utils";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import type { CalendarSummary, EventRecord } from "../types";
import { useAppI18n } from "@/lib/i18n";

export function MonthView({
  anchor,
  events,
  calendars,
  timeZone,
  weekStart = "monday",
  onSelectEvent,
  onCreateAt,
  onEventContextMenu,
  onEmptyContextMenu,
}: {
  anchor: Date;
  events: EventRecord[];
  calendars: CalendarSummary[];
  timeZone: string;
  weekStart?: "monday" | "sunday";
  onSelectEvent: (id: string) => void;
  onCreateAt: (dateKey: string, minutes: number) => void;
  onEventContextMenu?: (e: React.MouseEvent, id: string) => void;
  onEmptyContextMenu?: (e: React.MouseEvent, dateKey: string, minutes: number) => void;
}) {
  const { locale, t } = useAppI18n();
  const colorOf = (id: string) => calendars.find((c) => c.id === id)?.color ?? "var(--accent)";

  const weekdays = (weekStart === "sunday" ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0]).map((weekday) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 7 + weekday))
  );
  const { grid, daysInMonth } = useMemo(() => {
    const zoned = toZonedTime(anchor, timeZone);
    const monthStart = new Date(zoned.getFullYear(), zoned.getMonth(), 1);
    const startDow = weekStart === "sunday" ? monthStart.getDay() : (monthStart.getDay() + 6) % 7;
    const cells: Date[] = [];
    const start = new Date(monthStart);
    start.setDate(1 - startDow);
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    const daysInMonthVal = new Date(zoned.getFullYear(), zoned.getMonth() + 1, 0).getDate();
    return { grid: cells, daysInMonth: daysInMonthVal };
  }, [anchor, timeZone, weekStart]);

  // Notebook v3 §3.2: month must show each touched day, not just start
  const byDay = useMemo(() => {
    const m = new Map<string, EventRecord[]>();
    for (const cell of grid) {
      const k = formatInTimeZone(cell, timeZone, "yyyy-MM-dd");
      m.set(k, []);
    }
    for (const e of events) {
      const startK = dayKey(e.startAt, timeZone);
      const endK = dayKey(e.endAt, timeZone);
      // Push to every grid day between startK and endK inclusive (handles multi-day)
      for (const [k, arr] of m.entries()) {
        if (k >= startK && k <= endK) arr.push(e);
      }
    }
    return m;
  }, [grid, events, timeZone]);

  const todayKey = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
  return (
    <div className="month">
      <div className="mrow">
        {weekdays.map((d) => (
          <div key={d} className="mh">
            {d}
          </div>
        ))}
      </div>
      {Array.from({ length: 6 }, (_, r) => (
        <div key={r} className="mrow">
          {Array.from({ length: 7 }, (_, c) => {
            const idx = r * 7 + c;
            const d = grid[idx]!;
            const key = formatInTimeZone(d, timeZone, "yyyy-MM-dd");
            const list = byDay.get(key) ?? [];
            const isOut = formatInTimeZone(d, timeZone, "MM") !== formatInTimeZone(anchor, timeZone, "MM");
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`mcell${isOut ? " out" : ""}${isToday ? " today" : ""}`}
                data-date={key}
                onClick={() => onCreateAt(key, 9 * 60)}
                onContextMenu={(e) => { e.preventDefault(); onEmptyContextMenu?.(e, key, 9*60); }}
              >
                <span className="num">{formatInTimeZone(d, timeZone, "d")}</span>
                {list.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onSelectEvent(ev.id); }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onEventContextMenu?.(e, ev.id); }}
                    className="chip"
                    style={{ ["--c" as string]: colorOf(ev.calendarId) } as any}
                  >
                    {!ev.allDay && <b>{formatClockWithFormat(ev.startAt, timeZone, "12h", locale)} </b>}
                    {ev.title}
                  </button>
                ))}
                {list.length > 3 && (
                  <button className="more" onClick={(e) => { e.stopPropagation(); onSelectEvent(list[3]!.id); }}>
                    +{list.length - 3} {locale.startsWith("fr") ? "autres" : "more"}
                  </button>
                )}
                <div className="dots">
                  {list.slice(0, 5).map((ev) => (
                    <i key={ev.id} style={{ ["--c" as string]: colorOf(ev.calendarId) } as any} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
