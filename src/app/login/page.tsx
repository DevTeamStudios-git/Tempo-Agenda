"use client";
import {safeReturnPath} from "../../../shared/mobile-policy";
import {isNativeApp,postNative} from "@/lib/native/bridge";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function GoogleIcon(props: { size?: number }) {
  return (
    <svg width={props.size ?? 18} height={props.size ?? 18} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-1 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.52H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.98 6.98 0 0 1 5.48 12c0-.72.13-1.43.36-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.42 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState<{ text: string; type: "error" | "success" | "info" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setMsg({ text: "Email and password are required.", type: "error" });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMsg({ text: error.message, type: "error" });
        else {
          setMsg({ text: "Signed in — redirecting…", type: "success" });
          const next=new URL(window.location.href).searchParams.get("next");
          window.location.href = safeReturnPath(next);
        }
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) setMsg({ text: error.message, type: "error" });
        else setMsg({ text: "Check your email for confirmation link.", type: "success" });
      }
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    if(isNativeApp()){postNative({type:"tempo:oauth",provider:"google"});return;}
    setGoogleLoading(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMsg({ text: error.message, type: "error" });
      setGoogleLoading(false);
    }
    // on success Supabase redirects, so no need to reset loading
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: `radial-gradient(900px 500px at 20% -10%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%), radial-gradient(800px 400px at 90% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 60%), var(--bg)`,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 24,
          boxShadow: "var(--shadow)",
          padding: 32,
          color: "var(--ink)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span className="mark" style={{ width: 30, height: 30, borderRadius: 9 }} />
          <span style={{ font: "700 20px var(--font-display)", letterSpacing: "-.02em" }}>Tempo</span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--muted)",
              background: "var(--hover)",
              padding: "5px 10px",
              borderRadius: 20,
            }}
          >
            Agenda
          </span>
        </div>

        <h1 style={{ margin: 0, font: "700 26px/1.1 var(--font-display)", letterSpacing: "-.02em" }}>
          {mode === "signin" ? "Welcome back" : "Create account"}
        </h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14, lineHeight: 1.4 }}>
          {mode === "signin" ? "Sign in to your workspace" : "Start organizing your time"}
        </p>

        <button
          onClick={signInWithGoogle}
          disabled={googleLoading}
          style={{
            marginTop: 22,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            height: 44,
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "var(--surface)",
            fontWeight: 600,
            cursor: "pointer",
            color: "var(--ink)",
            opacity: googleLoading ? 0.7 : 1,
          }}
        >
          <GoogleIcon /> {googleLoading ? "Redirecting…" : "Continue with Google"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0", color: "var(--muted)", fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          or
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>

        <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                height: 44,
                padding: "0 12px",
                border: "1px solid var(--line)",
                borderRadius: 12,
                background: "var(--bg)",
                color: "var(--ink)",
                outline: "none",
                fontSize: 14,
                fontWeight: 500,
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
            Password
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                height: 44,
                padding: "0 12px",
                border: "1px solid var(--line)",
                borderRadius: 12,
                background: "var(--bg)",
                color: "var(--ink)",
                outline: "none",
                fontSize: 14,
                fontWeight: 500,
              }}
            />
          </label>

          {msg && (
            <div
              role="alert"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.4,
                background: msg.type === "error" ? "color-mix(in srgb, var(--now) 12%, var(--surface))" : msg.type === "success" ? "color-mix(in srgb, #5C8A3A 14%, var(--surface))" : "var(--hover)",
                border: `1px solid ${msg.type === "error" ? "color-mix(in srgb, var(--now) 30%, var(--line))" : "var(--line)"}`,
                color: msg.type === "error" ? "var(--now)" : "var(--ink)",
              }}
            >
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn primary"
            style={{ height: 44, borderRadius: 12, justifyContent: "center", fontSize: 15, marginTop: 2, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p style={{ margin: "16px 0 0", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}
            style={{ background: "transparent", border: 0, color: "var(--accent)", fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>

      <p style={{ marginTop: 16, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
        By continuing you agree to Tempo’s Terms & Privacy.
      </p>
    </div>
  );
}
