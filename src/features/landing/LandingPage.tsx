"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Lang = "en" | "fr";

type Feature = {
  title: string;
  body: string;
};

type LandingCopy = {
  eyebrow: string;
  title: string;
  titleHighlight: string;
  body: string;
  primaryCta: string;
  secondaryCta: string;
  proof: string;
  featureTitle: string;
  featureBody: string;
  features: Feature[];
  bottomTitle: string;
  bottomBody: string;
  bottomCta: string;
  footer: string;
};

const defaults: Record<Lang, LandingCopy> = {
  en: {
    eyebrow: "Modern agenda workspace",
    title: "Your time,",
    titleHighlight: "organized beautifully.",
    body: "A focused agenda for planning real days, not filling dashboards with noise. Move between Day, Week, Month, Agenda, Book and Year views, create events quickly, and keep your schedule close at hand.",
    primaryCta: "Open your agenda",
    secondaryCta: "Explore features",
    proof: "Drag and drop · Realtime updates · Command palette · Context actions",
    featureTitle: "A calendar that feels intentional.",
    featureBody: "A public home for the product, with enough personality to explain why the workspace exists before asking anyone to sign in.",
    features: [
      { title: "Plan at the right level", body: "Jump between day, week, month, agenda, book and year views depending on the task in front of you." },
      { title: "Move things naturally", body: "Create events quickly, drag and resize them, duplicate them, and use contextual actions when you need precision." },
      { title: "Stay in sync", body: "Realtime event updates keep the workspace current across connected clients without turning the interface into a control room." },
      { title: "Work faster", body: "Use search, keyboard shortcuts, the command palette, reminders and built-in productivity tools to reduce friction." },
    ],
    bottomTitle: "Ready when your day starts.",
    bottomBody: "Sign in to continue to your workspace and build the schedule around how you actually work.",
    bottomCta: "Continue to Tempo",
    footer: "Tempo · A focused agenda workspace",
  },
  fr: {
    eyebrow: "Espace agenda moderne",
    title: "Votre temps,",
    titleHighlight: "magnifiquement organisé.",
    body: "Un agenda pensé pour planifier vos vraies journées, sans transformer votre écran en tableau de bord bruyant. Passez de la vue Jour à Semaine, Mois, Agenda, Livre ou Année.",
    primaryCta: "Ouvrir mon agenda",
    secondaryCta: "Découvrir les fonctionnalités",
    proof: "Glisser-déposer · Mises à jour en temps réel · Palette de commandes · Actions contextuelles",
    featureTitle: "Un calendrier qui semble vraiment pensé.",
    featureBody: "Une vraie page d’accueil pour présenter le produit avec personnalité avant de demander une connexion.",
    features: [
      { title: "Planifiez au bon niveau", body: "Passez des vues jour, semaine, mois, agenda, livre et année selon ce que vous devez faire." },
      { title: "Déplacez vos rendez-vous naturellement", body: "Créez, déplacez, redimensionnez et dupliquez vos événements avec des actions contextuelles précises." },
      { title: "Restez synchronisé", body: "Les mises à jour en temps réel gardent l’espace de travail actuel sur les clients connectés." },
      { title: "Travaillez plus vite", body: "Utilisez la recherche, les raccourcis, la palette de commandes, les rappels et les outils de productivité." },
    ],
    bottomTitle: "Prêt quand votre journée commence.",
    bottomBody: "Connectez-vous à votre espace de travail et construisez votre agenda autour de votre façon de travailler.",
    bottomCta: "Continuer vers Tempo",
    footer: "Tempo · Un espace agenda pensé pour travailler",
  },
};

function loadDrafts(): Record<Lang, LandingCopy> {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem("tempo_landing_draft_v1");
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<Lang, LandingCopy>>;
    return {
      en: { ...defaults.en, ...(parsed.en ?? {}), features: parsed.en?.features ?? defaults.en.features },
      fr: { ...defaults.fr, ...(parsed.fr ?? {}), features: parsed.fr?.features ?? defaults.fr.features },
    };
  } catch {
    return defaults;
  }
}

export function LandingPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [copy, setCopy] = useState<Record<Lang, LandingCopy>>(defaults);
  const [devMode, setDevMode] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [editorSaved, setEditorSaved] = useState(false);

  useEffect(() => {
    const browserLang = window.navigator.language.toLowerCase();
    const stored = window.localStorage.getItem("tempo_language");
    setLang(stored === "fr" || stored === "en" ? stored : browserLang.startsWith("fr") ? "fr" : "en");
    setCopy(loadDrafts());

    fetch("/api/dev-auth", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : { authenticated: false })
      .then((data) => setDevMode(Boolean(data.authenticated)))
      .catch(() => setDevMode(false));
  }, []);

  const t = copy[lang];
  const devLabel = lang === "fr" ? "Mode Dev" : "Dev mode";
  const signInLabel = lang === "fr" ? "Connexion" : "Sign in";
  const languageLabel = lang === "fr" ? "Langue" : "Language";

  function changeLanguage(next: Lang) {
    setLang(next);
    window.localStorage.setItem("tempo_language", next);
  }

  async function submitDevAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/dev-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuthError(data.error || (lang === "fr" ? "Identifiants invalides." : "Invalid credentials."));
        return;
      }
      setDevMode(true);
      setAuthOpen(false);
      setPassword("");
    } catch {
      setAuthError(lang === "fr" ? "Impossible de contacter le serveur." : "Could not reach the server.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function disableDevMode() {
    await fetch("/api/dev-auth", { method: "DELETE" }).catch(() => undefined);
    setDevMode(false);
    setEditorOpen(false);
  }

  function updateCopy(patch: Partial<LandingCopy>) {
    setCopy((current) => ({ ...current, [lang]: { ...current[lang], ...patch } }));
  }

  function saveDraft() {
    window.localStorage.setItem("tempo_landing_draft_v1", JSON.stringify(copy));
    setEditorSaved(true);
    window.setTimeout(() => setEditorSaved(false), 1800);
  }

  function resetDraft() {
    const next = { ...copy, [lang]: defaults[lang] };
    setCopy(next);
    window.localStorage.setItem("tempo_landing_draft_v1", JSON.stringify(next));
    setEditorSaved(false);
  }

  const editorDescription = useMemo(
    () => lang === "fr" ? "Les modifications sont enregistrées localement pour ce navigateur. La publication serveur pourra venir dans une prochaine étape." : "Changes are stored locally in this browser. Server publishing can be added as a next step.",
    [lang]
  );

  return (
    <main className="landing">
      <style>{`
        .landing { min-height: 100vh; overflow: hidden; background: radial-gradient(900px 520px at 12% -5%, color-mix(in srgb, #7c72ff 22%, transparent), transparent 64%), radial-gradient(820px 500px at 92% 8%, color-mix(in srgb, #4aa7ff 16%, transparent), transparent 62%), linear-gradient(180deg, #0b0d16 0%, #0d1019 55%, #111521 100%); color: #fff; position: relative; }
        .landing::before { content: ""; position: absolute; inset: 0; pointer-events: none; background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size: 48px 48px; mask-image: linear-gradient(to bottom, rgba(0,0,0,.75), transparent 72%); }
        .landing-shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; position: relative; z-index: 1; }
        .landing-nav { height: 76px; display: flex; align-items: center; gap: 20px; border-bottom: 1px solid rgba(255,255,255,.08); }
        .landing-brand { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; color: #fff; font: 700 21px/1 var(--font-display); letter-spacing: -.03em; }
        .landing-mark { width: 34px; height: 34px; border-radius: 11px; position: relative; background: linear-gradient(135deg, #7f7bff, #5c88ff); box-shadow: 0 10px 28px rgba(92,136,255,.26); }
        .landing-mark::before { content: ""; position: absolute; left: 8px; top: 8px; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,.92); border-radius: 3px; }
        .landing-mark::after { content: ""; position: absolute; right: 6px; bottom: 6px; width: 7px; height: 7px; border-radius: 50%; background: #fff; }
        .landing-nav-links { display: flex; align-items: center; gap: 6px; margin-left: auto; }
        .landing-nav-link { color: #adb7d2; text-decoration: none; font-size: 13px; font-weight: 600; padding: 9px 11px; border-radius: 10px; transition: .18s ease; }
        .landing-nav-link:hover { color: #fff; background: rgba(255,255,255,.06); }
        .landing-top-actions { display: flex; align-items: center; gap: 8px; }
        .landing-language { display: inline-flex; align-items: center; gap: 2px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); border-radius: 11px; padding: 3px; }
        .landing-language button { min-width: 36px; height: 30px; padding: 0 9px; border: 0; border-radius: 8px; background: transparent; color: #8995ae; font-size: 11px; font-weight: 800; cursor: pointer; }
        .landing-language button.active { background: rgba(255,255,255,.1); color: #fff; }
        .landing-dev-toggle { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 11px; border: 1px solid rgba(255,255,255,.1); border-radius: 11px; background: rgba(255,255,255,.04); color: #cdd5e8; font-size: 12px; font-weight: 800; cursor: pointer; transition: .18s ease; }
        .landing-dev-toggle:hover { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.18); }
        .landing-dev-switch { width: 27px; height: 16px; border-radius: 999px; background: rgba(255,255,255,.16); padding: 2px; transition: .18s ease; }
        .landing-dev-switch::after { content: ""; display: block; width: 12px; height: 12px; border-radius: 50%; background: #9aa5bb; transition: .18s ease; }
        .landing-dev-toggle.on .landing-dev-switch { background: #6f82ff; }
        .landing-dev-toggle.on .landing-dev-switch::after { transform: translateX(11px); background: #fff; }
        .landing-signin { color: #fff; text-decoration: none; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.05); border-radius: 11px; padding: 10px 14px; font-weight: 700; font-size: 13px; transition: .18s ease; backdrop-filter: blur(14px); }
        .landing-signin:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.22); }
        .landing-hero { padding: 78px 0 58px; display: grid; grid-template-columns: minmax(0, 1.03fr) minmax(0, .97fr); gap: 54px; align-items: center; }
        .landing-eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #b9c3dc; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.045); border-radius: 999px; padding: 8px 12px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
        .landing-eyebrow i { width: 7px; height: 7px; border-radius: 50%; background: #6f9cff; box-shadow: 0 0 16px rgba(111,156,255,.8); }
        .landing-title { margin: 18px 0 0; max-width: 730px; font: 700 clamp(46px, 6vw, 78px)/.98 var(--font-display); letter-spacing: -.055em; }
        .landing-title span { background: linear-gradient(100deg, #dfe5ff 8%, #9f9bff 44%, #6ba9ff 86%); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .landing-copy { margin: 22px 0 0; max-width: 620px; color: #aeb8ce; font-size: 17px; line-height: 1.65; }
        .landing-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 30px; }
        .landing-cta, .landing-cta-secondary { min-height: 46px; padding: 0 17px; border-radius: 12px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; transition: .18s ease; }
        .landing-cta { color: #101421; background: linear-gradient(135deg, #d7deff, #9ea5ff); box-shadow: 0 14px 34px rgba(112,126,255,.24); }
        .landing-cta:hover { transform: translateY(-1px); filter: brightness(1.03); }
        .landing-cta-secondary { color: #e5eaff; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.11); cursor: pointer; }
        .landing-cta-secondary:hover { background: rgba(255,255,255,.08); }
        .landing-proof { margin-top: 17px; color: #7f8aa4; font-size: 12px; }
        .landing-product { position: relative; min-height: 470px; display: grid; place-items: center; }
        .landing-orb { position: absolute; width: 330px; height: 330px; border-radius: 50%; background: radial-gradient(circle, rgba(118,129,255,.23), rgba(118,129,255,0) 68%); filter: blur(8px); }
        .landing-dashboard { position: relative; width: min(100%, 560px); border-radius: 22px; border: 1px solid rgba(255,255,255,.1); background: rgba(17,21,33,.84); box-shadow: 0 38px 90px rgba(0,0,0,.5), 0 0 0 8px rgba(255,255,255,.018); overflow: hidden; backdrop-filter: blur(18px); transform: perspective(1200px) rotateY(-4deg) rotateX(2deg); }
        .landing-windowbar { height: 44px; display: flex; align-items: center; gap: 7px; padding: 0 15px; border-bottom: 1px solid rgba(255,255,255,.07); }
        .landing-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.2); }
        .landing-window-title { margin-left: 6px; font-size: 10px; color: #79839b; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
        .landing-dashboard-body { display: grid; grid-template-columns: 118px 1fr; min-height: 340px; }
        .landing-side { padding: 14px 11px; border-right: 1px solid rgba(255,255,255,.07); }
        .landing-side-item { height: 31px; display: flex; align-items: center; gap: 8px; padding: 0 9px; border-radius: 9px; color: #76819a; font-size: 10px; font-weight: 600; margin-bottom: 4px; }
        .landing-side-item.active { color: #edf1ff; background: rgba(125,131,255,.14); }
        .landing-side-dot { width: 6px; height: 6px; border-radius: 50%; background: #7385ff; }
        .landing-calendar { padding: 17px 16px 16px; }
        .landing-calendar-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .landing-calendar-title { font: 700 18px var(--font-display); color: #f4f6ff; }
        .landing-calendar-actions { display: flex; gap: 5px; }
        .landing-mini-button { width: 22px; height: 22px; border-radius: 7px; background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.06); }
        .landing-week { display: grid; grid-template-columns: 46px repeat(5, 1fr); gap: 0; border: 1px solid rgba(255,255,255,.07); border-radius: 13px; overflow: hidden; }
        .landing-week > div { min-height: 50px; border-right: 1px solid rgba(255,255,255,.055); border-bottom: 1px solid rgba(255,255,255,.055); }
        .landing-week-head { min-height: 38px !important; display: grid; place-items: center; color: #76819a; font-size: 9px; font-weight: 700; }
        .landing-time { min-height: 78px !important; display: flex; justify-content: flex-end; padding: 7px 6px 0 0; color: #5e6980; font-size: 8px; }
        .landing-cell { position: relative; min-height: 78px !important; }
        .landing-event { position: absolute; left: 5px; right: 5px; border-radius: 7px; padding: 6px 7px; font-size: 8px; line-height: 1.25; font-weight: 700; color: #eff3ff; background: linear-gradient(135deg, rgba(104,106,255,.85), rgba(83,157,255,.72)); box-shadow: 0 5px 16px rgba(84,111,255,.18); }
        .landing-event.secondary { background: linear-gradient(135deg, rgba(199,93,153,.75), rgba(150,102,255,.72)); }
        .landing-event.green { background: linear-gradient(135deg, rgba(55,171,165,.75), rgba(73,137,255,.65)); }
        .landing-event em { display: block; font-style: normal; opacity: .7; font-size: 7px; margin-top: 2px; font-weight: 500; }
        .landing-section { padding: 24px 0 88px; }
        .landing-section-head { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
        .landing-section-title { margin: 0; font: 700 30px/1.08 var(--font-display); letter-spacing: -.03em; }
        .landing-section-copy { margin: 7px 0 0; color: #8e99b2; max-width: 620px; font-size: 14px; }
        .landing-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
        .landing-card { min-height: 180px; padding: 19px; border-radius: 16px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.035); box-shadow: inset 0 1px 0 rgba(255,255,255,.03); }
        .landing-card-icon { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: linear-gradient(135deg, rgba(123,128,255,.18), rgba(76,154,255,.1)); color: #bfc8ff; font-size: 11px; font-weight: 800; margin-bottom: 18px; }
        .landing-card h3 { margin: 0; font: 700 16px var(--font-display); letter-spacing: -.02em; }
        .landing-card p { margin: 7px 0 0; color: #8f99b0; font-size: 12.5px; line-height: 1.55; }
        .landing-bottom { margin: 8px 0 38px; padding: 26px; border-radius: 18px; border: 1px solid rgba(255,255,255,.08); background: linear-gradient(110deg, rgba(118,121,255,.12), rgba(70,159,255,.06)); display: flex; align-items: center; justify-content: space-between; gap: 22px; }
        .landing-bottom h2 { margin: 0; font: 700 22px var(--font-display); letter-spacing: -.03em; }
        .landing-bottom p { margin: 5px 0 0; color: #96a0b8; font-size: 13px; }
        .landing-footer { padding: 24px 0 38px; border-top: 1px solid rgba(255,255,255,.07); color: #68738b; display: flex; justify-content: space-between; gap: 20px; font-size: 11px; }
        .landing-footer a { color: #8f9ab4; text-decoration: none; }
        .landing-footer a:hover { color: #fff; }
        .dev-toolbar { position: fixed; right: 18px; bottom: 18px; z-index: 80; display: flex; align-items: center; gap: 8px; padding: 9px; background: rgba(11,14,24,.88); border: 1px solid rgba(120,138,255,.38); box-shadow: 0 18px 50px rgba(0,0,0,.45); border-radius: 14px; backdrop-filter: blur(18px); }
        .dev-badge { padding: 7px 9px; border-radius: 9px; background: rgba(111,130,255,.15); color: #cbd2ff; font-size: 10px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
        .dev-toolbar button { height: 32px; border: 1px solid rgba(255,255,255,.12); border-radius: 9px; padding: 0 10px; color: #eef1ff; background: rgba(255,255,255,.05); font-size: 11px; font-weight: 800; cursor: pointer; }
        .dev-toolbar button:hover { background: rgba(255,255,255,.1); }
        .modal-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(3,5,10,.7); display: grid; place-items: center; padding: 20px; backdrop-filter: blur(10px); }
        .modal-card { width: min(580px, 100%); max-height: min(840px, calc(100vh - 40px)); overflow: auto; border: 1px solid rgba(255,255,255,.11); border-radius: 20px; background: #111622; color: #fff; box-shadow: 0 30px 100px rgba(0,0,0,.55); padding: 22px; }
        .modal-card h2 { margin: 0; font: 700 24px var(--font-display); letter-spacing: -.03em; }
        .modal-sub { color: #8e99b2; font-size: 12px; line-height: 1.55; margin: 7px 0 18px; }
        .modal-field { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
        .modal-field label { color: #9ba6bf; font-size: 11px; font-weight: 800; }
        .modal-field input, .modal-field textarea { width: 100%; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: rgba(255,255,255,.04); color: #fff; padding: 10px 11px; font: inherit; outline: none; }
        .modal-field textarea { min-height: 82px; resize: vertical; }
        .modal-field input:focus, .modal-field textarea:focus { border-color: #6f82ff; box-shadow: 0 0 0 3px rgba(111,130,255,.12); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
        .modal-actions button { height: 38px; border-radius: 10px; padding: 0 13px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); color: #fff; font-weight: 800; cursor: pointer; }
        .modal-actions .primary { background: #707fff; border-color: transparent; color: #0c1020; }
        .modal-error { margin-top: 11px; padding: 10px 11px; border-radius: 10px; background: rgba(255,94,117,.09); border: 1px solid rgba(255,94,117,.2); color: #ffadb9; font-size: 12px; }
        .editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .editor-full { grid-column: 1 / -1; }
        .editor-section { padding: 14px; margin-top: 14px; border: 1px solid rgba(255,255,255,.08); border-radius: 14px; background: rgba(255,255,255,.025); }
        .editor-section h3 { margin: 0 0 9px; font: 700 14px var(--font-display); }
        .editor-feature { display: grid; grid-template-columns: 90px 1fr; gap: 9px; margin-top: 10px; }
        .editor-feature textarea { min-height: 62px; }
        .editor-note { color: #6f7a93; font-size: 11px; margin-top: 8px; line-height: 1.5; }
        @media (max-width: 980px) { .landing-hero { grid-template-columns: 1fr; } .landing-product { min-height: 380px; } .landing-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 760px) { .landing-nav-links { display: none; } .landing-top-actions { margin-left: auto; } .landing-dev-toggle span.label { display: none; } .editor-grid { grid-template-columns: 1fr; } .editor-full { grid-column: auto; } .editor-feature { grid-template-columns: 1fr; } }
        @media (max-width: 680px) { .landing-shell { width: min(100% - 24px, 1180px); } .landing-nav { height: 66px; gap: 8px; } .landing-brand { margin-right: auto; } .landing-hero { padding: 54px 0 34px; gap: 22px; } .landing-title { font-size: clamp(42px, 13vw, 60px); } .landing-copy { font-size: 15px; } .landing-product { min-height: 300px; } .landing-dashboard { transform: none; } .landing-dashboard-body { grid-template-columns: 92px 1fr; min-height: 270px; } .landing-side { padding: 11px 8px; } .landing-calendar { padding: 12px 10px; } .landing-week { grid-template-columns: 32px repeat(5,1fr); } .landing-grid { grid-template-columns: 1fr; } .landing-bottom { flex-direction: column; align-items: flex-start; } .landing-footer { flex-direction: column; } .landing-language { display: none; } }
      `}</style>

      <div className="landing-shell">
        <nav className="landing-nav" aria-label="Landing">
          <Link className="landing-brand" href="/">
            <span className="landing-mark" aria-hidden="true" />
            <span>Tempo</span>
          </Link>

          <div className="landing-nav-links">
            <a className="landing-nav-link" href="#features">{lang === "fr" ? "Fonctionnalités" : "Features"}</a>
            <a className="landing-nav-link" href="#workflow">{lang === "fr" ? "Flux de travail" : "Workflow"}</a>
            <a className="landing-nav-link" href="#views">{lang === "fr" ? "Vues" : "Views"}</a>
          </div>

          <div className="landing-top-actions">
            <div className="landing-language" aria-label={languageLabel}>
              <button className={lang === "en" ? "active" : ""} onClick={() => changeLanguage("en")} aria-pressed={lang === "en"}>EN</button>
              <button className={lang === "fr" ? "active" : ""} onClick={() => changeLanguage("fr")} aria-pressed={lang === "fr"}>FR</button>
            </div>

            <button
              type="button"
              className={`landing-dev-toggle${devMode ? " on" : ""}`}
              aria-pressed={devMode}
              title={devMode ? (lang === "fr" ? "Désactiver le mode développement" : "Disable developer mode") : (lang === "fr" ? "Ouvrir les outils développeur" : "Open developer tools")}
              onClick={() => devMode ? disableDevMode() : (setAuthError(""), setAuthOpen(true))}
            >
              <span className="label">{devLabel}</span>
              <span className="landing-dev-switch" aria-hidden="true" />
            </button>

            <Link className="landing-signin" href="/login">{signInLabel}</Link>
          </div>
        </nav>

        <section className="landing-hero">
          <div>
            <div className="landing-eyebrow"><i /> {t.eyebrow}</div>
            <h1 className="landing-title">{t.title} <span>{t.titleHighlight}</span></h1>
            <p className="landing-copy">{t.body}</p>
            <div className="landing-actions">
              <Link className="landing-cta" href="/login">{t.primaryCta}</Link>
              <a className="landing-cta-secondary" href="#features">{t.secondaryCta}</a>
            </div>
            <div className="landing-proof">{t.proof}</div>
          </div>

          <div className="landing-product" aria-label="Agenda preview">
            <div className="landing-orb" />
            <div className="landing-dashboard">
              <div className="landing-windowbar"><span className="landing-dot" /><span className="landing-dot" /><span className="landing-dot" /><span className="landing-window-title">tempo workspace</span></div>
              <div className="landing-dashboard-body">
                <aside className="landing-side">
                  <div className="landing-side-item active"><span className="landing-side-dot" />Week</div>
                  <div className="landing-side-item">Today</div>
                  <div className="landing-side-item">Agenda</div>
                  <div className="landing-side-item">Book</div>
                  <div className="landing-side-item">Year</div>
                  <div className="landing-side-item">Calendars</div>
                </aside>
                <div className="landing-calendar">
                  <div className="landing-calendar-top"><div className="landing-calendar-title">{lang === "fr" ? "Cette semaine" : "This week"}</div><div className="landing-calendar-actions"><span className="landing-mini-button" /><span className="landing-mini-button" /></div></div>
                  <div className="landing-week">
                    <div className="landing-week-head" />
                    {(lang === "fr" ? ["LUN", "MAR", "MER", "JEU", "VEN"] : ["MON", "TUE", "WED", "THU", "FRI"]).map((day) => <div className="landing-week-head" key={day}>{day}</div>)}
                    <div className="landing-time">09:00</div>
                    <div className="landing-cell"><div className="landing-event" style={{ top: 8, height: 44 }}>{lang === "fr" ? "Revue produit" : "Product review"}<em>09:15 · 10:00</em></div></div>
                    <div className="landing-cell"><div className="landing-event green" style={{ top: 22, height: 52 }}>{lang === "fr" ? "Travail concentré" : "Deep work"}<em>09:30 · 10:30</em></div></div>
                    <div className="landing-cell" />
                    <div className="landing-cell"><div className="landing-event secondary" style={{ top: 10, height: 44 }}>{lang === "fr" ? "Synchronisation" : "Design sync"}<em>09:15 · 10:00</em></div></div>
                    <div className="landing-cell" />
                    <div className="landing-time">11:00</div><div className="landing-cell" /><div className="landing-cell"><div className="landing-event secondary" style={{ top: 14, height: 48 }}>{lang === "fr" ? "Déjeuner" : "Lunch"}<em>11:30 · 12:30</em></div></div><div className="landing-cell" /><div className="landing-cell" /><div className="landing-cell"><div className="landing-event" style={{ top: 7, height: 45 }}>{lang === "fr" ? "Planification" : "Planning"}<em>11:15 · 12:00</em></div></div>
                    <div className="landing-time">14:00</div><div className="landing-cell"><div className="landing-event green" style={{ top: 9, height: 46 }}>{lang === "fr" ? "Bloc focus" : "Focus block"}<em>14:15 · 15:00</em></div></div><div className="landing-cell" /><div className="landing-cell"><div className="landing-event" style={{ top: 28, height: 48 }}>{lang === "fr" ? "Appel équipe" : "Team call"}<em>14:30 · 15:30</em></div></div><div className="landing-cell" /><div className="landing-cell" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section" id="features">
          <div className="landing-section-head">
            <div>
              <h2 className="landing-section-title">{t.featureTitle}</h2>
              <p className="landing-section-copy">{t.featureBody}</p>
            </div>
          </div>
          <div className="landing-grid" id="views">
            {t.features.map((feature, index) => (
              <article className="landing-card" key={index}>
                <div className="landing-card-icon">{String(index + 1).padStart(2, "0")}</div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section" id="workflow">
          <div className="landing-bottom">
            <div><h2>{t.bottomTitle}</h2><p>{t.bottomBody}</p></div>
            <Link className="landing-cta" href="/login">{t.bottomCta}</Link>
          </div>
        </section>

        <footer className="landing-footer">
          <span>{t.footer}</span>
          <span><a href="/login">{signInLabel}</a></span>
        </footer>
      </div>

      {devMode && (
        <div className="dev-toolbar" role="toolbar" aria-label={lang === "fr" ? "Outils développeur" : "Developer tools"}>
          <span className="dev-badge">DEV</span>
          <button type="button" onClick={() => setEditorOpen(true)}>{lang === "fr" ? "Modifier la page" : "Edit landing page"}</button>
          <button type="button" onClick={resetDraft}>{lang === "fr" ? "Réinitialiser" : "Reset"}</button>
          <button type="button" onClick={disableDevMode}>{lang === "fr" ? "Désactiver" : "Disable"}</button>
        </div>
      )}

      {authOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setAuthOpen(false); }}>
          <form className="modal-card" onSubmit={submitDevAuth}>
            <h2>{devLabel}</h2>
            <p className="modal-sub">{lang === "fr" ? "Ce mode est réservé aux développeurs autorisés. Vos identifiants sont vérifiés côté serveur." : "This mode is restricted to authorized developers. Credentials are verified server-side."}</p>
            <div className="modal-field"><label>{lang === "fr" ? "Nom d’utilisateur" : "Username"}</label><input autoFocus value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></div>
            <div className="modal-field"><label>{lang === "fr" ? "Mot de passe" : "Password"}</label><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></div>
            {authError && <div className="modal-error" role="alert">{authError}</div>}
            <div className="modal-actions">
              <button type="button" onClick={() => setAuthOpen(false)}>{lang === "fr" ? "Annuler" : "Cancel"}</button>
              <button className="primary" disabled={authLoading} type="submit">{authLoading ? (lang === "fr" ? "Vérification…" : "Checking…") : (lang === "fr" ? "Activer" : "Enable")}</button>
            </div>
          </form>
        </div>
      )}

      {editorOpen && devMode && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditorOpen(false); }}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label={lang === "fr" ? "Éditeur de page" : "Landing page editor"}>
            <h2>{lang === "fr" ? "Éditeur de page" : "Landing page editor"}</h2>
            <p className="modal-sub">{editorDescription}</p>

            <div className="editor-section">
              <h3>{lang === "fr" ? "Hero" : "Hero"}</h3>
              <div className="editor-grid">
                {([
                  ["eyebrow", lang === "fr" ? "Surtitre" : "Eyebrow"],
                  ["title", lang === "fr" ? "Titre" : "Title"],
                  ["titleHighlight", lang === "fr" ? "Titre accentué" : "Highlight"],
                  ["primaryCta", lang === "fr" ? "Bouton principal" : "Primary CTA"],
                  ["secondaryCta", lang === "fr" ? "Bouton secondaire" : "Secondary CTA"],
                  ["proof", lang === "fr" ? "Preuve" : "Proof"],
                ] as const).map(([key, label]) => (
                  <div className="modal-field" key={key}><label>{label}</label><input value={t[key]} onChange={(event) => updateCopy({ [key]: event.target.value } as Partial<LandingCopy>)} /></div>
                ))}
                <div className="modal-field editor-full"><label>{lang === "fr" ? "Description" : "Description"}</label><textarea value={t.body} onChange={(event) => updateCopy({ body: event.target.value })} /></div>
              </div>
            </div>

            <div className="editor-section">
              <h3>{lang === "fr" ? "Fonctionnalités" : "Features"}</h3>
              <div className="modal-field"><label>{lang === "fr" ? "Titre de section" : "Section title"}</label><input value={t.featureTitle} onChange={(event) => updateCopy({ featureTitle: event.target.value })} /></div>
              <div className="modal-field"><label>{lang === "fr" ? "Description de section" : "Section description"}</label><textarea value={t.featureBody} onChange={(event) => updateCopy({ featureBody: event.target.value })} /></div>
              {t.features.map((feature, index) => (
                <div className="editor-feature" key={index}>
                  <div className="modal-field"><label>#{index + 1}</label><input value={feature.title} onChange={(event) => updateCopy({ features: t.features.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })} /></div>
                  <div className="modal-field"><label>{lang === "fr" ? "Texte" : "Body"}</label><textarea value={feature.body} onChange={(event) => updateCopy({ features: t.features.map((item, i) => i === index ? { ...item, body: event.target.value } : item) })} /></div>
                </div>
              ))}
            </div>

            <div className="editor-section">
              <h3>{lang === "fr" ? "Appel final" : "Final CTA"}</h3>
              <div className="modal-field"><label>{lang === "fr" ? "Titre" : "Title"}</label><input value={t.bottomTitle} onChange={(event) => updateCopy({ bottomTitle: event.target.value })} /></div>
              <div className="modal-field"><label>{lang === "fr" ? "Description" : "Description"}</label><textarea value={t.bottomBody} onChange={(event) => updateCopy({ bottomBody: event.target.value })} /></div>
              <div className="modal-field"><label>{lang === "fr" ? "Bouton" : "Button"}</label><input value={t.bottomCta} onChange={(event) => updateCopy({ bottomCta: event.target.value })} /></div>
            </div>

            <div className="modal-actions">
              <button type="button" onClick={() => resetDraft()}>{lang === "fr" ? "Réinitialiser" : "Reset"}</button>
              <button className="primary" type="button" onClick={saveDraft}>{editorSaved ? (lang === "fr" ? "Enregistré" : "Saved") : (lang === "fr" ? "Enregistrer" : "Save changes")}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
