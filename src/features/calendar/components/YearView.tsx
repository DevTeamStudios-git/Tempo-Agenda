"use client";
import { useMemo } from "react";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { dayKey } from "@/lib/dates/date-utils";
import type { CalendarSummary, EventRecord } from "../types";
import { useAppI18n } from "@/lib/i18n";

export function YearView({
  anchor,
  events,
  calendars,
  timeZone,
  onSelectDate,
}: {
  anchor: Date;
  events: EventRecord[];
  calendars: CalendarSummary[];
  timeZone: string;
  onSelectDate: (iso: string) => void;
}) {
  const { locale, t } = useAppI18n();
  const year = formatInTimeZone(anchor, timeZone, "yyyy");
  const yearNum = Number(year);

  // Count events per day for density dots
  const countByDay = useMemo(() => {
    const m = new Map<string, number>();
    const colorByDay = new Map<string, string>();
    for (const e of events) {
      const sk = dayKey(e.startAt, timeZone);
      const ek = dayKey(e.endAt, timeZone);
      // For perf, just count start day in year view (density approximation)
      const k = sk;
      m.set(k, (m.get(k) ?? 0) + 1);
      if (!colorByDay.has(k)) {
        colorByDay.set(k, calendars.find(c => c.id === e.calendarId)?.color ?? "var(--accent)");
      }
    }
    return { counts: m, colors: colorByDay };
  }, [events, timeZone, calendars]);

  const todayKey = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, mi) => {
      const first = new Date(yearNum, mi, 1);
      // Build 6-week grid for month (same as MonthView)
      const zoned = toZonedTime(anchor, timeZone); // not needed, use first
      void zoned;
      const startDow = (first.getDay() + 6) % 7; // Mon=0
      const cells: Date[] = [];
      const start = new Date(first);
      start.setDate(1 - startDow);
      for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        cells.push(d);
      }
      return { mi, first, cells };
    });
  }, [yearNum, anchor, timeZone]);

  return (
    <div className="year">
      <div className="year-head">{year}</div>
      <div className="year-grid">
        {months.map(({ mi, first, cells }) => {
          const name = new Intl.DateTimeFormat(locale, { timeZone, month: "long" }).format(first);
          return (
            <div key={mi} className="year-month">
              <div className="year-month-name">{name}</div>
              <div className="year-weekdays">
                {Array.from({ length: 7 }, (_, i) => i).map((offset) => <span key={offset}>{new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2024, 0, 1 + offset))}</span>)}
              </div>
              <div className="year-cells">
                {cells.slice(0, 35).map((d) => {
                  const k = formatInTimeZone(d, timeZone, "yyyy-MM-dd");
                  const isOut = d.getMonth() !== mi;
                  const isToday = k === todayKey;
                  const cnt = countByDay.counts.get(k) ?? 0;
                  const col = countByDay.colors.get(k) ?? "var(--accent)";
                  const intensity = cnt === 0 ? 0 : cnt === 1 ? 1 : cnt <= 3 ? 2 : 3;
                  return (
                    <button
                      key={k}
                      className={`year-cell${isOut ? " out" : ""}${isToday ? " today" : ""} dens-${intensity}`}
                      onClick={() => onSelectDate(k)}
                      style={{ ["--c" as string]: col } as any}
                      title={`${k}${cnt ? ` · ${cnt} ${locale.startsWith("fr") ? "événement(s)" : "event(s)"}` : ""}`}
                    >
                      <span>{d.getDate()}</span>
                      {cnt > 0 && <i />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="year-legend" style={{ padding: "8px 4px", fontSize: 11, color: "var(--muted)", display: "flex", gap: 8, alignItems: "center" }}>
        <span>{t("eventDensity")}</span>
        <span style={{ display:"inline-flex", gap:4, alignItems:"center" }}><i style={{ width:8,height:8,borderRadius:"50%",background:"var(--line)",display:"inline-block"}}/> none</span>
        <span style={{ display:"inline-flex", gap:4, alignItems:"center" }}><i style={{ width:8,height:8,borderRadius:"50%",background:"color-mix(in srgb, var(--accent) 30%, transparent)",display:"inline-block"}}/> 1</span>
        <span style={{ display:"inline-flex", gap:4, alignItems:"center" }}><i style={{ width:8,height:8,borderRadius:"50%",background:"color-mix(in srgb, var(--accent) 60%, transparent)",display:"inline-block"}}/> 2-3</span>
        <span style={{ display:"inline-flex", gap:4, alignItems:"center" }}><i style={{ width:8,height:8,borderRadius:"50%",background:"var(--accent)",display:"inline-block"}}/> 4+</span>
      </div>
    </div>
  );
}
