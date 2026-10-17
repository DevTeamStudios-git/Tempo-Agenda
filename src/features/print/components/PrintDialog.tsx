"use client";
/**
 * Lets the person choose exactly what to print — Day / Week / Month /
 * Agenda (next 30 days) / a custom date range — which calendars to
 * include, and whether to include location/notes. Fetches the events for
 * that scope, then hands off to `PrintPreview` (portaled to <body>) and
 * triggers the browser print dialog.
 */
import { useEffect, useState } from "react";
import { CloseIcon, PrintIcon } from "@/lib/icons";
import { formatInTimeZone } from "date-fns-tz";
import { computePrintRange, type PrintScope } from "../lib/print-range";
import { PrintPreview } from "./PrintPreview";
import { readApiError } from "@/lib/api/error";
import type { CalendarSummary, EventRecord } from "@/features/calendar/types";
import { useAppI18n } from "@/lib/i18n";

const SCOPES: { id: PrintScope; label: string }[] = [
  { id: "day", label: t("day") },
  { id: "week", label: t("week") },
  { id: "month", label: t("month") },
  { id: "agenda", label: t("agenda30Days") },
  { id: "range", label: t("customRange") },
];

export function PrintDialog({
  open,
  onClose,
  workspaceId,
  calendars,
  visibleCalendars,
  timeZone,
  anchor,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  calendars: CalendarSummary[];
  visibleCalendars: string[];
  timeZone: string;
  anchor: Date;
}) {
  const { t } = useAppI18n();
  const [scope, setScope] = useState<PrintScope>("week");
  const [dateKey, setDateKey] = useState("");
  const [rangeEndKey, setRangeEndKey] = useState("");
  const [selectedCals, setSelectedCals] = useState<string[]>([]);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [printJob, setPrintJob] = useState<{ scope: PrintScope; title: string; days: Date[]; events: EventRecord[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    const k = formatInTimeZone(anchor, timeZone, "yyyy-MM-dd");
    setDateKey(k);
    setRangeEndKey(k);
    setSelectedCals(visibleCalendars.length ? visibleCalendars : calendars.map((c) => c.id));
    setError("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire the actual browser print once the portal has painted, then clean up.
  useEffect(() => {
    if (!printJob) return;
    document.body.classList.add("printing");
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    const cleanup = () => {
      document.body.classList.remove("printing");
      setPrintJob(null);
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("afterprint", cleanup);
    };
  }, [printJob]);

  if (!open && !printJob) return null;

  function toggleCal(id: string) {
    setSelectedCals((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function handlePrint() {
    setError("");
    if (!dateKey) return;
    setLoading(true);
    try {
      const { rangeStart, rangeEnd, days, label } = computePrintRange(scope, dateKey, timeZone, rangeEndKey);
      const params = new URLSearchParams({ workspaceId, rangeStart: rangeStart.toISOString(), rangeEnd: rangeEnd.toISOString() });
      if (selectedCals.length === 0) params.append("_emptyCalendars", "1");
      selectedCals.forEach((id) => params.append("calendarId", id));
      const res = await fetch(`/api/events?${params.toString()}`);
      if (!res.ok) await readApiError(res);
      const data = await res.json();
      setPrintJob({ scope, title: label, days, events: data.events ?? [] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load events to print.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <div className="dlg" role="dialog" aria-modal="true" aria-label={t("printTitle")} style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <PrintIcon size={20} />
              <h2 style={{ margin: 0, font: "700 18px var(--font-display)", flex: 1 }}>{t("printTitle")}</h2>
              <button className="icon" aria-label="Close" onClick={onClose}><CloseIcon /></button>
            </div>

            <div className="fld" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <span className="k" style={{ width: "auto" }}>{t("whatToPrint")}</span>
              <div className="picks" role="radiogroup" aria-label={t("whatToPrint")}>
                {SCOPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="pick"
                    role="radio"
                    aria-checked={scope === s.id}
                    onClick={() => setScope(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {scope === "range" ? (
              <div className="fld">
                <span className="k">{t("range")}</span>
                <input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} aria-label={t("startDate")} />
                <span className="to">to</span>
                <input type="date" value={rangeEndKey} onChange={(e) => setRangeEndKey(e.target.value)} aria-label={t("endDateAria")} />
              </div>
            ) : (
              <div className="fld">
                <span className="k">{scope === "day" ? t("day") : scope === "week" ? t("weekOf") : scope === "month" ? t("monthOf") : t("starting")}</span>
                <input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} aria-label={t("date")} />
              </div>
            )}

            <div className="fld" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <span className="k" style={{ width: "auto" }}>{t("calendarTab")}</span>
              <div className="picks">
                {calendars.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="pick"
                    role="checkbox"
                    aria-checked={selectedCals.includes(c.id)}
                    onClick={() => toggleCal(c.id)}
                    style={{ ["--c" as string]: c.color } as React.CSSProperties}
                  >
                    <i />{c.name}
                  </button>
                ))}
              </div>
              {selectedCals.length === 0 && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>{t("noCalendarsSelected")}</p>
              )}
            </div>

            <div className="fld">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={includeDetails} onChange={(e) => setIncludeDetails(e.target.checked)} />
                <span>{t("includeDetails")}</span>
              </label>
            </div>

            {error && <p className="err">{error}</p>}

            <div className="acts" style={{ marginTop: 18 }}>
              <span style={{ flex: 1 }} />
              <button className="btn ghost" onClick={onClose}>{t("cancel")}</button>
              <button className="btn primary" onClick={handlePrint} disabled={loading}>
                <PrintIcon size={16} /> {loading ? t("preparing") : t("printTitle")}
              </button>
            </div>
          </div>
        </div>
      )}

      {printJob && (
        <PrintPreview
          scope={printJob.scope}
          title={printJob.title}
          days={printJob.days}
          events={printJob.events}
          calendars={calendars}
          timeZone={timeZone}
          includeDetails={includeDetails}
        />
      )}
    </>
  );
}
