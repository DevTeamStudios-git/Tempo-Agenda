"use client";
/**
 * Orchestrator — wires navigation state, server data (useCalendarEvents/useCalendars),
 * and the view components together. Implements Notebook v2/v3 corrections plus
 * prototype chrome parity (brand, mini calendar, UpNext, all-day row, tabs/FAB, keyboard).
 * Extended with Book, Year, Context Menus, Command Palette, DatePicker per AGENDAspec.
 */
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { addDays, addMonths, startOfWeek, toInstant } from "@/lib/dates/date-utils";
import { useCalendarEvents, useEventMutations } from "../hooks/useCalendarEvents";
import { useCalendars } from "../hooks/useCalendars";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TimeGrid } from "./TimeGrid";
import { MonthView } from "./MonthView";
import { AgendaView } from "./AgendaView";
import { BookView } from "./BookView";
import { YearView } from "./YearView";
import { MiniCalendar } from "./MiniCalendar";
import { UpNext } from "./UpNext";
import { RealtimeClock } from "@/features/clock/components/RealtimeClock";
import { PomodoroTimer } from "@/features/pomodoro/components/PomodoroTimer";
import { GlobalSearch } from "./GlobalSearch";
import { EventDialog } from "@/features/events/components/EventDialog";
import { ChevronLeftIcon, ChevronRightIcon, DayViewIcon, WeekViewIcon, MonthViewIcon, AgendaViewIcon, PlusIcon, MenuIcon, SettingsIcon, PrintIcon, TrashIcon, BookIcon, YearViewIcon, CommandIcon, SearchIcon, HomeIcon, CalendarMarkIcon, EditIcon, DuplicateIcon, CopyIcon, CutIcon, PasteIcon, EyeIcon, SparklesIcon } from "@/lib/icons";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { SettingsDialog } from "@/features/settings/components/SettingsDialog";
import { PrintDialog } from "@/features/print/components/PrintDialog";
import { AiChat } from "@/features/ai/components/AiChat";
import { ContextMenu } from "./ContextMenu";
import { CommandPalette, type Command } from "./CommandPalette";
import { NotebookView } from "@/features/notebook/components/NotebookView";
import { useRealtimeEvents } from "../hooks/useRealtimeEvents";
import { useReminderNotifier } from "@/features/notifications/hooks/useReminderNotifier";
import { useSettings } from "@/lib/settings";
import type { CalendarSummary, CalendarView, EventDraft, EventRecord } from "../types";
import { dayKey } from "@/lib/dates/date-utils";
import { formatInTimeZone } from "date-fns-tz";
import { useAppI18n } from "@/lib/i18n";

const FALLBACK_CALENDARS: CalendarSummary[] = [
  { id: "work", name: "Work", color: "var(--work)", isDefault: true, isArchived: false },
  { id: "personal", name: "Personal", color: "var(--personal)", isDefault: false, isArchived: false },
  { id: "study", name: "Study", color: "var(--study)", isDefault: false, isArchived: false },
  { id: "health", name: "Health", color: "var(--health)", isDefault: false, isArchived: false },
];

export function CalendarShell(props: { workspaceId: string; timeZone: string }) {
  return <CalendarShellInner {...props} />;
}

function CalendarShellInner({ workspaceId, timeZone }: { workspaceId: string; timeZone: string }) {
  const { lang, locale, setLang, t } = useAppI18n();
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [miniAnchor, setMiniAnchor] = useState(new Date());
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [visibleCalendars, setVisibleCalendars] = useState<string[]>(FALLBACK_CALENDARS.map((c) => c.id));
  const [dialogDraft, setDialogDraft] = useState<EventDraft | null>(null);
  const [dialogIsNew, setDialogIsNew] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [toast, setToast] = useState<{ msg: string; undoId?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [lastReset, setLastReset] = useState<{ ids: string[]; count: number } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [ctx, setCtx] = useState<null | { x: number; y: number; kind: "event"; eventId: string } | { x: number; y: number; kind: "empty"; dateKey: string; minutes: number }>(null);
  const clipboardRef = useRef<EventRecord | null>(null);
  const [cutId, setCutId] = useState<string | null>(null);
  const { settings } = useSettings();
  const effectiveTimeZone = settings.timezone || timeZone;
  const weekStart = settings.weekStart;
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: serverCalendars, isLoading: calLoading, isError: calError } = useCalendars(workspaceId);
  const calendars: CalendarSummary[] = (() => {
    if (calError) return FALLBACK_CALENDARS;
    if (calLoading) return FALLBACK_CALENDARS;
    if (serverCalendars && serverCalendars.length) return serverCalendars;
    if (serverCalendars && serverCalendars.length === 0) return [];
    return FALLBACK_CALENDARS;
  })();

  useEffect(() => {
    if (serverCalendars && serverCalendars.length && visibleCalendars.length === FALLBACK_CALENDARS.length) {
      const fallbackSet = new Set(FALLBACK_CALENDARS.map((c) => c.id));
      const isFallback = visibleCalendars.every((id) => fallbackSet.has(id));
      if (isFallback) setVisibleCalendars(serverCalendars.map((c) => c.id));
    }
  }, [serverCalendars]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMiniAnchor(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  }, [anchor]);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "month") {
      const start = startOfWeek(anchor, effectiveTimeZone, weekStart);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i, effectiveTimeZone));
    }
    if (view === "agenda") return [anchor];
    if (view === "book") return [anchor, addDays(anchor, 1, effectiveTimeZone)];
    if (view === "year") return [anchor];
    const start = startOfWeek(anchor, effectiveTimeZone, weekStart);
    const all = Array.from({ length: 7 }, (_, i) => addDays(start, i, effectiveTimeZone));
    if (!settings.showWeekends && view === "week") {
      return all.filter((_, idx) => (weekStart === "monday" ? idx < 5 : idx !== 0 && idx !== 6));
    }
    return all;
  }, [view, anchor, effectiveTimeZone, weekStart, settings.showWeekends]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "month") {
      const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const m = startOfWeek(monthStart, effectiveTimeZone, weekStart);
      return { rangeStart: m, rangeEnd: addDays(m, 42, effectiveTimeZone) };
    }
    if (view === "agenda") {
      return { rangeStart: anchor, rangeEnd: addDays(anchor, 30, effectiveTimeZone) };
    }
    if (view === "day") {
      const s = days[0]!;
      return { rangeStart: s, rangeEnd: addDays(s, 1, effectiveTimeZone) };
    }
    if (view === "book") {
      const s = anchor;
      return { rangeStart: s, rangeEnd: addDays(s, 2, effectiveTimeZone) };
    }
    if (view === "year") {
      const y = anchor.getFullYear();
      const s = new Date(y, 0, 1);
      const e = new Date(y + 1, 0, 1);
      return { rangeStart: s, rangeEnd: e };
    }
    return { rangeStart: days[0]!, rangeEnd: addDays(days[days.length - 1]!, 1, effectiveTimeZone) };
  }, [view, days, anchor, effectiveTimeZone, weekStart]);

  const rangeArgs = { workspaceId, calendarIds: visibleCalendars, rangeStart, rangeEnd, q: debouncedQ || undefined };
  const { data: events = [], isLoading, isError } = useCalendarEvents(rangeArgs);
  const { create, update, moveOrResize, remove, restore } = useEventMutations(rangeArgs);
  const queryClient = useQueryClient();
  const allDayCount = events.filter((e) => e.allDay).length;
  const resetAllDay = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/events/reset-all-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, calendarIds: visibleCalendars }),
      });
      if (!res.ok) {
        const b: any = await res.json().catch(() => null);
        throw new Error(b?.error?.message ?? "Failed to reset all-day events");
      }
      return (await res.json()) as { count: number; ids: string[] };
    },
    onSuccess: (data) => {
      if (!data.count) {
        setToast({ msg: t("noEventsToReset") });
        setTimeout(() => setToast(null), 2500);
        return;
      }
      setLastReset({ ids: data.ids, count: data.count });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setToast({ msg: t("resetDone", { count: data.count }), undoId: "bulk-all-day" });
      setTimeout(() => setToast(null), 5000);
    },
    onError: (e: unknown) => {
      setToast({ msg: e instanceof Error ? e.message : String(e) });
      setTimeout(() => setToast(null), 4000);
    },
  });
  const restoreBulk = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/events/restore-many", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ids }),
      });
      if (!res.ok) throw new Error("Failed to restore");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setLastReset(null);
      setToast({ msg: t("restoredAllDay") });
      setTimeout(() => setToast(null), 3000);
    },
  });

  function openNewEventAt(dateKey: string, minutes: number) {
    const preferred = settings.defaultCalendarId && calendars.some((c) => c.id === settings.defaultCalendarId) ? settings.defaultCalendarId : null;
    const targetCal = preferred ?? visibleCalendars[0] ?? calendars[0]?.id;
    if (!targetCal) {
      setToast({ msg: t("createCalendarFirst") });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const snapped = Math.round(minutes / 15) * 15;
    const dur = settings.defaultDuration || 60;
    const startAt = toInstant(dateKey, snapped, effectiveTimeZone);
    const endAt = toInstant(dateKey, snapped + dur, effectiveTimeZone);
    setDialogIsNew(true);
    setDialogDraft({
      calendarId: targetCal,
      title: "",
      description: "",
      location: "",
      startAt,
      endAt,
      timezone: effectiveTimeZone,
      allDay: false,
    });
  }

  function openNewAllDayAt(dateKey: string) {
    const preferred = settings.defaultCalendarId && calendars.some((c) => c.id === settings.defaultCalendarId) ? settings.defaultCalendarId : null;
    const targetCal = preferred ?? visibleCalendars[0] ?? calendars[0]?.id;
    if (!targetCal) return;
    const startAt = toInstant(dateKey, 0, effectiveTimeZone);
    const endAt = toInstant(dateKey, 24 * 60, effectiveTimeZone);
    setDialogIsNew(true);
    setDialogDraft({ calendarId: targetCal, title: "", description: "", location: "", startAt, endAt, timezone: effectiveTimeZone, allDay: true });
  }

  function openExistingEvent(id: string) {
    const event = events.find((e) => e.id === id);
    if (!event) return;
    setDialogIsNew(false);
    setDialogDraft(event);
  }

  function jumpToDay(dateKeyStr: string) {
    const [y, m, d] = dateKeyStr.split("-").map(Number);
    setAnchor(new Date(y!, m! - 1, d!));
    setView("day");
    setSidebarOpen(false);
  }

  function jumpToEvent(event: EventRecord) {
    const [y, m, d] = dayKey(event.startAt, timeZone).split("-").map(Number);
    setAnchor(new Date(y!, m! - 1, d!));
    setView("day");
    setSidebarOpen(false);
    setDialogIsNew(false);
    setDialogDraft(event);
  }

  useRealtimeEvents({ workspaceId, calendarIds: calendars.map((c) => c.id) });
  useReminderNotifier(events, workspaceId);

  function handleSave(draft: EventDraft) {
    setDialogError("");
    const opts = {
      onSuccess: () => { setDialogDraft(null); setDialogError(""); if (cutId) setCutId(null); },
      onError: (e: unknown) => setDialogError(e instanceof Error ? e.message : String(e)),
    };
    if (dialogIsNew) create.mutate(draft, opts);
    else if (draft.id) update.mutate({ ...draft, id: draft.id }, opts);
  }

  function handleDelete() {
    const id = dialogDraft?.id;
    if (!id) return;
    setDialogError("");
    remove.mutate(id, {
      onSuccess: () => {
        setDialogDraft(null);
        setToast({ msg: t("eventDeleted"), undoId: id });
        setTimeout(() => setToast(null), 4000);
      },
      onError: (e: unknown) => setDialogError(e instanceof Error ? e.message : String(e)),
    });
  }

  function handlePrev() {
    if (view === "day") setAnchor((d) => addDays(d, -1, effectiveTimeZone));
    else if (view === "week" || view === "agenda" || view === "notebook") setAnchor((d) => addDays(d, -7, effectiveTimeZone));
    else if (view === "month") setAnchor((d) => addMonths(d, -1, effectiveTimeZone));
    else if (view === "book") setAnchor((d) => addDays(d, -2, effectiveTimeZone));
    else if (view === "year") setAnchor((d) => { const nd = new Date(d); nd.setFullYear(nd.getFullYear() - 1); return nd; });
  }
  function handleNext() {
    if (view === "day") setAnchor((d) => addDays(d, 1, effectiveTimeZone));
    else if (view === "week" || view === "agenda" || view === "notebook") setAnchor((d) => addDays(d, 7, effectiveTimeZone));
    else if (view === "month") setAnchor((d) => addMonths(d, 1, effectiveTimeZone));
    else if (view === "book") setAnchor((d) => addDays(d, 2, effectiveTimeZone));
    else if (view === "year") setAnchor((d) => { const nd = new Date(d); nd.setFullYear(nd.getFullYear() + 1); return nd; });
  }

  const title = (() => {
    const format = (date: Date, options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { ...options, timeZone: effectiveTimeZone }).format(date);
    if (view === "book") {
      return `${format(anchor, { month: "short", day: "numeric", year: "numeric" })} — ${format(addDays(anchor, 1, effectiveTimeZone), { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (view === "year") return format(anchor, { year: "numeric" });
    if (view === "day") return format(anchor, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (view === "month") return format(anchor, { month: "long", year: "numeric" });
    const rangeStart = view === "agenda" ? anchor : startOfWeek(anchor, effectiveTimeZone, weekStart);
    const rangeEnd = view === "agenda" ? addDays(anchor, 29, effectiveTimeZone) : addDays(rangeStart, 6, effectiveTimeZone);
    return `${format(rangeStart, { month: "short", day: "numeric" })} – ${format(rangeEnd, { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  const createDateKey = formatInTimeZone(anchor, effectiveTimeZone, "yyyy-MM-dd");
  const isSaving = create.isPending || update.isPending;

  // ----- context menu helpers -----
  const handleDuplicate = useCallback((id: string) => {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    const nextStart = new Date(new Date(ev.startAt).getTime() + 24*3600*1000).toISOString();
    const nextEnd = new Date(new Date(ev.endAt).getTime() + 24*3600*1000).toISOString();
    create.mutate({ calendarId: ev.calendarId, title: ev.title + " (copy)", description: ev.description, location: ev.location, startAt: nextStart, endAt: nextEnd, timezone: ev.timezone, allDay: ev.allDay });
    setToast({ msg: t("duplicatedTomorrow") }); setTimeout(()=>setToast(null),3000);
  }, [events, create]);

  const handleCopy = useCallback((id: string) => {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    clipboardRef.current = ev;
    setCutId(null);
    setToast({ msg: t("copied") }); setTimeout(()=>setToast(null),1500);
  }, [events]);
  const handleCut = useCallback((id: string) => {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    clipboardRef.current = ev;
    setCutId(id);
    setToast({ msg: t("cutMove") }); setTimeout(()=>setToast(null),1500);
  }, [events]);
  const handlePaste = useCallback((dateKey: string, minutes: number) => {
    const src = clipboardRef.current;
    if (!src) { setToast({ msg: t("nothingToPaste") }); setTimeout(()=>setToast(null),1500); return; }
    const dur = new Date(src.endAt).getTime() - new Date(src.startAt).getTime();
    const startAt = toInstant(dateKey, Math.round(minutes/15)*15, effectiveTimeZone);
    const endAt = new Date(new Date(startAt).getTime() + dur).toISOString();
    if (cutId) {
      moveOrResize.mutate({ id: cutId, startAt, endAt });
      clipboardRef.current = null; setCutId(null);
      setToast({ msg: t("moved") }); setTimeout(()=>setToast(null),1500);
    } else {
      create.mutate({ calendarId: src.calendarId, title: src.title, description: src.description, location: src.location, startAt, endAt, timezone: effectiveTimeZone, allDay: false });
      setToast({ msg: t("pasted") }); setTimeout(()=>setToast(null),1500);
    }
  }, [effectiveTimeZone, cutId, create, moveOrResize]);
  const handleMoveTo = useCallback((id: string, dateKey: string) => {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    // keep same clock time, new civil day
    try {
      const startClock = formatInTimeZone(new Date(ev.startAt), effectiveTimeZone, "HH:mm");
      const [h,m] = startClock.split(":").map(Number);
      const startAt = toInstant(dateKey, (h??0)*60+(m??0), effectiveTimeZone);
      const dur = new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime();
      const endAt = new Date(new Date(startAt).getTime()+dur).toISOString();
      moveOrResize.mutate({ id, startAt, endAt });
    } catch {}
  }, [events, effectiveTimeZone, moveOrResize]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandOpen(o=>!o); return; }
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) {
        if (e.key === "Escape" && dialogDraft) { setDialogDraft(null); setDialogError(""); }
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "Enter" && dialogDraft) handleSave(dialogDraft);
        // Ctrl/Cmd+C/V handled by menu, not intercept
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "t") { e.preventDefault(); setAnchor(new Date()); }
      else if (k === "d") setView("day");
      else if (k === "w") setView("week");
      else if (k === "m") setView("month");
      else if (k === "a") setView("agenda");
      else if (k === "b") setView("book");
      else if (k === "y") setView("year");
      else if (k === "c" || k === "n") { e.preventDefault(); openNewEventAt(createDateKey, 9 * 60); }
      else if (k === "j" || e.key === "ArrowRight") handleNext();
      else if (k === "k" || e.key === "ArrowLeft") handlePrev();
      else if (e.key === "/") { e.preventDefault(); document.getElementById("global-search-input")?.focus(); }
      else if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false);
      else if (e.key === "Escape" && commandOpen) setCommandOpen(false);
      else if (e.key === "Escape" && ctx) setCtx(null);
      else if (e.key === "Escape" && showDatePicker) setShowDatePicker(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogDraft, sidebarOpen, createDateKey, view, commandOpen, ctx, showDatePicker]);

  const eventsByDate = useMemo(() => {
    const s = new Set<string>();
    for (const e of events) {
      const sk = dayKey(e.startAt, timeZone);
      const ek = dayKey(e.endAt, timeZone);
      s.add(sk);
      if (sk !== ek) {
        let cur = sk;
        for (let i = 0; i < 30; i++) {
          if (cur >= ek) break;
          const d = new Date(cur + "T12:00:00");
          d.setDate(d.getDate() + 1);
          cur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          if (cur <= ek) s.add(cur);
          else break;
        }
      }
    }
    return s;
  }, [events, timeZone]);

  const selectedRange: [string, string] = useMemo(() => {
    if (view === "week") {
      const m = mondayOf(anchor, timeZone);
      const ms = formatInTimeZone(m, timeZone, "yyyy-MM-dd");
      const es = formatInTimeZone(addDays(m, 6, timeZone), timeZone, "yyyy-MM-dd");
      return [ms, es];
    }
    if (view === "book") {
      const a = formatInTimeZone(anchor, timeZone, "yyyy-MM-dd");
      const b = formatInTimeZone(addDays(anchor, 1, timeZone), timeZone, "yyyy-MM-dd");
      return [a, b];
    }
    const k = formatInTimeZone(anchor, timeZone, "yyyy-MM-dd");
    return [k, k];
  }, [view, anchor, timeZone]);

  // swipe for main (day/week quick page turn)
  const swipeRef = useRef<{ x: number } | null>(null);
  function onMainPointerDown(e: React.PointerEvent) {
    if (view === "book" || view === "month" || view === "year") return;
    swipeRef.current = { x: e.clientX };
  }
  function onMainPointerUp(e: React.PointerEvent) {
    if (!swipeRef.current) return;
    const dx = e.clientX - swipeRef.current.x;
    swipeRef.current = null;
    if (Math.abs(dx) < 60) return;
    if (dx < 0) handleNext(); else handlePrev();
  }

  const commands: Command[] = useMemo(() => [
    { id: "create", label: t("newEvent"), hint: "N", icon: <PlusIcon size={14} />, action: () => openNewEventAt(createDateKey, 9*60), keywords: ["new"] },
    { id: "today", label: t("goToToday"), hint: "T", icon: <HomeIcon size={14} />, action: () => setAnchor(new Date()) },
    { id: "jump", label: t("jumpToDate"), icon: <CalendarMarkIcon size={14} />, action: () => setShowDatePicker(true) },
    { id: "search", label: t("search"), hint: "/", icon: <SearchIcon size={14} />, action: () => document.getElementById("global-search-input")?.focus() },
    { id: "day", label: t("day"), hint: "D", icon: <DayViewIcon size={14} />, action: () => setView("day") },
    { id: "week", label: t("week"), hint: "W", icon: <WeekViewIcon size={14} />, action: () => setView("week") },
    { id: "month", label: t("month"), hint: "M", icon: <MonthViewIcon size={14} />, action: () => setView("month") },
    { id: "agenda", label: t("agenda"), hint: "A", icon: <AgendaViewIcon size={14} />, action: () => setView("agenda") },
    { id: "book", label: t("book"), hint: "B", icon: <BookIcon size={14} />, action: () => setView("book") },
    { id: "year", label: t("year"), hint: "Y", icon: <YearViewIcon size={14} />, action: () => setView("year") },
    { id: "print", label: t("print") + "…", icon: <PrintIcon size={14} />, action: () => setPrintOpen(true) },
    { id: "settings", label: t("settings"), icon: <SettingsIcon size={14} />, action: () => setSettingsOpen(true) },
  ], [createDateKey, lang, t]);

  return (
    <div className="app">
      <header className="top">
        <button className="icon" id="menu" aria-label={t("toggleSidebar")} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((v) => !v)}><MenuIcon /></button>
        <div className="brand"><span className="mark" />Tempo</div>
        <button className="btn today-btn" onClick={() => setAnchor(new Date())}>{t("today")}</button>
        <button className="btn m-today" onClick={() => setAnchor(new Date())}>{t("today")}</button>
        <div className="nav">
          <button className="icon" aria-label={t("previous")} onClick={handlePrev}><ChevronLeftIcon /></button>
          <button className="icon" aria-label={t("next")} onClick={handleNext}><ChevronRightIcon /></button>
        </div>
        <h1 id="title" aria-live="polite" onClick={() => setShowDatePicker(true)} style={{ cursor:"pointer" }} title={t("jumpToDate")}>{title}</h1>
        <div style={{ flex: 1 }} />
        <GlobalSearch
          value={searchInput}
          onChange={setSearchInput}
          workspaceId={workspaceId}
          calendarIds={visibleCalendars}
          calendars={calendars}
          timeZone={timeZone}
          onJumpToDay={jumpToDay}
          onJumpToEvent={jumpToEvent}
        />
        <NotificationCenter workspaceId={workspaceId} />
        <button className="icon" aria-label={t("commandPaletteTitle")} title={t("commandPaletteHint")} onClick={() => setCommandOpen(true)}><CommandIcon size={18} /></button>
        <button className="icon" aria-label={t("aiAssistant")} title={t("aiAssistant")} onClick={() => setAiChatOpen(true)} style={{ color: "var(--accent)" }}><SparklesIcon size={18} /></button>
        <div className="seg" role="group" aria-label={t("view")}>
          {([
            ["day", DayViewIcon], ["week", WeekViewIcon], ["month", MonthViewIcon], ["agenda", AgendaViewIcon], ["book", BookIcon], ["year", YearViewIcon], ["notebook", BookIcon],
          ] as const).map(([v, Icon]) => (
            <button key={v} data-view={v} aria-pressed={view === v} onClick={() => setView(v as CalendarView)} title={t(v)}>
              <Icon size={14} /> {t(v)}
            </button>
          ))}
        </div>
        <div aria-label={t("language")} style={{ display: "inline-flex", alignItems: "center", gap: 2, border: "1px solid var(--line)", borderRadius: 10, padding: 2, background: "var(--surface)" }}>
          <button className="btn ghost" onClick={() => setLang("en")} aria-pressed={lang === "en"} style={{ height: 30, minWidth: 34, padding: "0 7px", fontSize: 10, fontWeight: 800, color: lang === "en" ? "var(--accent)" : "var(--muted)" }}>{t("englishShort")}</button>
          <button className="btn ghost" onClick={() => setLang("fr")} aria-pressed={lang === "fr"} style={{ height: 30, minWidth: 34, padding: "0 7px", fontSize: 10, fontWeight: 800, color: lang === "fr" ? "var(--accent)" : "var(--muted)" }}>{t("frenchShort")}</button>
        </div>
        <button className="icon" aria-label={t("print")} title={t("print")} onClick={() => setPrintOpen(true)}><PrintIcon /></button>
        <button className="icon" aria-label={t("settings")} title={t("settings")} onClick={() => setSettingsOpen(true)}><SettingsIcon /></button>
        <button className="btn primary" onClick={() => openNewEventAt(createDateKey, 9 * 60)} disabled={!calendars.length} title={!calendars.length ? t("createEventFirst") : undefined} style={{ opacity: !calendars.length ? 0.5 : 1 }}><PlusIcon size={16} /> {t("create")}</button>
      </header>

      <div className="body">
        <aside className={`side${sidebarOpen ? " open" : ""}`} id="side" aria-label={t("toggleSidebar")}>
          <button className="create" onClick={() => { setSidebarOpen(false); openNewEventAt(createDateKey, 9 * 60); }} disabled={!calendars.length} title={!calendars.length ? t("createEventFirst") : undefined} style={{ opacity: !calendars.length ? 0.5 : 1 }}><PlusIcon size={20} />{t("create")}</button>
          <RealtimeClock timeZone={effectiveTimeZone} />
          <MiniCalendar
            anchor={miniAnchor}
            timeZone={effectiveTimeZone}
            weekStart={weekStart}
            eventsByDate={eventsByDate}
            onSelect={(iso) => { const [y, m, d] = iso.split("-").map(Number); setAnchor(new Date(y!, m! - 1, d!)); setSidebarOpen(false); }}
            onPrev={() => setMiniAnchor((d) => addMonths(d, -1, effectiveTimeZone))}
            onNext={() => setMiniAnchor((d) => addMonths(d, 1, effectiveTimeZone))}
            selectedRange={selectedRange}
          />
          <UpNext events={events} calendars={calendars} timeZone={effectiveTimeZone} />
          <PomodoroTimer />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <h2 style={{ margin: 0 }}>{t("myCalendars")}</h2>
            <button
              className="btn ghost"
              onClick={() => setResetConfirmOpen(true)}
              disabled={!allDayCount || resetAllDay.isPending}
              title={allDayCount ? t("resetAllDayEvents") : t("noAllDayEvents")}
              style={{ height: 28, padding: "0 8px", fontSize: 11, opacity: !allDayCount ? 0.5 : 1, gap: 4 }}
            >
              <TrashIcon size={12} /> {t("resetAllDay")}
            </button>
          </div>
          {calError && <p style={{ fontSize: 12, color: "var(--now)" }}>{t("calendarsFailed")}</p>}
          {calLoading && <p style={{ fontSize: 12, color: "var(--muted)" }}>{t("loadingCalendars")}</p>}
          {!calLoading && !calError && calendars.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>{t("noCalendarsCreateFirst")}</p>}
          <div id="cals">
            {calendars.map((cal) => (
              <button
                key={cal.id}
                className="calrow"
                data-cal={cal.id}
                aria-pressed={visibleCalendars.includes(cal.id)}
                style={{ ["--c" as string]: cal.color } as unknown as React.CSSProperties}
                onClick={() =>
                  setVisibleCalendars((ids) =>
                    ids.includes(cal.id) ? ids.filter((id) => id !== cal.id) : [...ids, cal.id]
                  )
                }
              >
                <span className="cb" />{cal.name}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <button className="calrow" onClick={() => setPrintOpen(true)} style={{ ["--c" as string]: "var(--muted)" } as unknown as React.CSSProperties}>
              <span className="cb" style={{ display: "grid", placeItems: "center", borderColor: "var(--muted)" }}><PrintIcon size={12} /></span> {t("print")}…
            </button>
            <button className="calrow" onClick={() => setSettingsOpen(true)} style={{ ["--c" as string]: "var(--muted)" } as unknown as React.CSSProperties}>
              <span className="cb" style={{ display: "grid", placeItems: "center", borderColor: "var(--muted)" }}><SettingsIcon size={12} /></span> {t("settings")}
            </button>
          </div>
        </aside>
        <div className={`backdrop${sidebarOpen ? " open" : ""}`} id="backdrop" onClick={() => setSidebarOpen(false)} />

        <main id="main" onPointerDown={onMainPointerDown} onPointerUp={onMainPointerUp}>
          {isError && <p role="alert" style={{ padding: 16 }}>{t("couldNotLoadEvents")}</p>}
          {isLoading ? (
            <p style={{ padding: 16, color: "var(--muted)" }}>{t("loading")}</p>
          ) : view === "month" ? (
            <MonthView anchor={anchor} events={events} calendars={calendars} timeZone={effectiveTimeZone} weekStart={weekStart} onSelectEvent={openExistingEvent} onCreateAt={openNewEventAt} onEventContextMenu={(e,id)=>setCtx({x:e.clientX,y:e.clientY,kind:"event",eventId:id})} onEmptyContextMenu={(e,k,mins)=>setCtx({x:e.clientX,y:e.clientY,kind:"empty",dateKey:k,minutes:mins})} />
          ) : view === "agenda" ? (
            <AgendaView events={events} calendars={calendars} timeZone={effectiveTimeZone} onSelectEvent={openExistingEvent} anchor={anchor} onEventContextMenu={(e,id)=>setCtx({x:e.clientX,y:e.clientY,kind:"event",eventId:id})} onEmptyContextMenu={(e,k,mins)=>setCtx({x:e.clientX,y:e.clientY,kind:"empty",dateKey:k,minutes:mins})} />
          ) : view === "book" ? (
            <BookView anchor={anchor} events={events} calendars={calendars} timeZone={effectiveTimeZone} onSelectEvent={openExistingEvent} onCreateAt={openNewEventAt} onPrev={handlePrev} onNext={handleNext} onGoToday={()=>setAnchor(new Date())} onJumpToDate={(iso)=>jumpToDay(iso)} />
          ) : view === "year" ? (
            <YearView anchor={anchor} events={events} calendars={calendars} timeZone={effectiveTimeZone} onSelectDate={(iso)=>{jumpToDay(iso); setView("day");}} />
          ) : view === "notebook" ? (
            <NotebookView days={days} events={events} calendars={calendars} timeZone={effectiveTimeZone} timeFormat={settings.timeFormat} workspaceId={workspaceId} onSelectEvent={openExistingEvent} />

          ) : (
            <TimeGrid
              days={days}
              events={events}
              calendars={calendars}
              timeZone={effectiveTimeZone}
              onSelectEvent={openExistingEvent}
              onCreateAt={openNewEventAt}
              onMoveOrResize={(id, startAt, endAt) => moveOrResize.mutate({ id, startAt, endAt })}
              onSelectDay={(iso) => { const [y, m, d] = iso.split("-").map(Number); setAnchor(new Date(y!, m! - 1, d!)); setView("day"); }}
              onEventContextMenu={(e,id)=>setCtx({x:e.clientX,y:e.clientY,kind:"event",eventId:id})}
              onEmptyContextMenu={(e,k,mins)=>setCtx({x:e.clientX,y:e.clientY,kind:"empty",dateKey:k,minutes:mins})}
            />
          )}
        </main>
      </div>

      <nav className="tabs" id="tabs" aria-label={t("view")}>
        {(["day", "week", "month", "agenda", "book", "year", "notebook"] as const).map((v) => {
          const Icon = v === "day" ? DayViewIcon : v === "week" ? WeekViewIcon : v === "month" ? MonthViewIcon : v === "agenda" ? AgendaViewIcon : v === "book" ? BookIcon : v === "year" ? YearViewIcon : BookIcon;
          return (
            <button key={v} data-view={v} aria-pressed={view === v} onClick={() => setView(v as CalendarView)}>
              <Icon size={16} />{t(v)}
            </button>
          );
        })}
      </nav>
      <button className="fab" id="fab" aria-label={t("createEvent")} onClick={() => openNewEventAt(createDateKey, 9 * 60)} disabled={!calendars.length} style={{ opacity: !calendars.length ? 0.5 : 1 }}><PlusIcon size={22} /></button>

      <EventDialog
        open={dialogDraft !== null}
        draft={dialogDraft}
        calendars={calendars}
        isNew={dialogIsNew}
        onClose={() => { if (!isSaving) { setDialogDraft(null); setDialogError(""); } }}
        onSave={handleSave}
        onDelete={handleDelete}
        isSaving={isSaving || remove.isPending}
        externalError={dialogError}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} calendars={calendars} />
      <PrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        workspaceId={workspaceId}
        calendars={calendars}
        visibleCalendars={visibleCalendars}
        timeZone={timeZone}
        anchor={anchor}
      />
      <AiChat open={aiChatOpen} onClose={() => setAiChatOpen(false)} />

      {showDatePicker && (
        <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowDatePicker(false); }}>
          <div className="dlg" style={{ maxWidth: 320 }} role="dialog" aria-modal="true" aria-label={t("jumpToDate")}>
            <h2 style={{ margin:"0 0 10px", font:"700 16px var(--font-display)" }}>{t("jumpToDateTitle")}</h2>
            <input type="date" value={formatInTimeZone(anchor, effectiveTimeZone, "yyyy-MM-dd")} onChange={(e)=>{ if(e.target.value) {jumpToDay(e.target.value); setShowDatePicker(false);} }} style={{ width:"100%", border:"1px solid var(--line)", borderRadius:10, padding:"10px", background:"var(--bg)", color:"var(--ink)" }} />
            <div className="acts" style={{ marginTop:12 }}>
              <button className="btn ghost" onClick={()=>{ setAnchor(new Date()); setShowDatePicker(false); }}>{t("today")}</button>
              <span style={{flex:1}}/>
              <button className="btn" onClick={()=>setShowDatePicker(false)}>{t("close")}</button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={commandOpen} onClose={()=>setCommandOpen(false)} commands={commands} />

      {ctx && ctx.kind === "event" && (() => {
        const ev = events.find(e=>e.id===ctx.eventId);
        if (!ev) return null;
        const tomorrowKey = formatInTimeZone(addDays(new Date(),1,effectiveTimeZone), effectiveTimeZone, "yyyy-MM-dd");
        // next Monday
        const now = new Date();
        const dow = now.getDay(); // 0 Sun
        const daysUntilMon = (8 - dow) % 7 || 7;
        const nextMonKey = formatInTimeZone(addDays(now, daysUntilMon, effectiveTimeZone), effectiveTimeZone, "yyyy-MM-dd");
        return (
          <ContextMenu x={ctx.x} y={ctx.y} onClose={()=>setCtx(null)} sections={[
            { items: [
              { label:t("edit"), icon:<EditIcon size={14} />, action:()=>openExistingEvent(ctx.eventId) },
              { label:t("duplicate"), icon:<DuplicateIcon size={14} />, action:()=>handleDuplicate(ctx.eventId) },
            ]},
            { items: [
              { label:t("copy"), icon:<CopyIcon size={14} />, action:()=>handleCopy(ctx.eventId) },
              { label: cutId===ctx.eventId ? t("cutActive") : t("cut"), icon:<CutIcon size={14} />, action:()=>handleCut(ctx.eventId) },
            ]},
            { items: [
              { label:t("moveToTomorrow"), icon:<CalendarMarkIcon size={14} />, action:()=>handleMoveTo(ctx.eventId, tomorrowKey) },
              { label:t("moveToNextMonday"), icon:<CalendarMarkIcon size={14} />, action:()=>handleMoveTo(ctx.eventId, nextMonKey) },
              { label:t("moveToDate"), icon:<CalendarMarkIcon size={14} />, action:()=>{ setShowDatePicker(true);
                setToast({msg:t("moveDateHint")}); setTimeout(()=>setToast(null),3000);
              } },
            ]},
            { items: [
              { label:t("changeCalendar"), icon:<BookIcon size={14} />, action:()=>{
                const idx = calendars.findIndex(c=>c.id===ev.calendarId);
                const next = calendars[(idx+1)%calendars.length];
                if (next) update.mutate({ ...ev, calendarId: next.id, id: ev.id });
              }},
            ]},
            { items: [
              { label:t("delete"), icon:<TrashIcon size={14} />, danger:true, action:()=>remove.mutate(ctx.eventId) },
            ]},
          ]} />
        );
      })()}

      {ctx && ctx.kind === "empty" && (
        <ContextMenu x={ctx.x} y={ctx.y} onClose={()=>setCtx(null)} sections={[
          { items: [
            { label:t("newEvent"), icon:<PlusIcon size={14} />, action:()=>openNewEventAt(ctx.dateKey, ctx.minutes) },
            { label:t("newAllDayEvent"), icon:<CalendarMarkIcon size={14} />, action:()=>openNewAllDayAt(ctx.dateKey) },
            { label:t("paste"), icon:<PasteIcon size={14} />, disabled: !clipboardRef.current, action:()=>handlePaste(ctx.dateKey, ctx.minutes) },
          ]},
          { items: [
            { label:t("goToToday"), icon:<HomeIcon size={14} />, action:()=>setAnchor(new Date()) },
            { label:t("goToDate"), icon:<CalendarMarkIcon size={14} />, action:()=>setShowDatePicker(true) },
          ]},
          { items: [
            { label:t("changeViewDay"), icon:<EyeIcon size={14} />, action:()=>setView("day") },
            { label:t("changeViewWeek"), icon:<EyeIcon size={14} />, action:()=>setView("week") },
            { label:t("changeViewBook"), icon:<BookIcon size={14} />, action:()=>setView("book") },
          ]},
        ]} />
      )}

      {resetConfirmOpen && (
        <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) setResetConfirmOpen(false); }}>
          <div className="dlg" role="dialog" aria-modal="true" aria-label={t("resetAllDayEvents")}>
            <h2 style={{ margin: "0 0 8px", font: "700 18px var(--font-display)" }}>{t("resetAllDayEventsQuestion")}</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.4 }}>
              {allDayCount
                ? t("resetDescription", { count: allDayCount, suffix: visibleCalendars.length ? " (filtered calendars)" : "" })
                : t("noEventsToReset")}
            </p>
            <div className="acts" style={{ marginTop: 16 }}>
              <span style={{ flex: 1 }} />
              <button className="btn ghost" onClick={() => setResetConfirmOpen(false)}>{t("cancel")}</button>
              <button
                className="btn danger"
                disabled={!allDayCount || resetAllDay.isPending}
                onClick={() => {
                  setResetConfirmOpen(false);
                  resetAllDay.mutate();
                }}
              >
                {resetAllDay.isPending ? t("reset") + "…" : t("reset")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" aria-live="polite" className="toast">
          <span>{toast.msg}</span>
          {toast.undoId === "bulk-all-day" && lastReset ? (
            <button
              onClick={() => {
                restoreBulk.mutate(lastReset.ids);
                setToast(null);
              }}
            >
              Undo
            </button>
          ) : toast.undoId ? (
            <button onClick={() => { restore.mutate(toast.undoId!); setToast(null); }}>{t("undo")}</button>
          ) : null}
        </div>
      )}
    </div>
  );
}
