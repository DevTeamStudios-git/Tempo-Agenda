"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BellIcon, CloseIcon } from "@/lib/icons";
import { useAppI18n } from "@/lib/i18n";

type Notification = {
  id: string;
  title: string;
  body?: string | null;
  isRead: boolean;
  createdAt: string;
  type: string;
  eventId?: string | null;
};

async function fetchNotifications(workspaceId: string): Promise<{ items: Notification[]; unread: number }> {
  const res = await fetch(`/api/notifications?workspaceId=${encodeURIComponent(workspaceId)}`);
  if (!res.ok) throw new Error("Failed to load notifications");
  return res.json();
}

export function NotificationCenter({ workspaceId }: { workspaceId: string }) {
  const { locale, t } = useAppI18n();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", workspaceId],
    queryFn: () => fetchNotifications(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 30000, // poll every 30s; realtime will invalidate
  });

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] }),
  });

  return (
    <div style={{ position: "relative" }}>
      <button
        className="icon"
        aria-label={`${t("notifications")}${unread ? ` (${unread} ${t("unread")})` : ""}`}
        title={t("notifications")}
        onClick={() => setOpen((v) => !v)}
        style={{ position: "relative" }}
      >
        <BellIcon />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 8,
              background: "var(--now)",
              color: "white",
              fontSize: 10,
              fontWeight: 700,
              display: "grid",
              placeItems: "center",
              lineHeight: 1,
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 45 }}
            aria-hidden
          />
          <div
            role="dialog"
            aria-label={t("notifications")}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 360,
              maxHeight: "70vh",
              overflow: "hidden",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              boxShadow: "var(--shadow)",
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 12px 8px", borderBottom: "1px solid var(--line)", flex: "none" }}>
              <BellIcon size={16} />
              <span style={{ fontWeight: 700, flex: 1 }}>{t("notifications")}</span>
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "transparent", border: 0, cursor: "pointer" }}
                >
                  Mark all read
                </button>
              )}
              <button className="icon" aria-label={t("close")} onClick={() => setOpen(false)} style={{ width: 28, height: 28 }}>
                <CloseIcon size={14} />
              </button>
            </div>

            <div style={{ overflow: "auto", flex: 1 }}>
              {items.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
                  {t("noNotifications")}
                  <div style={{ marginTop: 8, fontSize: 11 }}>{t("notificationsEmptyBody")}</div>
                </div>
              ) : (
                items.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--line)",
                      background: n.isRead ? "transparent" : "color-mix(in srgb, var(--accent) 6%, var(--surface))",
                      display: "flex",
                      gap: 10,
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.isRead ? "transparent" : "var(--accent)", marginTop: 6, flex: "none" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.title}</div>
                      {n.body && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.3 }}>{n.body}</div>}
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(n.createdAt))}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: 8, borderTop: "1px solid var(--line)", flex: "none", display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  if ("Notification" in window) {
                    Notification.requestPermission().then((p) => {
                      if (p === "granted") new Notification("Tempo — notifications enabled", { body: "You’ll get lock-screen reminders if you enable them in Settings." });
                    });
                  }
                }}
                className="btn"
                style={{ flex: 1, justifyContent: "center", height: 32, fontSize: 12 }}
              >
                Enable push
              </button>
              <button onClick={() => setOpen(false)} className="btn primary" style={{ flex: 1, justifyContent: "center", height: 32, fontSize: 12 }}>
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
