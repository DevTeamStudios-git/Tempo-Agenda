"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CalendarSummary } from "../types";
import { readApiError } from "@/lib/api/error";
export function CalendarManager({ workspaceId }: { workspaceId: string }) {
  const client = useQueryClient();
  const [name, setName] = useState(""),
    [color, setColor] = useState("#0b57d0"),
    [editing, setEditing] = useState<string | null>(null),
    [confirm, setConfirm] = useState<CalendarSummary | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const query = useQuery<CalendarSummary[]>({
    queryKey: ["calendars", workspaceId],
    queryFn: async () => {
      const r = await fetch("/api/calendars?workspaceId=" + workspaceId);
      if (!r.ok) await readApiError(r);
      return (await r.json()).calendars;
    },
  });
  const deleted = useQuery<CalendarSummary[]>({
    queryKey: ["deleted-calendars", workspaceId],
    queryFn: async () => {
      const r = await fetch(
        "/api/calendars?workspaceId=" + workspaceId + "&deleted=1",
      );
      if (!r.ok) await readApiError(r);
      return (await r.json()).calendars;
    },
    retry: false,
  });
  async function change(method: string, id?: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(id ? "/api/calendars/" + id : "/api/calendars", {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!r.ok) await readApiError(r);
      setName("");
      setEditing(null);
      setConfirm(null);
      await Promise.all(
        ["calendars", "deleted-calendars", "events", "session"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h2>My calendars</h2>
      <p className="option-help">
        Create calendars to organize your schedule. Deleted calendars and their
        events can be restored below.
      </p>
      <form className="calendar-form"
        onSubmit={(e) => {
          e.preventDefault();
          void change(editing ? "PATCH" : "POST", editing ?? undefined, {
            name: name.trim(),
            color,
            ...(!editing ? { workspaceId } : {}),
          });
        }}
      >
        <label className="fld">
          Calendar name
          <input
            aria-label="Calendar name"
            maxLength={100}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="fld">
          Color
          <input
            aria-label="Calendar color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <div className="row">
          <button className="btn primary" disabled={busy || !name.trim()}>
            {editing ? "Save changes" : "Add calendar"}
          </button>
          {editing && (
            <button
              className="btn"
              type="button"
              onClick={() => {
                setEditing(null);
                setName("");
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
      <p className="option-help">
        Owners and administrators can manage calendars.
      </p>
      {query.error && <p role="alert">{query.error.message}</p>}
      <div className="data-list">
        {query.data?.map((c) => (
          <div className="trash-row" key={c.id}>
            <span>
              <i
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  background: c.color,
                  borderRadius: "50%",
                  marginRight: 8,
                }}
              />
              {c.name}
              {c.isArchived ? " (archived)" : ""}
            </span>
            <button
              className="btn"
              disabled={busy}
              onClick={() => {
                setEditing(c.id);
                setName(c.name);
                setColor(c.color);
              }}
            >
              Edit
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                void change("PATCH", c.id, { isArchived: !c.isArchived })
              }
            >
              {c.isArchived ? "Unarchive" : "Archive"}
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => setConfirm(c)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      {confirm && (
        <div role="alert">
          <p>
            Delete “{confirm.name}”? Its events will disappear from your
            schedule until you restore this calendar.
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={() => void change("DELETE", confirm.id)}
          >
            Delete calendar
          </button>{" "}
          <button
            className="btn"
            disabled={busy}
            onClick={() => setConfirm(null)}
          >
            Cancel
          </button>
        </div>
      )}
      {!!deleted.data?.length && (
        <>
          <h3>Deleted calendars</h3>
          {deleted.data.map((c) => (
            <div className="trash-row" key={c.id}>
              <span>{c.name}</span>
              <button
                className="btn"
                disabled={busy}
                onClick={() => void change("POST", c.id)}
              >
                Restore
              </button>
            </div>
          ))}
        </>
      )}
      {error && (
        <p role="alert" className="err">
          {error}
        </p>
      )}
    </>
  );
}
