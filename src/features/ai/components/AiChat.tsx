"use client";
import { useRef, useState } from "react";
import { CloseIcon } from "@/lib/icons";
import { useSettings } from "@/lib/settings";
import { createAttachment, isVisionModel, type ImageAttachment } from "../lib/imageAttachments";
import { useAppI18n } from "@/lib/i18n";

type Msg = { id: string; role: "user" | "assistant"; text: string; images?: string[] };

export function AiChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useAppI18n();
  const { settings } = useSettings();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: "0", role: "assistant", text: t("aiWelcome") },
  ]);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const canAttach = settings.aiVisionEnabled && isVisionModel(settings.aiModel);
  const fullKey = (settings.aiKeyPrefix || "") + (settings.aiApiKey || "");

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (!canAttach) {
      alert(t("visionAttachDisabled"));
      return;
    }
    for (const f of files.slice(0, 4 - attachments.length)) {
      try {
        const att = await createAttachment(f);
        setAttachments((a) => [...a, att]);
      } catch (err) {
        alert((err as Error).message);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send() {
    if (!input.trim() && !attachments.length) return;
    if (!settings.aiEnabled) {
      setMsgs((m) => [...m, { id: Date.now().toString(), role: "assistant", text: t("aiDisabled") }]);
      return;
    }
    if (!fullKey) {
      setMsgs((m) => [...m, { id: Date.now().toString(), role: "assistant", text: t("missingApiKey") }]);
      return;
    }

    const userMsg: Msg = {
      id: Date.now().toString(),
      role: "user",
      text: input.trim() || "(image)",
      images: attachments.map((a) => a.previewUrl),
    };
    setMsgs((m) => [...m, userMsg]);
    const toSend = input;
    const imgs = attachments.map((a) => a.base64);
    setInput("");
    setAttachments([]);
    setSending(true);

    try {
      // Call server proxy (keeps key secret). Falls back to mock if not configured.
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: toSend,
          images: canAttach ? imgs : [],
          model: settings.aiModel,
          provider: settings.aiProvider,
          // never send raw key from client if server has GROQ_API_KEY; server will use env
          // we send prefix+key only if user wants client-side (demo)
          hasKey: !!fullKey,
        }),
      });
      const data: any = await res.json().catch(() => ({}));
      const text = data?.reply || data?.error?.message || `Mock: I would ${toSend.toLowerCase().includes("create") ? "create an event" : "help"} — configure GROQ_API_KEY on server for real Groq calls.`;
      setMsgs((m) => [...m, { id: (Date.now() + 1).toString(), role: "assistant", text }]);
    } catch (err) {
      setMsgs((m) => [...m, { id: (Date.now() + 1).toString(), role: "assistant", text: `Error: ${String((err as Error).message)}` }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ zIndex: 70 }}>
      <div className="dlg" role="dialog" aria-modal="true" aria-label={t("aiAssistant")} style={{ maxWidth: 560, display: "flex", flexDirection: "column", maxHeight: "80vh", padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line)", flex: "none" }}>
          <div style={{ fontWeight: 700, flex: 1 }}>{t("aiAssistant")} {settings.aiEnabled ? `· ${t("on")}` : `· ${t("off")}`}</div>
          <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--hover)", padding: "4px 8px", borderRadius: 20 }}>{settings.aiProvider} · {settings.aiModel.slice(0, 18)}</span>
          <button className="icon" aria-label={t("close")} onClick={onClose}><CloseIcon /></button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {msgs.map((m) => (
            <div key={m.id} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "user" ? "var(--accent)" : "var(--hover)", color: m.role === "user" ? "var(--accent-ink)" : "var(--ink)", padding: "10px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.4 }}>
              <div>{m.text}</div>
              {m.images?.length ? (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {m.images.map((src, i) => <img key={i} src={src} alt={t("attachment")} style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />)}
                </div>
              ) : null}
            </div>
          ))}
          {sending && <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("thinking")}</div>}
        </div>

        {attachments.length > 0 && (
          <div style={{ display: "flex", gap: 8, padding: "0 16px 8px", overflowX: "auto", flex: "none" }}>
            {attachments.map((a) => (
              <div key={a.id} style={{ position: "relative", flex: "none" }}>
                <img src={a.previewUrl} alt={a.file.name} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                <button
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 12, cursor: "pointer" }}
                  aria-label={t("remove")}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, borderTop: "1px solid var(--line)", flex: "none" }}>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={onPickFiles} style={{ display: "none" }} />
          <button
            className="icon"
            type="button"
            aria-label={t("attachImages")}
            title={canAttach ? t("attachImagesVision") : t("enableVisionAttach")}
            onClick={() => fileRef.current?.click()}
            disabled={!canAttach}
            style={{ opacity: canAttach ? 1 : 0.4 }}
          >
            📎
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={canAttach ? t("askAiOrAttach") : t("askAi")}
            style={{ flex: 1, height: 40, borderRadius: 12, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", padding: "0 12px", outline: "none" }}
          />
          <button className="btn primary" onClick={send} disabled={sending || (!input.trim() && !attachments.length)} style={{ height: 40, borderRadius: 12, padding: "0 16px" }}>
            Send
          </button>
        </div>
        <div style={{ padding: "0 12px 10px", fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
          {t("prefixShown")} <code style={{ background: "var(--hover)", padding: "2px 6px", borderRadius: 6 }}>{settings.aiKeyPrefix || "gsk_"}</code> {t("aiFooter")}
        </div>
      </div>
    </div>
  );
}
