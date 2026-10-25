"use client";
import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { CloseIcon, TrashIcon } from "@/lib/icons";
import type { CalendarSummary, EventDraft, EventStatus } from "@/features/calendar/types";
import { dayKey, toInstant, isValidLocalTime } from "@/lib/dates/date-utils";
import { formatInTimeZone } from "date-fns-tz";

function toDateInput(iso: string, tz: string): string {
  try { return dayKey(iso, tz); } catch { return iso.slice(0, 10); }
}
function toTimeInput(iso: string, tz: string): string {
  try { return formatInTimeZone(new Date(iso), tz, "HH:mm"); } catch { return "09:00"; }
}

function LabelTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="label-tag"
      role="button"
      tabIndex={0}
      onKeyDown={e=>{if(e.key==="Enter" || e.key===" "){e.preventDefault();onRemove();}}}
      aria-label={`Remove label: ${label}`}
      onClick={onRemove}
    >
      {label}
      <svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </span>
  );
}

function priorityClass(p: number) {
  return p === 1 ? "priority-low" : p === 2 ? "priority-medium" : "priority-high";
}

export function EventDialog({
  open, draft, calendars, isNew, onClose, onSave, onDelete, isSaving, externalError,
}: {
  open: boolean;
  draft: EventDraft | null;
  calendars: CalendarSummary[];
  isNew: boolean;
  onClose: () => void;
  onSave: (draft: EventDraft) => void;
  onDelete: (scope?: "this" | "following" | "series") => void;
  isSaving?: boolean;
  externalError?: string;
}) {
  const [form, setForm] = useState<EventDraft | null>(draft);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open && !!form,dialogRef,onClose);
  const titleRef = useRef<HTMLInputElement>(null);
  const [guestText,setGuestText]=useState("");
  const [inviteLinks,setInviteLinks]=useState<Record<string,string>>({});
  const [inviting,setInviting]=useState(false);
  const [newLabel, setNewLabel] = useState("");  // <-- added separate state for new label input

  useEffect(() => { setForm(draft); setError(""); setNewLabel("");setGuestText(draft?.guests?.map(g=>g.email).join(", ")??"");setInviteLinks({}); }, [draft]);
  useEffect(() => { if (open) titleRef.current?.focus(); }, [open]);
  useEffect(() => { if (externalError) setError(externalError); }, [externalError]);

  if (!open || !form) return null;

  function set<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function setDateTime(field: "startAt" | "endAt", dateVal: string, timeVal: string) {
    // Civil date/time in event timezone -> UTC instant (Notebook v2 §25).
    if (!dateVal || !timeVal || !form) return;
    const [h, m] = timeVal.split(":").map(Number);
    const minutes = (h ?? 0) * 60 + (m ?? 0);
    try {
      if (!isValidLocalTime(dateVal, minutes, form.timezone)) { setError("This local time does not exist because clocks change. Choose another time."); return; }
      setError("");
      setForm((f) => (f ? { ...f, [field]: toInstant(dateVal, minutes, f.timezone) } : f));
    } catch { setError("Enter a valid timezone first."); }
  }

  async function invitationLinks(){if(!form?.id)return;setInviting(true);setError("");try{const links:Record<string,string>={};for(const guest of form.guests??[]){const r=await fetch(`/api/events/${encodeURIComponent(form.id)}/invitations`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:guest.email})});const b=await r.json();if(!r.ok)throw new Error(b?.error?.message??"Could not prepare invitation");links[guest.email]=new URL("/invite/"+b.token,window.location.origin).href;}setInviteLinks(links);}catch(e){setError((e as Error).message);}finally{setInviting(false);}}
  function submit() {
    if (!form) return;
    if (!form.allDay && new Date(form.endAt) <= new Date(form.startAt)) {
      setError("End time must be after the start time.");
      return;
    }
    if (new Date(form.endAt) < new Date(form.startAt)) { setError("End date must not precede start date."); return; }
    // Merge new label into labels array if provided
    const labels = [...new Set([...(form.labels ?? []),newLabel.trim()].filter(Boolean))];
    onSave({ ...form, title: form.title.trim() || "(No title)", labels, guests:guestText.split(/[,;\n]/).map(value=>{const email=value.trim();return {...form.guests?.find(g=>g.email.toLowerCase()===email.toLowerCase()),email};}).filter(g=>g.email) });
  }

  const startDate = toDateInput(form.startAt, form.timezone);
  const startTime = toTimeInput(form.startAt, form.timezone);
  const endDate = toDateInput(form.endAt, form.timezone);
  const endTime = toTimeInput(form.endAt, form.timezone);

  // initialise labels/priority from draft if present
  const initialLabels = form.labels ?? [];
  const initialPriority = form.priority ?? 2;

  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="dlg" role="dialog" aria-modal="true" aria-label="Event details">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            ref={titleRef}
            className="ttl"
            placeholder="Add title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
          <button className="icon" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        </div>

        <div className="fld">
          <span className="k">Calendar</span>
          <div className="picks" role="radiogroup" aria-label="Calendar">
            {calendars.map((c) => (
              <button
                key={c.id}
                type="button"
                className="pick"
                role="radio"
                aria-checked={form.calendarId === c.id}
                style={{ ["--c" as string]: c.color }}
                onClick={() => set("calendarId", c.id)}
              >
                <i />{c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="fld">
          <span className="k">Date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              const v = e.target.value;
              setDateTime("startAt", v, startTime);
              if (startDate === endDate) setDateTime("endAt", v, endTime);
            }}
          />
          {!form.allDay && (
            <>
              <span className="k" style={{ width: 44 }}>Start</span>
              <input type="time" value={startTime} onChange={(e) => setDateTime("startAt", startDate, e.target.value)} />
              <span className="k" style={{ width: 44 }}>End</span>
              <input type="time" value={endTime} onChange={(e) => setDateTime("endAt", endDate, e.target.value)} />
            </>
          )}
        </div>
        {!form.allDay && (
          <div className="fld">
            <span className="k">End date</span>
            <input type="date" value={endDate} onChange={(e) => setDateTime("endAt", e.target.value, endTime)} />
            <span className="k" style={{ width: 48 }}>Timezone</span>
            <input type="text" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="America/Toronto" style={{ flex: 1 }} />
          </div>
        )}
        {form.allDay && (
          <div className="fld">
            <span className="k">Timezone</span>
            <input type="text" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="America/Toronto" />
          </div>
        )}
        <div className="fld">
          <span className="k">All day</span>
          <input type="checkbox" checked={form.allDay} onChange={(e) => {const allDay=e.target.checked;try{const start=allDay?toInstant(startDate,0,form.timezone):form.startAt;const end=allDay?toInstant(endDate,0,form.timezone):Date.parse(form.endAt)>Date.parse(form.startAt)?form.endAt:new Date(Date.parse(form.startAt)+3600000).toISOString();setForm({...form,allDay,startAt:start,endAt:end});}catch{setError("Enter a valid timezone first.");}}} />
        </div>
        <div className="fld">
          <span className="k">Location</span>
          <input type="text" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Add location" />
        </div>
        <div className="fld">
          <span className="k">Notes</span>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Add notes" />
        </div>

        {/* Labels / Tags section */}
        <div className="fld">
          <span className="k">Labels</span>
          <div className="picks" role="group" aria-label="Labels">
            {/* Pre-existing labels chips */}
            {initialLabels.map((lbl) => (
              <LabelTag
                key={lbl}
                label={lbl}
                onRemove={() => set("labels", initialLabels.filter((l) => l !== lbl))}
              />
            ))}
            {/* Add new label input */}
            <input
              type="text"
              className="new-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Add a label..."
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Priority section */}
        <div className="fld">
          <span className="k">Priority</span>
          <div className="picks" role="radiogroup" aria-label="Priority">
            <label
              key="1"
              className={`priority-radio ${initialPriority === 1 ? "active" : ""}`}
              role="radio"
              aria-checked={initialPriority === 1}
              tabIndex={0}
              onKeyDown={e=>{if(e.key==="Enter" || e.key===" "){e.preventDefault();set("priority", 1);}}}
              onClick={() => set("priority", 1)}
            >
              Low
            </label>
            <label
              key="2"
              className={`priority-radio ${initialPriority === 2 ? "active" : ""}`}
              role="radio"
              aria-checked={initialPriority === 2}
              tabIndex={0}
              onKeyDown={e=>{if(e.key==="Enter" || e.key===" "){e.preventDefault();set("priority", 2);}}}
              onClick={() => set("priority", 2)}
            >
              Medium
            </label>
            <label
              key="3"
              className={`priority-radio ${initialPriority === 3 ? "active" : ""}`}
              role="radio"
              aria-checked={initialPriority === 3}
              tabIndex={0}
              onKeyDown={e=>{if(e.key==="Enter" || e.key===" "){e.preventDefault();set("priority", 3);}}}
              onClick={() => set("priority", 3)}
            >
              High
            </label>
          </div>
        </div>

        {form.allDay && <label className="fld"><span className="k">End date</span><input aria-label="All-day end date" type="date" value={endDate} onChange={e=>setDateTime("endAt",e.target.value,"00:00")} /></label>}
        <fieldset className="event-options" disabled={!!isSaving}>
          <legend>Event options</legend>
          {form.occurrenceOf && <label className="fld"><span className="k">Apply to</span><select value={form.editScope ?? "this"} onChange={e=>set("editScope",e.target.value as "this" | "following" | "series")}><option value="this">This event</option><option value="following">This and following events</option><option value="series">All events in the series</option></select></label>}
          <label className="fld"><span className="k">Type</span><select value={form.eventType ?? "event"} onChange={e=>set("eventType",e.target.value as EventDraft["eventType"])}><option value="event">Event</option><option value="focus">Focus time</option><option value="outOfOffice">Out of office</option><option value="workingLocation">Working location</option></select></label>
          <label className="fld"><span className="k">Repeats</span><select aria-label="Repeat frequency" value={form.recurrence?.rrule?.split(";")[0] ?? ""} onChange={e=>set("recurrence",e.target.value ? {rrule:e.target.value}:null)}><option value="">Does not repeat</option><option value="FREQ=DAILY">Every day</option><option value="FREQ=WEEKLY">Every week</option><option value="FREQ=MONTHLY">Every month</option><option value="FREQ=YEARLY">Every year</option></select></label>
          {form.recurrence && <label className="fld"><span className="k">Rule</span><textarea aria-label="Recurrence rule" value={form.recurrence.rrule} onChange={e=>set("recurrence",{rrule:e.target.value})} placeholder="FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10" /></label>}
          {form.recurrence && <p className="option-help">Customize with INTERVAL, COUNT or UNTIL, BYDAY (MO,WE or 2MO), BYMONTHDAY and BYMONTH.</p>}
          <label className="fld"><span className="k">Color</span><input aria-label="Event color" type="color" value={form.color ?? "#0b57d0"} onChange={e=>set("color",e.target.value)} /><button type="button" className="btn ghost" onClick={()=>set("color",null)}>Use calendar color</button></label>
          <label className="fld"><span className="k">Show as</span><select value={form.availability ?? "busy"} onChange={e=>set("availability",e.target.value as "busy" | "free")}><option value="busy">Busy</option><option value="free">Free</option></select></label>
          <label className="fld"><span className="k">Visibility</span><select value={form.visibility ?? "default"} onChange={e=>set("visibility",e.target.value as EventDraft["visibility"])}><option value="default">Calendar default</option><option value="private">Private</option><option value="public">Public within shared calendar</option></select></label>
          <label className="fld"><span className="k">Guests</span><textarea aria-label="Guest emails" value={guestText} onChange={e=>setGuestText(e.target.value)} placeholder="email@example.com, colleague@example.com" /></label>
          {!!form.guests?.length&&<p className="option-help">{form.guests.map(g=>g.email+": "+(g.responseStatus??"not invited").replaceAll("_"," ")).join(" · ")}</p>}
          {form.guests?.map(g=><label className="fld" key={g.email}><input type="checkbox" checked={!!g.isOptional} onChange={e=>set("guests",form.guests?.map(existing=>existing.email===g.email?{...existing,isOptional:e.target.checked}:existing))}/>Optional: {g.email}</label>)}
          {!isNew&&!!form.guests?.length&&<><button type="button" className="btn" disabled={inviting} onClick={invitationLinks}>{inviting?"Preparing…":"Get invitation links"}</button><p className="option-help">Share these links with your guests. Email sending is not configured. Generating a new link revokes the previous link.</p></>}
          {Object.entries(inviteLinks).map(([email,url])=><label className="fld" key={email}>{email}<input aria-label={"Invitation link for "+email} value={url} readOnly onFocus={e=>e.target.select()}/></label>)}
          <label className="fld"><span className="k">Meeting</span><input type="text" value={form.conferenceUrl ?? ""} onChange={e=>set("conferenceUrl",e.target.value)} placeholder="https://meet.google.com/…" /></label>
          <label className="fld"><span className="k">Reminders</span><select aria-label="Reminders" multiple value={(form.reminders ?? [15]).map(String)} onChange={e=>set("reminders",Array.from(e.target.selectedOptions,o=>Number(o.value)))}>{[0,5,10,15,30,60,1440,10080].map(n=><option key={n} value={n}>{n===0?"At start":n>=1440?(n/1440)+" day(s) before":n+" minutes before"}</option>)}</select></label>
          <button type="button" className="btn ghost" onClick={()=>set("reminders",[])}>Remove reminders</button>
        </fieldset>
        {error && <p className="err" role="alert">{error}</p>}

        <div className="acts">
          {!isNew && (
            <button className="btn danger" onClick={()=>onDelete(form.editScope)} disabled={!!isSaving}>
              <TrashIcon size={16} /> Delete event
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onClose} disabled={!!isSaving}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={!!isSaving}>{isSaving ? "Saving…" : "Save event"}</button>
        </div>
      </div>
    </div>
  );
}