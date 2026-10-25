"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { AssistantPermissions as Permissions } from "@/features/calendar/types";
import { readApiError } from "@/lib/api/error";
const labels: Record<keyof Permissions, string> = {
  canRead: "Read my calendars and events",
  canCreateEvents: "Propose creating events",
  canEditEvents: "Propose editing events",
  canDeleteEvents: "Propose deleting events",
  canCreateCalendars: "Propose creating calendars",
  canManageCalendars: "Propose editing and deleting calendars",
};
export function AssistantPermissions() {
  const client = useQueryClient();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const query = useQuery<{ permissions: Permissions }>({
    queryKey: ["assistant-permissions"],
    queryFn: async () => {
      const r = await fetch("/api/ai/permissions");
      if (!r.ok) await readApiError(r);
      return r.json();
    },
  });
  async function change(key: keyof Permissions, value: boolean) {
    if (!query.data) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/ai/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...query.data.permissions, [key]: value }),
      });
      if (!r.ok) await readApiError(r);
      await client.invalidateQueries({ queryKey: ["assistant-permissions"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details style={{ padding: 12, borderBottom: "1px solid var(--line)",maxHeight:"30vh",overflowY:"auto",flexShrink:0 }}>
      <summary style={{position:"sticky",top:0,background:"var(--surface)",paddingBlock:4}}>Assistant permissions</summary>
      <p className="option-help">
        Disabled by default. Reading shares calendar data with your selected AI
        provider. Proposed changes require your approval and respect your
        workspace role.
      </p>
      {query.isLoading && <p>Loading permissions…</p>}
      {query.data &&
        Object.entries(labels).map(([key, label]) => (
          <label key={key} style={{ display: "flex", gap: 8, padding: 6 }}>
            <input
              type="checkbox"
              disabled={busy}
              checked={query.data.permissions[key as keyof Permissions]}
              onChange={(e) =>
                void change(key as keyof Permissions, e.target.checked)
              }
            />
            {label}
          </label>
        ))}
      {(error || query.error) && (
        <p role="alert">{error || query.error?.message}</p>
      )}
    </details>
  );
}
