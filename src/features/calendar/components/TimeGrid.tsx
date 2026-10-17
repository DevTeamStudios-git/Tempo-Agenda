"use client";
/**
 * Day/Week time grid — ported from the prototype's timeGrid(). Overlap
 * placement comes from layoutDay(); drag/resize lives in useEventDrag().
 * Notebook v3 §3.5: Event → EventSegment → layoutSegments → render
 */
import { useMemo, useRef } from "react";
import { segmentEventsForDays, layoutSegments } from "../lib/event-segmentation";
import { dayKey, formatClock, minutesOfDay } from "@/lib/dates/date-utils";
import type { CalendarSummary, EventRecord } from "../types";
import { useEventDrag } from "../hooks/useEventDrag";
import { formatInTimeZone } from "date-fns-tz";
import { useSettings } from "@/lib/settings";
import { useAppI18n } from "@/lib/i18n";

const HOUR = 56;
function fmtMinutes(m: number, timeFormat: "12h" | "24h", locale = "en-US"): string {
  const base = new Date(2024, 0, 1, Math.floor(m / 60) % 24, m % 60);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  }).format(base);
}

export function TimeGrid({
  days, events, calendars, timeZone, onSelectEvent, onCreateAt, onMoveOrResize, onSelectDay, onEventContextMenu, onEmptyContextMenu,
}: {
  days: Date[];
  events: EventRecord[];
  calendars: CalendarSummary[];
  timeZone: string;
  onSelectEvent: (id: string) => void;
  onCreateAt: (dateKey: string, minutes: number) => void;
  onMoveOrResize: (id: string, startAt: string, endAt: string) => void;
  onSelectDay?: (iso: string) => void;
  onEventContextMenu?: (e: React.MouseEvent, id: string) => void;
  onEmptyContextMenu?: (e: React.MouseEvent, dateKey: string, minutes: number) => void;
}) {
  const colorOf = (calendarId: string) =>
    calendars.find((c) => c.id === calendarId)?.color ?? "var(--accent)";

  // Notebook v3 §3.5 + P1 §11: segment timed + all-day per visible civil day
  const segMap = useMemo(() => segmentEventsForDays(events, days, timeZone), [events, days, timeZone]);
  const allDayMap = useMemo(() => {
    const m = new Map<string, EventRecord[]>();
    for (const d of days) m.set(dayKey(d.toISOString(), timeZone), []);
    for (const e of events) if (e.allDay) {
      const sk = dayKey(e.startAt, timeZone);
      const ek = dayKey(e.endAt, timeZone);
      // All-day spanning multiple civil days (e.g., 3-day conference)
      if (sk === ek) {
        if (m.has(sk)) m.get(sk)!.push(e);
      } else {
        for (const d of days) {
          const k = dayKey(d.toISOString(), timeZone);
          if (k >= sk && k <= ek && m.has(k)) m.get(k)!.push(e);
        }
      }
    }
    return m;
  }, [events, days, timeZone]);
  const gridRef = useRef<HTMLDivElement>(null);

  const { onPointerDown } = useEventDrag({ timeZone, hourHeight: HOUR, days, onMoveOrResize, gridRef: gridRef as any });
  const { settings } = useSettings();
  const { locale, t } = useAppI18n();

  const today = dayKey(new Date().toISOString(), timeZone);
  const nowMinutes = minutesOfDay(new Date().toISOString(), timeZone);

  return (
    <div className="tg-wrap" id="scroll">
      <div className="tg-inner" style={{ ["--n" as string]: days.length }}>
        <div className="tg-head">
          <div />
          {days.map((d) => {
            const key = dayKey(d.toISOString(), timeZone);
            return (
              <button key={key} className={`dh${key === today ? " today" : ""}`} onClick={() => onSelectDay?.(key)} data-goto={key}>
                <span>{new Intl.DateTimeFormat(locale, { timeZone, weekday: "short" }).format(d)}</span>
                <span className="dd">{formatInTimeZone(d, timeZone, "d")}</span>
              </button>
            );
          })}
        </div>
        <div className="tg-all">
          <div className="lbl">{t("allDay")}</div>
          {days.map((d) => {
            const key = dayKey(d.toISOString(), timeZone);
            const list = allDayMap.get(key) ?? [];
            return (
              <div key={key} className="ac">
                {list.map((ev) => (
                  <button key={ev.id} className="chip" data-id={ev.id} style={{ ["--c" as string]: colorOf(ev.calendarId) } as any} onClick={() => onSelectEvent(ev.id)}>
                    {ev.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <div className="tg-body" ref={gridRef as any} style={{ height: HOUR * 24 }}>
          <div className="gutter">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <span key={h} style={{ top: h * HOUR }}>
                {settings.timeFormat === "24h"
                  ? `${String(h).padStart(2, "0")}:00`
                  : new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(2024, 0, 1, h, 0))}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const key = dayKey(d.toISOString(), timeZone);
            const segments = segMap.get(key) ?? [];
            const laidOut = layoutSegments(segments);
            const isToday = key === today;
            return (
              <div
                key={key}
                className={`col${isToday ? " today" : ""}`}
                data-day={key}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const minutes = Math.max(0, Math.floor(((e.clientY - rect.top) / HOUR) * 2) * 30);
                  onCreateAt(key, minutes);
                }}
                onDoubleClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const minutes = Math.max(0, Math.floor(((e.clientY - rect.top) / HOUR) * 4) * 15);
                  onCreateAt(key, minutes);
                }}
                onContextMenu={(e) => {
                  if ((e.target as HTMLElement).closest(".ev")) return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const minutes = Math.max(0, Math.floor(((e.clientY - rect.top) / HOUR) * 4) * 15);
                  onEmptyContextMenu?.(e, key, minutes);
                }}
              >
                {laidOut.map(({ segment: seg, column, columnCount }) => {
                  const orig = seg.event;
                  const start = seg.startMinutes;
                  const end = seg.endMinutes;
                  const h = Math.max(22, ((end - start) * HOUR) / 60 - 2);
                  const range = `${fmtMinutes(start, settings.timeFormat, locale)} – ${fmtMinutes(end, settings.timeFormat, locale)}`;
                  const isCrossMidnight = dayKey(orig.startAt, timeZone) !== dayKey(orig.endAt, timeZone);
                  return (
                    <div
                      key={orig.id + (seg.continuesBefore ? "-b" : "") + (seg.continuesAfter ? "-a" : "")}
                      className="ev"
                      role="button"
                      tabIndex={0}
                      aria-label={`${orig.title} ${range}${seg.continuesBefore ? ` (${t("eventContinues")})` : ""}`}
                      style={{
                        top: (start * HOUR) / 60,
                        height: h,
                        left: `calc(${(column / columnCount) * 100}% + 2px)`,
                        width: `calc(${100 / columnCount}% - 4px)`,
                        ["--c" as string]: colorOf(orig.calendarId),
                        opacity: seg.continuesBefore || seg.continuesAfter ? 0.92 : 1,
                      }}
                      onPointerDown={(e) => onPointerDown(e, orig, "move")}
                      onClick={(e) => { e.stopPropagation(); onSelectEvent(orig.id); }}
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onEventContextMenu?.(e, orig.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSelectEvent(orig.id); } }}
                    >
                      <div className="t">{orig.title}{seg.continuesAfter ? " →" : ""}</div>
                      {h >= 40 && <div className="s">{range}{orig.location && h >= 58 ? ` · ${orig.location}` : ""}</div>}
                      {!isCrossMidnight && <div className="rz" onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, orig, "resize"); }} />}
                    </div>
                  );
                })}
                {isToday && <div className="now" style={{ top: (nowMinutes * HOUR) / 60 }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
