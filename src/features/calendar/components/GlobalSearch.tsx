"use client";
/**
 * Header search bar. Covers both halves of "search for events and days":
 *  - typing a date-ish string ("tomorrow", "next friday", "sep 28") shows a
 *    "Jump to day" result, parsed client-side (see `search-date-parse.ts`)
 *  - typing anything else queries `/api/events/search`, which searches
 *    every event in the workspace (not just the currently-visible range),
 *    so a match next month still turns up
 *
 * The plain-text input still drives the existing in-range filtering in
 * CalendarShell (via `value`/`onChange`) — this component only adds the
 * dropdown of jump-to results on top of that.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon, CalendarJumpIcon, ArrowRightIcon, CloseIcon } from "@/lib/icons";
import { formatRange, dayKey } from "@/lib/dates/date-utils";
import { parseDateQuery, type DateMatch } from "../lib/search-date-parse";
import type { CalendarSummary, EventRecord } from "../types";
import { useAppI18n } from "@/lib/i18n";

export function GlobalSearch({
  value,
  onChange,
  workspaceId,
  calendarIds,
  calendars,
  timeZone,
  onJumpToDay,
  onJumpToEvent,
}: {
  value: string;
  onChange: (v: string) => void;
  workspaceId: string;
  calendarIds: string[];
  calendars: CalendarSummary[];
  timeZone: string;
  onJumpToDay: (dateKey: string) => void;
  onJumpToEvent: (event: EventRecord) => void;
}) {
  const { locale, t } = useAppI18n();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const dateMatches: DateMatch[] = useMemo(() => {
    if (value.trim().length < 3) return [];
    return parseDateQuery(value, timeZone);
  }, [value, timeZone]);

  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ workspaceId, q, limit: "8" });
        calendarIds.forEach((cid) => params.append("calendarId", cid));
        const res = await fetch(`/api/events/search?${params.toString()}`);
        if (id !== requestId.current) return; // stale
        if (!res.ok) { setResults([]); return; }
        const data = await res.json();
        if (id !== requestId.current) return;
        setResults(data.events ?? []);
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value, workspaceId, calendarIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveIndex(-1);
    setOpen(value.trim().length > 0);
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const flatItems: Array<{ kind: "day"; day: DateMatch } | { kind: "event"; event: EventRecord }> = [
    ...dateMatches.map((d) => ({ kind: "day" as const, day: d })),
    ...results.map((e) => ({ kind: "event" as const, event: e })),
  ];

  function selectDay(d: DateMatch) {
    onJumpToDay(d.dateKey);
    setOpen(false);
  }
  function selectEvent(e: EventRecord) {
    onJumpToEvent(e);
    setOpen(false);
  }
  function selectIndex(i: number) {
    const item = flatItems[i];
    if (!item) return;
    if (item.kind === "day") selectDay(item.day);
    else selectEvent(item.event);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); return; }
    if (!open || flatItems.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % flatItems.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i <= 0 ? flatItems.length - 1 : i - 1)); }
    else if (e.key === "Enter" && activeIndex >= 0) { e.preventDefault(); selectIndex(activeIndex); }
  }

  const showDropdown = open && value.trim().length > 0 && (dateMatches.length > 0 || results.length > 0 || loading);

  return (
    <div className="gsearch" ref={rootRef}>
      <label className="search">
        <SearchIcon size={16} style={{ color: "var(--muted)" }} />
        <input
          ref={inputRef}
          id="global-search-input"
          type="search"
          placeholder={t("searchEventsAndDays")}
          aria-label={t("searchEventsAndDays")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (value.trim()) setOpen(true); }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="gsearch-listbox"
        />
        {value && (
          <button
            type="button"
            aria-label={t("clearSearch")}
            className="gsearch-clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(""); setOpen(false); inputRef.current?.focus(); }}
          >
            <CloseIcon size={13} />
          </button>
        )}
      </label>

      {showDropdown && (
        <div className="gsearch-drop" id="gsearch-listbox" role="listbox">
          {dateMatches.length > 0 && (
            <div className="gsearch-section">
              <div className="gsearch-label">{t("days")}</div>
              {dateMatches.map((d, i) => (
                <button
                  key={d.dateKey}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === i}
                  className={`gsearch-row${activeIndex === i ? " active" : ""}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => selectDay(d)}
                >
                  <CalendarJumpIcon size={16} style={{ color: "var(--accent)", flex: "none" }} />
                  <span className="gsearch-title">{t("jumpTo")} {d.label}</span>
                  <ArrowRightIcon size={14} style={{ color: "var(--muted)", flex: "none" }} />
                </button>
              ))}
            </div>
          )}

          <div className="gsearch-section">
            <div className="gsearch-label">{t("events")}{loading ? " — " + t("searching") : ""}</div>
            {!loading && results.length === 0 && (
              <p className="gsearch-empty">{t("noMatchingEvents")}</p>
            )}
            {results.map((ev, i) => {
              const idx = dateMatches.length + i;
              const cal = calendars.find((c) => c.id === ev.calendarId);
              return (
                <button
                  key={ev.id}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === idx}
                  className={`gsearch-row${activeIndex === idx ? " active" : ""}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectEvent(ev)}
                  style={{ ["--c" as string]: cal?.color ?? "var(--muted)" } as React.CSSProperties}
                >
                  <span className="gsearch-dot" />
                  <span className="gsearch-col">
                    <span className="gsearch-title">{ev.title || "(No title)"}</span>
                    <span className="gsearch-sub">
                      {dayKey(ev.startAt, timeZone) === dayKey(ev.endAt, timeZone) || ev.allDay
                        ? new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(ev.startAt))
                        : `${new Intl.DateTimeFormat(locale, { timeZone, month: "short", day: "numeric" }).format(new Date(ev.startAt))} – ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ev.endAt))}`}
                      {!ev.allDay ? ` · ${formatRange(ev.startAt, ev.endAt, timeZone)}` : " · All day"}
                      {ev.location ? ` · ${ev.location}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
