"use client";
import { useEffect, useState } from "react";
import { CloseIcon, SunIcon, MoonIcon, SettingsIcon, ClockIcon, BellIcon, UserIcon, LayoutIcon, GlobeIcon, LogOutIcon, SearchIcon } from "@/lib/icons";
import { getStoredTheme, setTheme, type Theme } from "@/lib/theme";
import { useSettings, TIMEZONES } from "@/lib/settings";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { CalendarSummary } from "@/features/calendar/types";
import { useAppI18n } from "@/lib/i18n";

type Tab = "appearance" | "calendar" | "notifications" | "ai" | "account";

export function SettingsDialog({ open, onClose, calendars }: { open: boolean; onClose: () => void; calendars?: CalendarSummary[] }) {
  const { t } = useAppI18n();
  const [theme, setThemeState] = useState<Theme>("system");
  const [tab, setTab] = useState<Tab>("appearance");
  const { settings, update } = useSettings();

  useEffect(() => { if (open) setThemeState(getStoredTheme()); }, [open]);

  if (!open) return null;

  function choose(t: Theme) {
    setThemeState(t);
    setTheme(t);
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg" role="dialog" aria-modal="true" aria-label={t("settings")} style={{ maxWidth: 640, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 20px 14px", borderBottom: "1px solid var(--line)", flex: "none" }}>
          <SettingsIcon size={20} />
          <h2 style={{ margin: 0, font: "700 18px var(--font-display)", flex: 1 }}>{t("settings")}</h2>
          <button className="icon" aria-label={t("close")} onClick={onClose}><CloseIcon /></button>
        </div>

        <div style={{ display: "flex", gap: 6, padding: "12px 16px", borderBottom: "1px solid var(--line)", overflowX: "auto", flex: "none" }}>
          {([
            ["appearance", t("appearance"), LayoutIcon],
            ["calendar", t("calendarTab"), ClockIcon],
            ["notifications", t("notifications"), BellIcon],
            ["ai", t("aiAssistant"), SearchIcon],
            ["account", t("account"), UserIcon],
          ] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              onClick={() => setTab(v as Tab)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 20,
                border: tab === v ? "1px solid var(--accent)" : "1px solid var(--line)",
                background: tab === v ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "transparent",
                color: tab === v ? "var(--accent)" : "var(--muted)",
                fontWeight: 700,
                fontSize: 13,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "18px 20px 8px" }}>
          {tab === "appearance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><LayoutIcon size={14} /> {t("theme")}</div>
                <div className="picks" role="radiogroup" aria-label={t("theme")} style={{ gap: 8 }}>
                  {([
                    ["light", t("light"), SunIcon],
                    ["dark", t("dark"), MoonIcon],
                    ["system", t("system"), SettingsIcon],
                  ] as const).map(([v, label, Icon]) => (
                    <button
                      key={v}
                      type="button"
                      className="pick"
                      role="radio"
                      aria-checked={theme === v}
                      onClick={() => choose(v as Theme)}
                      style={{ flex: 1, justifyContent: "center", height: 40 }}
                    >
                      <Icon size={16} />{label}
                    </button>
                  ))}
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>{t("systemFollowsOs").split("localStorage")[0]}<code style={{ background: "var(--hover)", padding: "2px 6px", borderRadius: 6 }}>localStorage</code>.</p>
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 8 }}>{t("density")}</div>
                <div className="picks">
                  {(["comfortable", "compact"] as const).map((d) => (
                    <button key={d} className="pick" role="radio" aria-checked={settings.density === d} onClick={() => update({ density: d })} style={{ flex: 1, justifyContent: "center" }}>
                      {d[0]!.toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, background: "var(--hover)", padding: 12, borderRadius: 12 }}>
                <strong style={{ color: "var(--ink)" }}>{t("proTip")}</strong> {t("darkTip")}
              </div>
            </div>
          )}

          {tab === "calendar" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", display: "block", marginBottom: 6 }}><GlobeIcon size={12} style={{ marginRight: 6, verticalAlign: -1 }} /> {t("timezone")}</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => update({ timezone: e.target.value })}
                  style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", padding: "0 10px", fontWeight: 600 }}
                >
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted)" }}>{t("timezoneBody")}</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", display: "block", marginBottom: 6 }}>{t("weekStartsOn")}</label>
                  <div className="picks">
                    {(["monday", "sunday"] as const).map((w) => (
                      <button key={w} className="pick" role="radio" aria-checked={settings.weekStart === w} onClick={() => update({ weekStart: w })} style={{ flex: 1, justifyContent: "center" }}>
                        {w === "monday" ? t("monday") : t("sunday")}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", display: "block", marginBottom: 6 }}>{t("timeFormat")}</label>
                  <div className="picks">
                    {(["12h", "24h"] as const).map((f) => (
                      <button key={f} className="pick" role="radio" aria-checked={settings.timeFormat === f} onClick={() => update({ timeFormat: f })} style={{ flex: 1, justifyContent: "center" }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", display: "block", marginBottom: 6 }}>{t("defaultCalendar")}</label>
                  <select
                    value={settings.defaultCalendarId ?? ""}
                    onChange={(e) => update({ defaultCalendarId: e.target.value || null })}
                    style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", padding: "0 10px", fontWeight: 600 }}
                  >
                    <option value="">{t("firstVisible")}</option>
                    {calendars?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", display: "block", marginBottom: 6 }}>{t("defaultDuration")}</label>
                  <select
                    value={settings.defaultDuration}
                    onChange={(e) => update({ defaultDuration: Number(e.target.value) })}
                    style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", padding: "0 10px", fontWeight: 600 }}
                  >
                    {[15, 30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} {t("minutesShort")}</option>)}
                  </select>
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--hover)", borderRadius: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={settings.showWeekends} onChange={(e) => update({ showWeekends: e.target.checked })} />
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{t("showWeekends")}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>{settings.showWeekends ? t("on") : t("off")}</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--hover)", borderRadius: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={settings.showPastEvents} onChange={(e) => update({ showPastEvents: e.target.checked })} />
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{t("showPastEvents")}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>{settings.showPastEvents ? t("on") : t("off")}</span>
              </label>
            </div>
          )}

          {tab === "notifications" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: "var(--hover)", borderRadius: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={settings.emailNotifications} onChange={(e) => update({ emailNotifications: e.target.checked })} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{t("emailReminders")}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("emailRemindersBody")}</span>
                </span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: "var(--hover)", borderRadius: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={settings.pushNotifications} onChange={(e) => update({ pushNotifications: e.target.checked })} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{t("pushNotifications")}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("pushNotificationsBody")}</span>
                </span>
              </label>
              <div style={{ fontSize: 12, color: "var(--muted)", background: "color-mix(in srgb, var(--accent) 8%, var(--surface))", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
                {t("remindersBackground")}
              </div>
            </div>
          )}

          {tab === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: settings.aiEnabled ? "color-mix(in srgb, var(--accent) 12%, var(--surface))" : "var(--hover)", border: `1px solid ${settings.aiEnabled ? "var(--accent)" : "var(--line)"}`, borderRadius: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={settings.aiEnabled} onChange={(e) => update({ aiEnabled: e.target.checked })} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{t("enableAi")}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("enableAiBody")}</span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: settings.aiEnabled ? "var(--accent)" : "var(--muted)", background: "var(--surface)", padding: "4px 8px", borderRadius: 20, border: "1px solid var(--line)" }}>{settings.aiEnabled ? t("on") : t("off")}</span>
              </label>

              <div style={{ opacity: settings.aiEnabled ? 1 : 0.5, pointerEvents: settings.aiEnabled ? "auto" : "none" }}>
                <label style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", display: "block", marginBottom: 6 }}>{t("provider")}</label>
                <div className="picks" style={{ gap: 8 }}>
                  {(["groq", "openrouter", "custom"] as const).map((p) => (
                    <button key={p} className="pick" role="radio" aria-checked={settings.aiProvider === p} onClick={() => update({ aiProvider: p })} style={{ flex: 1, justifyContent: "center" }}>
                      {p === "groq" ? "Groq (free)" : p === "openrouter" ? "OpenRouter" : "Custom"}
                    </button>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <div>
                    <label style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>{t("model")}</label>
                    <input
                      value={settings.aiModel}
                      onChange={(e) => update({ aiModel: e.target.value })}
                      placeholder="llama-3.1-8b-instant"
                      list="ai-models"
                      style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", padding: "0 10px", fontWeight: 600, fontSize: 13 }}
                    />
                    <datalist id="ai-models">
                      <option value="llama-3.1-8b-instant" />
                      <option value="llama-3.2-11b-vision-preview" />
                      <option value="llama-3.2-90b-vision-preview" />
                      <option value="openai/gpt-4o-mini" />
                    </datalist>
                  </div>
                  <div>
                    <label style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>{t("keyPrefix")}</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", padding: "0 10px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)", background: "var(--hover)", padding: "2px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>{settings.aiKeyPrefix || "gsk_"}</span>
                      <input
                        value={settings.aiKeyPrefix}
                        onChange={(e) => update({ aiKeyPrefix: e.target.value })}
                        placeholder="gsk_"
                        title={t("keyPrefix")}
                        style={{ flex: 1, border: 0, background: "transparent", color: "var(--ink)", fontFamily: "monospace", fontSize: 12, outline: "none" }}
                      />
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>{t("apiKey")}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 0, height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", overflow: "hidden" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 12%, var(--surface))", padding: "0 10px", height: "100%", display: "grid", placeItems: "center", borderRight: "1px solid var(--line)", whiteSpace: "nowrap" }}>{settings.aiKeyPrefix || "gsk_"}</span>
                    <input
                      type="password"
                      value={settings.aiApiKey}
                      onChange={(e) => update({ aiApiKey: e.target.value })}
                      placeholder="••••••••••••••••"
                      style={{ flex: 1, border: 0, background: "transparent", color: "var(--ink)", padding: "0 10px", fontWeight: 600, fontSize: 13, outline: "none" }}
                    />
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted)" }}>Full key = <code style={{ background: "var(--hover)", padding: "2px 6px", borderRadius: 6 }}>{(settings.aiKeyPrefix || "gsk_") + (settings.aiApiKey ? "••••" : "")}</code> — stored locally, never committed. Set <code style={{ background: "var(--hover)", padding: "2px 6px", borderRadius: 6 }}>GROQ_API_KEY</code> in <code style={{ background: "var(--hover)", padding: "2px 6px", borderRadius: 6 }}>.env</code> for server proxy.</p>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 6 }}>{t("permissions")}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {([
                      ["canRead", t("readCalendars")],
                      ["canCreateEvents", t("createEvents")],
                      ["canEditEvents", t("editEvents")],
                      ["canDeleteEvents", t("deleteEvents")],
                      ["canCreateCalendars", t("createCalendars")],
                      ["canManageCalendars", t("manageCalendars")],
                    ] as const).map(([k, label]) => (
                      <label key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--hover)", borderRadius: 8, cursor: "pointer" }}>
                        <input type="checkbox" checked={(settings.aiPermissions as any)[k]} onChange={(e) => update({ aiPermissions: { ...settings.aiPermissions, [k]: e.target.checked } })} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: settings.aiVisionEnabled ? "color-mix(in srgb, var(--accent) 10%, var(--surface))" : "var(--hover)", border: `1px solid ${settings.aiVisionEnabled ? "var(--accent)" : "var(--line)"}`, borderRadius: 10, cursor: "pointer", marginTop: 12 }}>
                  <input type="checkbox" checked={settings.aiVisionEnabled} onChange={(e) => update({ aiVisionEnabled: e.target.checked })} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{t("visionAttachments")}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("visionBody")} <code>llama-3.2-11b-vision-preview</code></span>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: settings.aiVisionEnabled ? "var(--accent)" : "var(--muted)" }}>{settings.aiVisionEnabled ? t("on") : t("off")}</span>
                </label>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted)" }}>{t("attachmentsLocal")}</p>
              </div>
            </div>
          )}

          {tab === "account" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "var(--hover)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 4 }}>{t("workspace")}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                  {t("signedInViaSupabase")} <code style={{ background: "var(--surface)", padding: "2px 6px", borderRadius: 6, border: "1px solid var(--line)" }}>membership</code>.
                </div>
              </div>

              <button
                onClick={handleSignOut}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 40, borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--now)", fontWeight: 700, cursor: "pointer" }}
              >
                <LogOutIcon size={16} /> {t("signOut")}
              </button>

              <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                Tempo Agenda · <a href="https://github.com/Gabrieldevgit/Agenda" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>GitHub</a> · v0.1
              </div>
            </div>
          )}
        </div>

        <div className="acts" style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", flex: "none" }}>
          <span style={{ flex: 1 }} />
          <button className="btn primary" onClick={onClose}>{t("doneButton")}</button>
        </div>
      </div>
    </div>
  );
}
