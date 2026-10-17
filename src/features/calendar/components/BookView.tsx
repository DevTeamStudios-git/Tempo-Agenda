"use client";
import { useMemo, useState, useRef, useCallback } from "react";
import { addDays, dayKey, formatClockWithFormat } from "@/lib/dates/date-utils";
import { formatInTimeZone } from "date-fns-tz";
import type { CalendarSummary, EventRecord } from "../types";
import { useSettings } from "@/lib/settings";
import { ChevronLeftIcon, ChevronRightIcon } from "@/lib/icons";
import { useAppI18n } from "@/lib/i18n";

export function BookView({
  anchor,
  events,
  calendars,
  timeZone,
  onSelectEvent,
  onCreateAt,
  onPrev,
  onNext,
  onGoToday,
  onJumpToDate,
}: {
  anchor: Date;
  events: EventRecord[];
  calendars: CalendarSummary[];
  timeZone: string;
  onSelectEvent: (id: string) => void;
  onCreateAt: (dateKey: string, minutes: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onGoToday: () => void;
  onJumpToDate: (iso: string) => void;
}) {
  const { settings } = useSettings();
  const { locale, t } = useAppI18n();
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);
  const [dragX, setDragX] = useState(0);
  const dragRef = useRef<{ startX: number; dragging: boolean } | null>(null);
  const colorOf = (id: string) => calendars.find((c) => c.id === id)?.color ?? "var(--accent)";

  // Two-page spread: left = anchor, right = anchor+1
  const leftDate = anchor;
  const rightDate = useMemo(() => addDays(anchor, 1, timeZone), [anchor, timeZone]);
  const leftKey = formatInTimeZone(leftDate, timeZone, "yyyy-MM-dd");
  const rightKey = formatInTimeZone(rightDate, timeZone, "yyyy-MM-dd");

  const eventsByDay = useMemo(() => {
    const m = new Map<string, EventRecord[]>();
    m.set(leftKey, []);
    m.set(rightKey, []);
    for (const e of events) {
      const sk = dayKey(e.startAt, timeZone);
      const ek = dayKey(e.endAt, timeZone);
      for (const k of [leftKey, rightKey]) {
        if (k >= sk && k <= ek) m.get(k)!.push(e);
      }
    }
    for (const [, arr] of m) arr.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return m;
  }, [events, leftKey, rightKey, timeZone]);

  // Single shared navigation path — arrows and swipe call the same handlers (report §5)
  const triggerPrev = useCallback(() => {
    setAnimDir("left");
    window.setTimeout(() => { setAnimDir(null); onPrev(); }, 220);
  }, [onPrev]);
  const triggerNext = useCallback(() => {
    setAnimDir("right");
    window.setTimeout(() => { setAnimDir(null); onNext(); }, 220);
  }, [onNext]);

  // Swipe / drag page — attached to .book-spread only so .book-nav arrows remain independently clickable (report §5 / §7)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Ignore drags that start on interactive controls (arrows, date input, buttons)
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, dragging: true };
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current?.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    setDragX(Math.max(-120, Math.min(120, dx)));
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current = null;
    setDragX(0);
    if (dx > 60) triggerPrev();
    else if (dx < -60) triggerNext();
  }, [triggerPrev, triggerNext]);

  const renderPage = (date: Date, key: string) => {
    const list = eventsByDay.get(key) ?? [];
    const isToday = key === formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
    const dayLabel = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long" }).format(date);
    const dateLabel = new Intl.DateTimeFormat(locale, { timeZone, month: "long", day: "numeric", year: "numeric" }).format(date);
    return (
      <div className={`book-page${isToday ? " today" : ""}`} data-date={key} onClick={(e) => {
        if ((e.target as HTMLElement).closest(".book-ev")) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const minutes = Math.max(0, Math.floor(((e.clientY - rect.top - 64) / 48) * 60));
        // Only if clicking in timeline area
        if (minutes >= 0 && minutes < 1440) onCreateAt(key, Math.round(minutes / 15) * 15);
      }}>
        <div className="book-page-head">
          <span className="book-dayname">{dayLabel}</span>
          <span className="book-datename">{dateLabel}</span>
          {isToday && <span className="book-today-badge">{t("today")}</span>}
        </div>
        <div className="book-timeline">
          {Array.from({ length: 13 }, (_, i) => i * 2).map((h) => (
            <div key={h} className="book-hour" style={{ top: h * 48 }}>
              <span>{settings.timeFormat === "24h" ? `${String(h).padStart(2, "0")}:00` : `${h % 12 || 12}${h < 12 ? " AM" : " PM"}`}</span>
              <i />
            </div>
          ))}
          {list.filter(e => !e.allDay).map((ev) => {
            const sk = dayKey(ev.startAt, timeZone);
            const startMin = sk === key ? (() => { try { const d = new Date(ev.startAt); const z = new Date(d.toLocaleString("en-US", { timeZone })); return z.getHours()*60+z.getMinutes(); } catch { return 9*60; } })() : 0;
            // Use minutesOfDay properly via format
            let sMin = 0, eMin = 60;
            try {
              const fmt = (iso: string) => formatInTimeZone(new Date(iso), timeZone, "HH:mm");
              const [sh, sm] = fmt(ev.startAt).split(":").map(Number);
              const [eh, em] = fmt(ev.endAt).split(":").map(Number);
              sMin = (sh ?? 0) * 60 + (sm ?? 0);
              eMin = (eh ?? 0) * 60 + (em ?? 0);
              if (dayKey(ev.startAt, timeZone) !== key) sMin = 0;
              if (dayKey(ev.endAt, timeZone) !== key) eMin = 1440;
            } catch {}
            const top = (sMin * 48) / 60;
            const h = Math.max(22, ((eMin - sMin) * 48) / 60 - 2);
            return (
              <button key={ev.id} className="book-ev" style={{ top, height: h, ["--c" as string]: colorOf(ev.calendarId) } as any} onClick={(e) => { e.stopPropagation(); onSelectEvent(ev.id); }}>
                <span className="book-ev-time">{formatClockWithFormat(ev.startAt, timeZone, settings.timeFormat, locale)} – {formatClockWithFormat(ev.endAt, timeZone, settings.timeFormat, locale)}</span>
                <span className="book-ev-title">{ev.title}</span>
                {ev.location && h > 44 && <span className="book-ev-loc">{ev.location}</span>}
              </button>
            );
          })}
          {list.filter(e => e.allDay).length > 0 && (
            <div className="book-allday">
              {list.filter(e => e.allDay).map(ev => (
                <button key={ev.id} className="chip" style={{ ["--c" as string]: colorOf(ev.calendarId) } as any} onClick={(e) => { e.stopPropagation(); onSelectEvent(ev.id); }}>{ev.title}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="book-wrap">
      <div className="book-nav">
        <button className="book-nav-btn" aria-label={t("previousPage")} onClick={triggerPrev} type="button"><ChevronLeftIcon size={16} /></button>
        <button className="btn ghost" onClick={onGoToday} style={{ height: 32, padding: "0 12px" }} type="button">{t("today")}</button>
        <label className="book-jump">
          <input type="date" value={leftKey} onChange={(e) => e.target.value && onJumpToDate(e.target.value)} aria-label={t("jumpToDate")} />
        </label>
        <button className="book-nav-btn" aria-label={t("nextPage")} onClick={triggerNext} type="button"><ChevronRightIcon size={16} /></button>
      </div>
      <div
        className={`book-spread${animDir ? ` turning-${animDir}` : ""}`}
        style={{ transform: dragX ? `translateX(${dragX * 0.3}px)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="book-spine" />
        {renderPage(leftDate, leftKey)}
        {renderPage(rightDate, rightKey)}
      </div>
      <div className="book-hint">← {t("dragOrSwipe")} → &nbsp;·&nbsp; {t("useArrows")} &nbsp;·&nbsp; {t("pressT")}</div>
    </div>
  );
}
