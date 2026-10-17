"use client";
/**
 * "Notebook" page view — a page-flip book showing one week as 7 dated
 * pages, two at a time (a left/right spread), styled after the reference
 * mock: dark stage, stacked-page depth behind the spine, a time-ordered
 * event list per page, and a free-text Notes section at the bottom of
 * each page (see day-notes.ts for how notes are persisted).
 *
 * Reuses the same `events`/`calendars`/`anchor` data CalendarShell already
 * loads for the week — this is a different presentation, not a different
 * data source. Clicking an event opens the normal EventDialog via
 * `onSelectEvent`, same as every other view.
 */
import { useEffect, useMemo, useState } from "react";
import { addDays, civilDayKey, formatClockWithFormat } from "@/lib/dates/date-utils";
import { BookIcon, ChevronLeftIcon, ChevronRightIcon, NoteIcon } from "@/lib/icons";
import { getDayNote, setDayNote } from "../lib/day-notes";
import type { CalendarSummary, EventRecord } from "@/features/calendar/types";
import { useAppI18n } from "@/lib/i18n";

function weekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = (d.getTime() - start.getTime()) / 86400000;
  return Math.ceil((diff + start.getDay() + 1) / 7);
}

function eventsForDay(events: EventRecord[], day: Date, timeZone: string): EventRecord[] {
  const dayEnd = addDays(day, 1, timeZone);
  return events
    .filter((e) => new Date(e.startAt) < dayEnd && new Date(e.endAt) > day)
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    });
}

function calFor(calendars: CalendarSummary[], id: string) {
  return calendars.find((c) => c.id === id);
}

function NotebookPage({
  day,
  index,
  total,
  events,
  calendars,
  timeZone,
  timeFormat,
  workspaceId,
  onSelectEvent,
}: {
  day: Date;
  index: number;
  total: number;
  events: EventRecord[];
  calendars: CalendarSummary[];
  timeZone: string;
  timeFormat: "12h" | "24h";
  workspaceId: string;
  onSelectEvent: (id: string) => void;
}) {
  const { locale, t } = useAppI18n();
  const dateKey = civilDayKey(day, timeZone);
  const dayEvents = useMemo(() => eventsForDay(events, day, timeZone), [events, day, timeZone]);
  const [note, setNote] = useState("");

  useEffect(() => {
    setNote(getDayNote(workspaceId, dateKey));
  }, [workspaceId, dateKey]);

  return (
    <div className="nb-page">
      <div className="nb-page-top">
        <div>
          <div className="nb-day">{new Intl.DateTimeFormat(locale, { timeZone, weekday: "long" }).format(day)}</div>
          <div className="nb-date">{new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "long", year: "numeric" }).format(day)}</div>
        </div>
        <span className="nb-week">{t("week")} {weekNumber(day)}</span>
      </div>

      <div className="nb-events">
        {dayEvents.length === 0 ? (
          <p className="nb-empty">{t("noEvents")}</p>
        ) : (
          dayEvents.map((ev) => {
            const cal = calFor(calendars, ev.calendarId);
            return (
              <button
                key={ev.id}
                type="button"
                className="nb-ev"
                onClick={() => onSelectEvent(ev.id)}
                style={{ ["--c" as string]: cal?.color ?? "#3D7CFA" } as React.CSSProperties}
              >
                <span className="nb-time">{ev.allDay ? t("allDay") : formatClockWithFormat(ev.startAt, timeZone, timeFormat, locale)}</span>
                <span className="nb-dot" />
                <span className="nb-evtext">
                  <b>{ev.title || "(No title)"}</b>
                  {ev.location && <small>{ev.location}</small>}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="nb-notes">
        <div className="nb-notes-h"><NoteIcon size={14} /> Notes</div>
        <textarea
          value={note}
          placeholder={t("addDayNote")}
          onChange={(e) => {
            setNote(e.target.value);
            setDayNote(workspaceId, dateKey, e.target.value);
          }}
        />
      </div>

      <div className="nb-pagenum">{index + 1} / {total}</div>
    </div>
  );
}

export function NotebookView({
  days,
  events,
  calendars,
  timeZone,
  timeFormat,
  workspaceId,
  onSelectEvent,
}: {
  /** The current week's 7 civil days, Monday/Sunday-first per the user's settings. */
  days: Date[];
  events: EventRecord[];
  calendars: CalendarSummary[];
  timeZone: string;
  timeFormat: "12h" | "24h";
  workspaceId: string;
  onSelectEvent: (id: string) => void;
}) {
  const total = days.length;
  const [spreadStart, setSpreadStart] = useState(0);

  // If the week changes size/content (e.g. anchor moved), keep the spread in bounds.
  useEffect(() => {
    setSpreadStart((s) => Math.min(s, Math.max(0, total - 1)));
  }, [total]);

  const left = days[spreadStart];
  const right = spreadStart + 1 < total ? days[spreadStart + 1] : undefined;

  return (
    <div className="notebook">
      <div className="nb-head">
        <div className="nb-badge"><BookIcon size={22} /></div>
        <div>
          <h2>{t("agenda")}</h2>
          <p>{t("notebookSubtitle")}</p>
        </div>
      </div>

      <div className="nb-stage">
        <div className="nb-navcol">
          <button
            type="button"
            className="nb-navbtn"
            aria-label={t("previousPage")}
            disabled={spreadStart === 0}
            onClick={() => setSpreadStart((s) => Math.max(0, s - 2))}
          >
            <ChevronLeftIcon />
          </button>
          <span>{t("previousPage")}</span>
        </div>

        <div className="nb-book">
          <div className="nb-stack s3" />
          <div className="nb-stack s2" />
          <div className="nb-stack s1" />
          <div className="nb-spread" key={spreadStart}>
            {left && (
              <NotebookPage
                day={left}
                index={spreadStart}
                total={total}
                events={events}
                calendars={calendars}
                timeZone={timeZone}
                timeFormat={timeFormat}
                workspaceId={workspaceId}
                onSelectEvent={onSelectEvent}
              />
            )}
            {right && (
              <NotebookPage
                day={right}
                index={spreadStart + 1}
                total={total}
                events={events}
                calendars={calendars}
                timeZone={timeZone}
                timeFormat={timeFormat}
                workspaceId={workspaceId}
                onSelectEvent={onSelectEvent}
              />
            )}
          </div>
        </div>

        <div className="nb-navcol">
          <button
            type="button"
            className="nb-navbtn"
            aria-label={t("nextPage")}
            disabled={spreadStart + 2 >= total}
            onClick={() => setSpreadStart((s) => Math.min(total - 1, s + 2))}
          >
            <ChevronRightIcon />
          </button>
          <span>{t("nextPage")}</span>
        </div>
      </div>
    </div>
  );
}
