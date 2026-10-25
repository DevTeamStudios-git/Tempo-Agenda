"use client";
/**
 * Orchestrator — wires navigation state, server data (useCalendarEvents/useCalendars),
 * and the view components together. Implements Notebook v2/v3 corrections plus
 * prototype chrome parity (brand, mini calendar, UpNext, all-day row, tabs/FAB, keyboard).
 * Extended with Book, Year, Context Menus, Command Palette, DatePicker per AGENDAspec.
 */
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { addDays, addMonths, mondayOf, startOfWeek, titleForView, toInstant } from "@/lib/dates/date-utils";
import { useCalendarEvents, useEventMutations } from "../hooks/useCalendarEvents";
import { useCalendars } from "../hooks/useCalendars";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { PlanningDialog } from "@/features/planning/components/PlanningDialog";
import { TasksDialog } from "@/features/tasks/components/TasksDialog";
import type { TaskRecord } from "@/server/services/task-service";
import { DataDialog } from "@/features/data/components/DataDialog";
import { PrintDialog } from "@/features/print/components/PrintDialog";
import {useDialogFocus} from "@/lib/use-dialog-focus";
import {CalendarManager} from "./CalendarManager";
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

export function CalendarShell(props: { workspaceId: string; timeZone: string }) {
  return <CalendarShellInner {...props} />;
}

function CalendarShellInner({ workspaceId, timeZone }: { workspaceId: string; timeZone: string }) {
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [miniAnchor, setMiniAnchor] = useState(new Date());
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [visibleCalendars, setVisibleCalendars] = useState<string[]>([]);
  const [dialogDraft, setDialogDraft] = useState<EventDraft | null>(null);
  const [dialogIsNew, setDialogIsNew] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [toast, setToast] = useState<{ msg: string; undoId?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [planningOpen,setPlanningOpen]=useState(false);
  const [tasksOpen,setTasksOpen]=useState(false);
  const [showTasks,setShowTasks]=useState(true);
  const [dataOpen,setDataOpen]=useState(false);
  const [calendarsOpen,setCalendarsOpen]=useState(false);
  const calendarsDialogRef=useRef<HTMLDivElement>(null);
  useDialogFocus(calendarsOpen,calendarsDialogRef,()=>setCalendarsOpen(false));
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
  const calendars:CalendarSummary[]=serverCalendars?.filter(c=>!c.isArchived)??[];
  const knownCalendarIds=useRef<string[]|null>(null);
  useEffect(()=>{
    if(!serverCalendars)return;
    const active=serverCalendars.filter(c=>!c.isArchived).map(c=>c.id);
    const previous=knownCalendarIds.current;
    setVisibleCalendars(old=>previous===null?active:[...new Set([...old.filter(id=>active.includes(id)),...active.filter(id=>!previous.includes(id))])]);
    knownCalendarIds.current=active;
  },[serverCalendars]);

  useEffect(() => {
    setMiniAnchor(new Date(toInstant(formatInTimeZone(anchor,effectiveTimeZone,"yyyy-MM")+"-01",12,effectiveTimeZone)));
  }, [anchor,effectiveTimeZone]);

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
      const monthStart = new Date(toInstant(formatInTimeZone(anchor,effectiveTimeZone,"yyyy-MM")+"-01",0,effectiveTimeZone));
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
      const y = Number(formatInTimeZone(anchor,effectiveTimeZone,"yyyy"));
      const s = new Date(toInstant(`${y}-01-01`,0,effectiveTimeZone));
      const e = new Date(toInstant(`${y+1}-01-01`,0,effectiveTimeZone));
      return { rangeStart: s, rangeEnd: e };
    }
    return { rangeStart: days[0]!, rangeEnd: addDays(days[days.length - 1]!, 1, effectiveTimeZone) };
  }, [view, days, anchor, effectiveTimeZone, weekStart]);

  const rangeArgs = { workspaceId, calendarIds: visibleCalendars, rangeStart, rangeEnd, q: debouncedQ || undefined };
  const { data: calendarEvents = [], isLoading, isError } = useCalendarEvents(rangeArgs);
  const {data:tasks=[]}=useQuery<TaskRecord[]>({queryKey:["tasks",workspaceId],queryFn:async()=>{const r=await fetch(`/api/tasks?workspaceId=${workspaceId}`);if(!r.ok)throw new Error("Could not load tasks");return (await r.json()).tasks;}});
  const events:EventRecord[]=useMemo(()=>{
    const scheduled:EventRecord[]=showTasks?tasks.filter(t=>!t.completedAt&&(t.startAt||t.dueAt)).map(t=>({id:"task:"+t.id,calendarId:"tasks",title:"☐ "+t.title,description:t.notes,location:"",startAt:t.startAt??t.dueAt!,endAt:t.endAt??t.dueAt!,timezone:effectiveTimeZone,allDay:!t.startAt,status:"confirmed",labels:[],color:"#137333",availability:"busy"})):[];
    return [...calendarEvents,...scheduled].filter(e=>Date.parse(e.startAt)<+rangeEnd&&(Date.parse(e.endAt)>+rangeStart||(e.allDay&&Date.parse(e.endAt)>=+rangeStart))).filter(e=>(settings.showPastEvents||Date.parse(e.endAt)>=Date.now())&&(!debouncedQ||[e.title,e.description,e.location].join(" ").toLowerCase().includes(debouncedQ.toLowerCase())));
  },[calendarEvents,tasks,showTasks,effectiveTimeZone,settings.showPastEvents,debouncedQ,rangeStart,rangeEnd]);
  const { create, update, moveOrResize, remove, restore } = useEventMutations(rangeArgs);
  const queryClient = useQueryClient();
  const allDayCount = calendarEvents.filter((e) => e.allDay).length;
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
        setToast({ msg: "No all-day events to reset." });
        setTimeout(() => setToast(null), 2500);
        return;
      }
      setLastReset({ ids: data.ids, count: data.count });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setToast({ msg: `Reset ${data.count} all-day event(s).`, undoId: "bulk-all-day" });
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
      setToast({ msg: "Restored all-day events." });
      setTimeout(() => setToast(null), 3000);
    },
  });

  function openNewEventAt(dateKey: string, minutes: number) {
    const preferred = settings.defaultCalendarId && calendars.some((c) => c.id === settings.defaultCalendarId) ? settings.defaultCalendarId : null;
    const targetCal = preferred ?? visibleCalendars[0] ?? calendars[0]?.id;
    if (!targetCal) {
      setToast({ msg: "Create a calendar first — then add events." });
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
    const endAt = startAt;
    setDialogIsNew(true);
    setDialogDraft({ calendarId: targetCal, title: "", description: "", location: "", startAt, endAt, timezone: effectiveTimeZone, allDay: true });
  }

  function openExistingEvent(id: string) {
    if(id.startsWith("task:")){setTasksOpen(true);return;}
    const event = events.find((e) => e.id === id);
    if (!event) return;
    setDialogIsNew(false);
    setDialogDraft(event);
  }

  function jumpToDay(dateKeyStr: string) {
    const [y, m, d] = dateKeyStr.split("-").map(Number);
    setAnchor(new Date(toInstant(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`,12,effectiveTimeZone)));
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

  function handleDelete(scope: "this" | "following" | "series" = "this") {
    const id = dialogDraft?.id;
    if (!id) return;
    setDialogError("");
    remove.mutate(id + "?scope=" + scope, {
      onSuccess: () => {
        setDialogDraft(null);
        setToast({ msg: "Event deleted.", undoId: id.includes("~") ? undefined : id });
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
    if (view === "book") {
      const a = formatInTimeZone(anchor, effectiveTimeZone, "MMM d, yyyy");
      const b = formatInTimeZone(addDays(anchor, 1, effectiveTimeZone), effectiveTimeZone, "MMM d, yyyy");
      return `${a} — ${b}`;
    }
    if (view === "year") return formatInTimeZone(anchor, effectiveTimeZone, "yyyy");
    if (view === "notebook") return titleForView(anchor, "week", effectiveTimeZone, weekStart);
    return titleForView(anchor, view as any, effectiveTimeZone, weekStart);
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
    setToast({ msg: "Duplicated to tomorrow." }); setTimeout(()=>setToast(null),3000);
  }, [events, create]);

  const handleCopy = useCallback((id: string) => {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    clipboardRef.current = ev;
    setCutId(null);
    setToast({ msg: "Copied." }); setTimeout(()=>setToast(null),1500);
  }, [events]);
  const handleCut = useCallback((id: string) => {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    clipboardRef.current = ev;
    setCutId(id);
    setToast({ msg: "Cut — paste to move." }); setTimeout(()=>setToast(null),1500);
  }, [events]);
  const handlePaste = useCallback((dateKey: string, minutes: number) => {
    const src = clipboardRef.current;
    if (!src) { setToast({ msg: "Nothing to paste." }); setTimeout(()=>setToast(null),1500); return; }
    const dur = new Date(src.endAt).getTime() - new Date(src.startAt).getTime();
    const startAt = toInstant(dateKey, Math.round(minutes/15)*15, effectiveTimeZone);
    const endAt = new Date(new Date(startAt).getTime() + dur).toISOString();
    if (cutId) {
      moveOrResize.mutate({ id: cutId, startAt, endAt });
      clipboardRef.current = null; setCutId(null);
      setToast({ msg: "Moved." }); setTimeout(()=>setToast(null),1500);
    } else {
      create.mutate({ calendarId: src.calendarId, title: src.title, description: src.description, location: src.location, startAt, endAt, timezone: effectiveTimeZone, allDay: false });
      setToast({ msg: "Pasted." }); setTimeout(()=>setToast(null),1500);
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

  const keyboardHandlers=useRef({handleNext,handlePrev,handleSave,openNewEventAt});
  keyboardHandlers.current={handleNext,handlePrev,handleSave,openNewEventAt};
  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if(e.defaultPrevented || (e.target as HTMLElement)?.closest?.('[role="dialog"]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandOpen(o=>!o); return; }
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) {
        if (e.key === "Escape" && dialogDraft) { setDialogDraft(null); setDialogError(""); }
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "Enter" && dialogDraft) keyboardHandlers.current.handleSave(dialogDraft);
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
      else if (k === "c" || k === "n") { e.preventDefault(); keyboardHandlers.current.openNewEventAt(createDateKey, 9 * 60); }
      else if (k === "j" || e.key === "ArrowRight") keyboardHandlers.current.handleNext();
      else if (k === "k" || e.key === "ArrowLeft") keyboardHandlers.current.handlePrev();
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
      const sk = dayKey(e.startAt, effectiveTimeZone);
      const ek = dayKey(e.endAt, effectiveTimeZone);
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
  }, [events, effectiveTimeZone]);

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
    if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("button,input,textarea,.ev") || view === "book" || view === "month" || view === "year") return;
    swipeRef.current = { x: e.clientX };
  }
  function onMainPointerUp(e: React.PointerEvent) {
    if (!swipeRef.current) return;
    const dx = e.clientX - swipeRef.current.x;
    swipeRef.current = null;
    if (Math.abs(dx) < 60) return;
    if (dx < 0) handleNext(); else handlePrev();
  }

  const commands: Command[] = [
    { id: "create", label: "Create event", hint: "N", icon: <PlusIcon size={14} />, action: () => openNewEventAt(createDateKey, 9*60), keywords: ["new"] },
    { id: "today", label: "Go to today", hint: "T", icon: <HomeIcon size={14} />, action: () => setAnchor(new Date()) },
    { id: "jump", label: "Jump to date…", icon: <CalendarMarkIcon size={14} />, action: () => setShowDatePicker(true) },
    { id: "search", label: "Search events", hint: "/", icon: <SearchIcon size={14} />, action: () => document.getElementById("global-search-input")?.focus() },
    { id: "day", label: "Switch to Day", hint: "D", icon: <DayViewIcon size={14} />, action: () => setView("day") },
    { id: "week", label: "Switch to Week", hint: "W", icon: <WeekViewIcon size={14} />, action: () => setView("week") },
    { id: "month", label: "Switch to Month", hint: "M", icon: <MonthViewIcon size={14} />, action: () => setView("month") },
    { id: "agenda", label: "Switch to Agenda", hint: "A", icon: <AgendaViewIcon size={14} />, action: () => setView("agenda") },
    { id: "book", label: "Switch to Book", hint: "B", icon: <BookIcon size={14} />, action: () => setView("book") },
    { id: "year", label: "Switch to Year", hint: "Y", icon: <YearViewIcon size={14} />, action: () => setView("year") },
    { id: "print", label: "Print…", icon: <PrintIcon size={14} />, action: () => setPrintOpen(true) },
    { id: "settings", label: "Settings", icon: <SettingsIcon size={14} />, action: () => setSettingsOpen(true) },
  ];

  return (
    <div className="app" data-density={settings.density}>
      <header className="top">
        <button className="icon" id="menu" aria-label="Toggle sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((v) => !v)}><MenuIcon /></button>
        <div className="brand"><span className="mark" />Tempo</div>
        <button className="btn today-btn" onClick={() => setAnchor(new Date())}>Today</button>
        <button className="btn m-today" onClick={() => setAnchor(new Date())}>Today</button>
        <div className="nav">
          <button className="icon" aria-label="Previous" onClick={handlePrev}><ChevronLeftIcon /></button>
          <button className="icon" aria-label="Next" onClick={handleNext}><ChevronRightIcon /></button>
        </div>
        <h1 id="title" aria-live="polite" onClick={() => setShowDatePicker(true)} style={{ cursor:"pointer" }} title="Jump to date">{title}</h1>
        <div style={{ flex: 1 }} />
        <GlobalSearch
          value={searchInput}
          onChange={setSearchInput}
          workspaceId={workspaceId}
          calendarIds={visibleCalendars}
          calendars={calendars}
          timeZone={effectiveTimeZone}
          onJumpToDay={jumpToDay}
          onJumpToEvent={jumpToEvent}
        />
        <NotificationCenter workspaceId={workspaceId} />
        <button className="icon" aria-label="Command palette" title="Command palette (Ctrl+K)" onClick={() => setCommandOpen(true)}><CommandIcon size={18} /></button>
        <button className="icon" aria-label="AI Assistant" title="AI Assistant" onClick={() => setAiChatOpen(true)} style={{ color: "var(--accent)" }}><SparklesIcon size={18} /></button>
        <div className="seg" role="group" aria-label="View">
          {([
            ["day", DayViewIcon], ["week", WeekViewIcon], ["month", MonthViewIcon], ["agenda", AgendaViewIcon], ["book", BookIcon], ["year", YearViewIcon], ["notebook", BookIcon],
          ] as const).map(([v, Icon]) => (
            <button key={v} data-view={v} aria-pressed={view === v} onClick={() => setView(v as CalendarView)} title={v}>
              <Icon size={14} /> {v[0]!.toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <button className="icon" aria-label="Print" title="Print" onClick={() => setPrintOpen(true)}><PrintIcon /></button>
        <button className="icon" aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)}><SettingsIcon /></button>
        <button className="btn primary" onClick={() => openNewEventAt(createDateKey, 9 * 60)} disabled={!calendars.length} title={!calendars.length ? "Create a calendar first" : undefined} style={{ opacity: !calendars.length ? 0.5 : 1 }}><PlusIcon size={16} /> Create</button>
      </header>

      <div className="body">
        <aside className={`side${sidebarOpen ? " open" : ""}`} id="side" aria-label="Sidebar">
          <button className="create" onClick={() => { setSidebarOpen(false); openNewEventAt(createDateKey, 9 * 60); }} disabled={!calendars.length} title={!calendars.length ? "Create a calendar first" : undefined} style={{ opacity: !calendars.length ? 0.5 : 1 }}><PlusIcon size={20} />Create</button>
          <RealtimeClock timeZone={effectiveTimeZone} />
          <MiniCalendar
            anchor={miniAnchor}
            timeZone={effectiveTimeZone}
            weekStart={weekStart}
            eventsByDate={eventsByDate}
            onSelect={(iso) => { const [y, m, d] = iso.split("-").map(Number); setAnchor(new Date(y!, m! - 1, d!)); setSidebarOpen(false); }}
            onPrev={() => setMiniAnchor((d) => addMonths(d, -1, effectiveTimeZone))}
            onNext={() => setMiniAnchor((d) => addMonths(d, 1, effectiveTimeZone))}
            selectedDateKey={dayKey(anchor.toISOString(),effectiveTimeZone)}
            selectedRange={selectedRange}
          />
          <UpNext events={events} calendars={calendars} timeZone={effectiveTimeZone} />
          <PomodoroTimer />
          <button className="calrow" onClick={()=>{setPlanningOpen(true);setSidebarOpen(false);}}>Find a time & insights</button>
          <button className="calrow" onClick={()=>{setTasksOpen(true);setSidebarOpen(false);}}>Tasks</button>
          <label className="calrow"><input type="checkbox" checked={showTasks} onChange={e=>setShowTasks(e.target.checked)}/>Show tasks on calendar</label>
          <button className="calrow" onClick={()=>{setDataOpen(true);setSidebarOpen(false);}}>Import / export & trash</button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <h2 style={{ margin: 0 }}>My calendars</h2>
            <button className="btn ghost" aria-label="Manage calendars" onClick={()=>setCalendarsOpen(true)}><PlusIcon size={16}/> Manage</button>
          </div>
          {calError && <p style={{ fontSize: 12, color: "var(--now)" }}>Calendars failed to load.</p>}
          {calLoading && <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading calendars…</p>}
          {!calLoading && !calError && calendars.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>No calendars — create your first.</p>}
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
              <span className="cb" style={{ display: "grid", placeItems: "center", borderColor: "var(--muted)" }}><PrintIcon size={12} /></span> Print…
            </button>
            <button className="calrow" onClick={() => setSettingsOpen(true)} style={{ ["--c" as string]: "var(--muted)" } as unknown as React.CSSProperties}>
              <span className="cb" style={{ display: "grid", placeItems: "center", borderColor: "var(--muted)" }}><SettingsIcon size={12} /></span> Settings
            </button>
          </div>
        </aside>
        <div className={`backdrop${sidebarOpen ? " open" : ""}`} id="backdrop" onClick={() => setSidebarOpen(false)} />

        <main id="main" onPointerDown={onMainPointerDown} onPointerUp={onMainPointerUp}>
          {isError && <p role="alert" style={{ padding: 16 }}>Couldn’t load events. Try again.</p>}
          {isLoading ? (
            <p style={{ padding: 16, color: "var(--muted)" }}>Loading…</p>
          ) : view === "month" ? (
            <MonthView anchor={anchor} events={events} calendars={calendars} timeZone={effectiveTimeZone} weekStart={weekStart} onSelectEvent={openExistingEvent} onCreateAt={openNewEventAt} onEventContextMenu={(e,id)=>{if(id.startsWith("task:"))setTasksOpen(true);else setCtx({x:e.clientX,y:e.clientY,kind:"event",eventId:id});}} onEmptyContextMenu={(e,k,mins)=>setCtx({x:e.clientX,y:e.clientY,kind:"empty",dateKey:k,minutes:mins})} />
          ) : view === "agenda" ? (
            <AgendaView events={events} calendars={calendars} timeZone={effectiveTimeZone} onSelectEvent={openExistingEvent} anchor={anchor} onEventContextMenu={(e,id)=>{if(id.startsWith("task:"))setTasksOpen(true);else setCtx({x:e.clientX,y:e.clientY,kind:"event",eventId:id});}} onEmptyContextMenu={(e,k,mins)=>setCtx({x:e.clientX,y:e.clientY,kind:"empty",dateKey:k,minutes:mins})} />
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
              onMoveOrResize={(id,startAt,endAt)=>{if(id.startsWith("task:")){fetch("/api/tasks/"+id.slice(5),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({startAt,endAt})}).then(async r=>{if(!r.ok)throw new Error("Could not reschedule task");await queryClient.invalidateQueries({queryKey:["tasks"]});}).catch(e=>setToast({msg:e.message}));}else moveOrResize.mutate({id,startAt,endAt},{onError:e=>setToast({msg:e.message})});}}
              onSelectDay={(iso) => { const [y, m, d] = iso.split("-").map(Number); setAnchor(new Date(y!, m! - 1, d!)); setView("day"); }}
              onEventContextMenu={(e,id)=>{if(id.startsWith("task:"))setTasksOpen(true);else setCtx({x:e.clientX,y:e.clientY,kind:"event",eventId:id});}}
              onEmptyContextMenu={(e,k,mins)=>setCtx({x:e.clientX,y:e.clientY,kind:"empty",dateKey:k,minutes:mins})}
            />
          )}
        </main>
      </div>

      <nav className="tabs" id="tabs" aria-label="Views">
        {(["day", "week", "month", "agenda", "book", "year", "notebook"] as const).map((v) => {
          const Icon = v === "day" ? DayViewIcon : v === "week" ? WeekViewIcon : v === "month" ? MonthViewIcon : v === "agenda" ? AgendaViewIcon : v === "book" ? BookIcon : v === "year" ? YearViewIcon : BookIcon;
          return (
            <button key={v} data-view={v} aria-pressed={view === v} onClick={() => setView(v as CalendarView)}>
              <Icon size={16} />{v[0]!.toUpperCase() + v.slice(1)}
            </button>
          );
        })}
      </nav>
      <button className="fab" id="fab" aria-label="Create event" onClick={() => openNewEventAt(createDateKey, 9 * 60)} disabled={!calendars.length} style={{ opacity: !calendars.length ? 0.5 : 1 }}><PlusIcon size={22} /></button>

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
      <PlanningDialog open={planningOpen} onClose={()=>setPlanningOpen(false)} workspaceId={workspaceId} calendars={calendars} timeZone={effectiveTimeZone} onCreate={(startAt,endAt)=>{setDialogIsNew(true);setDialogDraft({calendarId:visibleCalendars[0]??calendars[0]?.id??"",title:"",description:"",location:"",startAt,endAt,timezone:effectiveTimeZone,allDay:false});}}/>
      <TasksDialog open={tasksOpen} onClose={()=>setTasksOpen(false)} workspaceId={workspaceId} timeZone={effectiveTimeZone}/>
      <DataDialog onSelectEvent={jumpToEvent} open={dataOpen} onClose={()=>setDataOpen(false)} workspaceId={workspaceId} calendars={calendars} timeZone={effectiveTimeZone} />
      <PrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        workspaceId={workspaceId}
        calendars={calendars}
        visibleCalendars={visibleCalendars}
        timeZone={timeZone}
        anchor={anchor}
      />
      {calendarsOpen&&<div className="ov" onMouseDown={e=>{if(e.target===e.currentTarget)setCalendarsOpen(false);}}><div ref={calendarsDialogRef} className="dlg" role="dialog" aria-modal="true" aria-label="Manage calendars"><button className="btn" onClick={()=>setCalendarsOpen(false)}>Close</button><CalendarManager workspaceId={workspaceId}/></div></div>}
      <AiChat workspaceId={workspaceId} timeZone={effectiveTimeZone} open={aiChatOpen} onClose={() => setAiChatOpen(false)} />

      {showDatePicker && (
        <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowDatePicker(false); }}>
          <div className="dlg" style={{ maxWidth: 320 }} role="dialog" aria-modal="true" aria-label="Jump to date">
            <h2 style={{ margin:"0 0 10px", font:"700 16px var(--font-display)" }}>Jump to date</h2>
            <input type="date" value={formatInTimeZone(anchor, effectiveTimeZone, "yyyy-MM-dd")} onChange={(e)=>{ if(e.target.value) {jumpToDay(e.target.value); setShowDatePicker(false);} }} style={{ width:"100%", border:"1px solid var(--line)", borderRadius:10, padding:"10px", background:"var(--bg)", color:"var(--ink)" }} />
            <div className="acts" style={{ marginTop:12 }}>
              <button className="btn ghost" onClick={()=>{ setAnchor(new Date()); setShowDatePicker(false); }}>Today</button>
              <span style={{flex:1}}/>
              <button className="btn" onClick={()=>setShowDatePicker(false)}>Close</button>
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
              { label:"Edit", icon:<EditIcon size={14} />, action:()=>openExistingEvent(ctx.eventId) },
              { label:"Duplicate", icon:<DuplicateIcon size={14} />, action:()=>handleDuplicate(ctx.eventId) },
            ]},
            { items: [
              { label:"Copy", icon:<CopyIcon size={14} />, action:()=>handleCopy(ctx.eventId) },
              { label: cutId===ctx.eventId ? "Cut — active" : "Cut", icon:<CutIcon size={14} />, action:()=>handleCut(ctx.eventId) },
            ]},
            { items: [
              { label:"Move to tomorrow", icon:<CalendarMarkIcon size={14} />, action:()=>handleMoveTo(ctx.eventId, tomorrowKey) },
              { label:"Move to next Monday", icon:<CalendarMarkIcon size={14} />, action:()=>handleMoveTo(ctx.eventId, nextMonKey) },
              { label:"Move to date…", icon:<CalendarMarkIcon size={14} />, action:()=>{ setShowDatePicker(true);
                setToast({msg:"Pick a date in the title Jump picker, then right-click Move again."}); setTimeout(()=>setToast(null),3000);
              } },
            ]},
            { items: [
              { label:"Change calendar…", icon:<BookIcon size={14} />, action:()=>{
                const idx = calendars.findIndex(c=>c.id===ev.calendarId);
                const next = calendars[(idx+1)%calendars.length];
                if (next) update.mutate({ ...ev, calendarId: next.id, id: ev.id });
              }},
            ]},
            { items: [
              { label:"Delete", icon:<TrashIcon size={14} />, danger:true, action:()=>remove.mutate(ctx.eventId) },
            ]},
          ]} />
        );
      })()}

      {ctx && ctx.kind === "empty" && (
        <ContextMenu x={ctx.x} y={ctx.y} onClose={()=>setCtx(null)} sections={[
          { items: [
            { label:"New Event", icon:<PlusIcon size={14} />, action:()=>openNewEventAt(ctx.dateKey, ctx.minutes) },
            { label:"New All-Day Event", icon:<CalendarMarkIcon size={14} />, action:()=>openNewAllDayAt(ctx.dateKey) },
            { label:"Paste", icon:<PasteIcon size={14} />, disabled: !clipboardRef.current, action:()=>handlePaste(ctx.dateKey, ctx.minutes) },
          ]},
          { items: [
            { label:"Go to Today", icon:<HomeIcon size={14} />, action:()=>setAnchor(new Date()) },
            { label:"Go to Date…", icon:<CalendarMarkIcon size={14} />, action:()=>setShowDatePicker(true) },
          ]},
          { items: [
            { label:"Change View — Day", icon:<EyeIcon size={14} />, action:()=>setView("day") },
            { label:"Change View — Week", icon:<EyeIcon size={14} />, action:()=>setView("week") },
            { label:"Change View — Book", icon:<BookIcon size={14} />, action:()=>setView("book") },
          ]},
        ]} />
      )}

      {resetConfirmOpen && (
        <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) setResetConfirmOpen(false); }}>
          <div className="dlg" role="dialog" aria-modal="true" aria-label="Reset all-day events">
            <h2 style={{ margin: "0 0 8px", font: "700 18px var(--font-display)" }}>Reset all-day events?</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.4 }}>
              {allDayCount
                ? `This will delete ${allDayCount} all-day event(s) in this workspace${visibleCalendars.length ? " (filtered calendars)" : ""}. You can undo immediately after.`
                : "There are no all-day events to reset."}
            </p>
            <div className="acts" style={{ marginTop: 16 }}>
              <span style={{ flex: 1 }} />
              <button className="btn ghost" onClick={() => setResetConfirmOpen(false)}>Cancel</button>
              <button
                className="btn danger"
                disabled={!allDayCount || resetAllDay.isPending}
                onClick={() => {
                  setResetConfirmOpen(false);
                  resetAllDay.mutate();
                }}
              >
                {resetAllDay.isPending ? "Resetting…" : "Reset"}
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
            <button onClick={() => { restore.mutate(toast.undoId!); setToast(null); }}>Undo</button>
          ) : null}
        </div>
      )}
    </div>
  );
}