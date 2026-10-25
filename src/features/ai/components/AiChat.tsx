"use client";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { AssistantPermissions } from "./AssistantPermissions";
import { useQueryClient } from "@tanstack/react-query";
import type { AssistantPlanView } from "@/features/calendar/types";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/lib/icons";
import { useSettings } from "@/lib/settings";
import { useProviderModels } from "../hooks/useProviderModels";
import { personalApiKey } from "@/lib/ai/catalog";
import {
  createAttachment,
  type ImageAttachment,
} from "../lib/imageAttachments";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  images?: string[];
  plan?: AssistantPlanView;
};

export function AiChat({
  open,
  onClose,
  workspaceId,
  timeZone,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  timeZone: string;
}) {
  const client = useQueryClient();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef, onClose);
  async function apply(id: string, approved: boolean) {
    setSending(true);
    try {
      const r = await fetch("/api/ai/actions/" + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message ?? "Action failed");
      setMsgs((old) =>
        old.map((m) =>
          m.plan?.id === id
            ? {
                ...m,
                plan: { ...m.plan, state: data.state, results: data.results },
              }
            : m,
        ),
      );
      await Promise.all(
        ["events", "calendars", "tasks"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    } catch (e) {
      setMsgs((old) => [
        ...old,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Error: " + (e as Error).message,
        },
      ]);
    } finally {
      setSending(false);
    }
  }
  const { settings, update } = useSettings();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: "0",
      role: "assistant",
      text: "Hi! Open Assistant permissions to let me read your schedule or propose calendar changes. You review changes before I apply them.",
    },
  ]);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const messageEnd=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(open)messageEnd.current?.scrollIntoView({block:"end"});},[msgs,sending,open]);

  const prov = settings.aiProvider;
  const apiKey = personalApiKey(prov, settings.aiApiKey, settings.aiKeyPrefix);
  const live = useProviderModels(prov, apiKey, open && settings.aiEnabled);
  const currentModel =
    live.models.find((m) => m.id === settings.aiModel) ??
    live.models.find((m) => m.id === live.defaultModel);
  const canAttach = !!(settings.aiVisionEnabled && currentModel?.vision);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const activeUrls = urls.current;
    return () => {
      for (const url of activeUrls) URL.revokeObjectURL(url);
    };
  }, []);
  if (!open) return null;

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(
      0,
      Math.max(0, 4 - attachments.length),
    );
    if (!files.length) return;
    if (!canAttach) {
      alert(
        "Vision is off or current model doesn't support images. Enable vision and choose an image-capable model from the live model list.",
      );
      return;
    }
    for (const f of files.slice(0, 4 - attachments.length)) {
      try {
        const att = await createAttachment(f);
        urls.current.add(att.previewUrl);
        setAttachments((a) => [...a, att]);
      } catch (err) {
        alert((err as Error).message);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send() {
    if (sending || live.loading) return;
    if (!input.trim() && !attachments.length) return;
    if (!settings.aiEnabled) {
      setMsgs((m) => [
        ...m,
        {
          id: Date.now().toString(),
          role: "assistant",
          text: "AI is disabled. Enable it in Settings → AI Assistant.",
        },
      ]);
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
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          timeZone,
          message: toSend,
          images: canAttach ? imgs : [],
          model: settings.aiModel,
          provider: settings.aiProvider,
          apiKey,
          history: msgs
            .filter((m) => m.id !== "0" && !m.text.startsWith("Error:"))
            .slice(-12)
            .map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "AI request failed");
      if (typeof data?.reply !== "string" || !data.reply.trim())
        throw new Error("The provider returned no answer.");
      if (data.model && data.model !== settings.aiModel)
        update({ aiModel: data.model });
      const text = data.reply;
      setMsgs((m) => [
        ...m,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text,
          plan: data.plan,
        },
      ]);
    } catch (err) {
      setMsgs((m) => [
        ...m,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: `Error: ${String((err as Error).message)}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="ov"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ zIndex: 70 }}
    >
      <div
        ref={dialogRef}
        className="dlg"
        role="dialog"
        aria-modal="true"
        aria-label="AI Assistant"
        style={{
          maxWidth: 560,
          width: "100%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: "1px solid var(--line)",
            flex: "none",
          }}
        >
          <div style={{ fontWeight: 700, flex: 1 }}>
            AI Assistant {settings.aiEnabled ? "· On" : "· Off"}
          </div>
          <span
            style={{
              fontSize: 11,
              color: "var(--muted)",
              background: "var(--hover)",
              padding: "4px 8px",
              borderRadius: 20,
            }}
          >
            {prov} · {currentModel?.label || settings.aiModel || "Auto"}
          </span>
          <button className="icon" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <AssistantPermissions />
        {settings.aiEnabled && (
          <p
            className="option-help"
            role="status"
            style={{ padding: "0 16px" }}
          >
            {live.loading
              ? "Checking available models…"
              : live.error ||
                "Model: " +
                  (currentModel?.label ?? settings.aiModel) +
                  " · " +
                  (apiKey ? "Personal key" : "Server key")}
          </p>
        )}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {msgs.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                background:
                  m.role === "user" ? "var(--accent)" : "var(--hover)",
                color: m.role === "user" ? "var(--accent-ink)" : "var(--ink)",
                padding: "10px 12px",
                borderRadius: 12,
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              <div>{m.text}</div>
              {m.plan && (
                <div style={{ marginTop: 12 }}>
                  {m.plan.actions.map((a, i) => (
                    <p key={i} style={{ overflowWrap: "anywhere" }}>
                      {a.summary}
                    </p>
                  ))}
                  {m.plan.state === "pending" ? (
                    <>
                      <button
                        className="btn primary"
                        disabled={sending}
                        onClick={() => void apply(m.plan!.id, true)}
                      >
                        Apply changes
                      </button>{" "}
                      <button
                        className="btn"
                        disabled={sending}
                        onClick={() => void apply(m.plan!.id, false)}
                      >
                        Discard
                      </button>
                    </>
                  ) : (
                    <p role="status">{m.plan.state}</p>
                  )}
                  {m.plan.results?.map((r, i) => (
                    <p key={i}>
                      {r.ok ? "✓ " : "Failed: "}
                      {r.message}
                    </p>
                  ))}
                </div>
              )}
              {m.images?.length ? (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {m.images.map((src, i) => (
                    <Image
                      unoptimized
                      width={64}
                      height={64}
                      key={i}
                      src={src}
                      alt="attachment"
                      style={{
                        width: 60,
                        height: 60,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {sending && (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Thinking…</div>
          )}
          <div ref={messageEnd}/>
        </div>

        {attachments.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "0 16px 8px",
              overflowX: "auto",
              flex: "none",
            }}
          >
            {attachments.map((a) => (
              <div key={a.id} style={{ position: "relative", flex: "none" }}>
                <Image
                  unoptimized
                  width={64}
                  height={64}
                  src={a.previewUrl}
                  alt={a.file.name}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                  }}
                />
                <button
                  onClick={() =>
                    setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                  }
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 12,
            borderTop: "1px solid var(--line)",
            flex: "none",
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={onPickFiles}
            style={{ display: "none" }}
          />
          <button
            className="icon"
            type="button"
            aria-label="Attach images"
            title={
              canAttach
                ? "Attach images (vision)"
                : "Enable vision + use a vision model to attach images"
            }
            onClick={() => fileRef.current?.click()}
            disabled={!canAttach}
            style={{ opacity: canAttach ? 1 : 0.4 }}
          >
            📎
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={canAttach ? "Ask AI or attach an image…" : "Ask AI…"}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--bg)",
              color: "var(--ink)",
              padding: "0 12px",
              outline: "none",
            }}
          />
          <button
            className="btn primary"
            onClick={send}
            disabled={sending || (!input.trim() && !attachments.length)}
            style={{ height: 40, borderRadius: 12, padding: "0 16px" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
