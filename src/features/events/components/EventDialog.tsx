"use client";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, TrashIcon } from "@/lib/icons";
import type { CalendarSummary, EventDraft, EventStatus } from "@/features/calendar/types";
import { dayKey, toInstant } from "@/lib/dates/date-utils";
import { formatInTimeZone } from "date-fns-tz";
import { useAppI18n } from "@/lib/i18n";

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
      aria-label={t("removeLabel", { label })}
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
  onDelete: () => void;
  isSaving?: boolean;
  externalError?: string;
}) {
  const { t } = useAppI18n();
  const [form, setForm] = useState<EventDraft | null>(draft);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const [newLabel, setNewLabel] = useState("");  // <-- added separate state for new label input

  useEffect(() => { setForm(draft); setError(""); }, [draft]);
  useEffect(() => { if (open) titleRef.current?.focus(); }, [open]);
  useEffect(() => { if (externalError) setError(externalError); }, [externalError]);

  if (!open || !form) return null;

  function set<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function setDateTime(field: "startAt" | "endAt", dateVal: string, timeVal: string) {
    // Civil date/time in event timezone -> UTC instant (Notebook v2 §25).
    const [h, m] = timeVal.split(":").map(Number);
    const minutes = (h ?? 0) * 60 + (m ?? 0);
    setForm((f) => (f ? { ...f, [field]: toInstant(dateVal, minutes, f.timezone) } : f));
  }

  function submit() {
    if (!form) return;
    if (!form.allDay && new Date(form.endAt) <= new Date(form.startAt)) {
      setError(t("endAfterStart"));
      return;
    }
    // Merge new label into labels array if provided
    const labels = newLabel ? [...(form.labels ?? []), newLabel] : (form.labels ?? []);
    onSave({ ...form, title: form.title.trim() || "(No title)", labels });
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
      <div className="dlg" role="dialog" aria-modal="true" aria-label={t("eventDetails")}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            ref={titleRef}
            className="ttl"
            placeholder={t("addTitle")}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
          <button className="icon" aria-label={t("close")} onClick={onClose}><CloseIcon /></button>
        </div>

        <div className="fld">
          <span className="k">{t("calendar")}</span>
          <div className="picks" role="radiogroup" aria-label={t("calendar")}>
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
          <span className="k">{t("date")}</span>
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
              <span className="k" style={{ width: 44 }}>{t("start")}</span>
              <input type="time" value={startTime} onChange={(e) => setDateTime("startAt", startDate, e.target.value)} />
              <span className="k" style={{ width: 44 }}>{t("end")}</span>
              <input type="time" value={endTime} onChange={(e) => setDateTime("endAt", endDate, e.target.value)} />
            </>
          )}
        </div>
        {!form.allDay && (
          <div className="fld">
            <span className="k">{t("endDate")}</span>
            <input type="date" value={endDate} onChange={(e) => setDateTime("endAt", e.target.value, endTime)} />
            <span className="k" style={{ width: 48 }}>{t("timezone")}</span>
            <input type="text" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="America/Toronto" style={{ flex: 1 }} />
          </div>
        )}
        {form.allDay && (
          <div className="fld">
            <span className="k">{t("timezone")}</span>
            <input type="text" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="America/Toronto" />
          </div>
        )}
        <div className="fld">
          <span className="k">{t("allDay")}</span>
          <input type="checkbox" checked={form.allDay} onChange={(e) => set("allDay", e.target.checked)} />
        </div>
        <div className="fld">
          <span className="k">{t("location")}</span>
          <input type="text" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder={t("addLocation")} />
        </div>
        <div className="fld">
          <span className="k">{t("notes")}</span>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("addNotes")} />
        </div>

        {/* Labels / Tags section */}
        <div className="fld">
          <span className="k">{t("labels")}</span>
          <div className="picks" role="group" aria-label={t("labels")}>
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
              placeholder={t("addLabel")}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Priority section */}
        <div className="fld">
          <span className="k">{t("priority")}</span>
          <div className="picks" role="radiogroup" aria-label={t("priority")}>
            <label
              key="1"
              className={`priority-radio ${initialPriority === 1 ? "active" : ""}`}
              role="radio"
              aria-checked={initialPriority === 1}
              onClick={() => set("priority", 1)}
            >
              Low
            </label>
            <label
              key="2"
              className={`priority-radio ${initialPriority === 2 ? "active" : ""}`}
              role="radio"
              aria-checked={initialPriority === 2}
              onClick={() => set("priority", 2)}
            >
              Medium
            </label>
            <label
              key="3"
              className={`priority-radio ${initialPriority === 3 ? "active" : ""}`}
              role="radio"
              aria-checked={initialPriority === 3}
              onClick={() => set("priority", 3)}
            >
              High
            </label>
          </div>
        </div>

        {error && <p className="err" role="alert">{error}</p>}

        <div className="acts">
          {!isNew && (
            <button className="btn danger" onClick={onDelete} disabled={!!isSaving}>
              <TrashIcon size={16} /> Delete event
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onClose} disabled={!!isSaving}>{t("cancel")}</button>
          <button className="btn primary" onClick={submit} disabled={!!isSaving}>{isSaving ? t("saving") : t("saveEvent")}</button>
        </div>
      </div>
    </div>
  );
}