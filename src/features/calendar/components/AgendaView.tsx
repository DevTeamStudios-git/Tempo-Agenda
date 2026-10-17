"use client";
import { useMemo } from "react";
import { dayKey, formatRange } from "@/lib/dates/date-utils";
import { formatInTimeZone } from "date-fns-tz";
import type { CalendarSummary, EventRecord } from "../types";
import { useAppI18n } from "@/lib/i18n";

export function AgendaView({
  events,
  calendars,
  timeZone,
  onSelectEvent,
  anchor,
  onEventContextMenu,
  onEmptyContextMenu,
}: {
  events: EventRecord[];
  calendars: CalendarSummary[];
  timeZone: string;
  onSelectEvent: (id: string) => void;
  anchor?: Date;
  onEventContextMenu?: (e: React.MouseEvent, id: string) => void;
  onEmptyContextMenu?: (e: React.MouseEvent, dateKey: string, minutes: number) => void;
}) {
  const { locale, t } = useAppI18n();
  const colorOf = (id: string) => calendars.find((c) => c.id === id)?.color ?? "var(--accent)";

  const grouped = useMemo(() => {
    const m = new Map<string, EventRecord[]>();
    const sorted = [...events].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    for (const e of sorted) {
      const k = e.allDay ? dayKey(e.startAt, timeZone) : dayKey(e.startAt, timeZone);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events, timeZone]);

  if (grouped.length === 0)
    return (
      <div className="agenda" onContextMenu={(e) => { if (anchor) { e.preventDefault(); const k = formatInTimeZone(anchor, timeZone, "yyyy-MM-dd"); onEmptyContextMenu?.(e, k, 9*60); } }}>
        <div className="empty">
          <b>{t("nothingPlanned")}</b>{t("createEventPrompt")}
        </div>
      </div>
    );

  return (
    <div className="agenda">
      {grouped.map(([day, list]) => {
        const d = new Date(day + "T12:00:00");
        const isToday = day === formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
        return (
          <div key={day} className={`day${isToday ? " today" : ""}`}>
            <div>
              <div className="dnum">{d.getDate()}</div>
              <div className="dwk">
                {new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", month: "short" }).format(d)}
              </div>
            </div>
            <div>
              {list.map((ev) => (
                <button key={ev.id} className="arow" data-id={ev.id} style={{ ["--c" as string]: colorOf(ev.calendarId) } as any} onClick={() => onSelectEvent(ev.id)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onEventContextMenu?.(e, ev.id); }}>
                  <span className="sw" />
                  <span className="tm">{ev.allDay ? t("allDay") : formatRange(ev.startAt, ev.endAt, timeZone, "12h", locale)}</span>
                  <span>
                    <span className="ti">{ev.title}</span>
                    {ev.location && (
                      <span className="lo">
                        <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" />
                          <circle cx={12} cy={11} r={2} />
                        </svg>
                        {ev.location}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
