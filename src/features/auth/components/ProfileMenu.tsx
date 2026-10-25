"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  UserIcon,
  SettingsIcon,
  BellIcon,
  PaletteIcon,
  LogOutIcon,
} from "@/lib/icons";
import { useSettings } from "@/lib/settings";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type MenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
};

export function ProfileMenu({
  isOpen,
  onClose,
  anchorRef,
  user,
  onAccountSettings,
  onPreferences,
  onNotifications,
  onAppearance,
  onHelp,
  onSignOut,
}: {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  user: {
    imageUrl?: string | null;
    fullName?: string | null;
    username?: string | null;
    email?: string | null;
  };
  onAccountSettings: () => void;
  onPreferences: () => void;
  onNotifications: () => void;
  onAppearance: () => void;
  onHelp: () => void;
  onSignOut: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLButtonElement | null>(null);
  const { settings, update } = useSettings();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  useEffect(() => {
    if (isOpen && focusRef.current) {
      focusRef.current.focus();
    }
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const items: MenuItem[] = [
    {
      id: "account",
      label: "Account settings",
      icon: <UserIcon size={16} />,
      action: () => { onAccountSettings(); onClose(); },
    },
    {
      id: "preferences",
      label: "Preferences",
      icon: <SettingsIcon size={16} />,
      action: () => { onPreferences(); onClose(); },
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <BellIcon size={16} />,
      action: () => { onNotifications(); onClose(); },
    },
    {
      id: "appearance",
      label: "Appearance",
      icon: <PaletteIcon size={16} />,
      action: () => { onAppearance(); onClose(); },
    },
    {
      id: "divider",
      label: "",
      icon: null,
      action: () => {},
      dividerBefore: true,
    },
    {
      id: "help",
      label: "Help & shortcuts",
      icon: <HelpIcon size={16} />,
      action: () => { onHelp(); onClose(); },
    },
    {
      id: "signout",
      label: "Sign out",
      icon: <LogOutIcon size={16} />,
      action: async () => {
        onClose();
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        window.location.href = "/login";
      },
      danger: true,
      dividerBefore: true,
    },
  ];

  const initials = user.fullName?.trim()
    ? user.fullName.trim().split(/\s+/).map(p => p[0]).join("").toUpperCase().slice(0, 2)
    : user.username?.trim().slice(0, 2).toUpperCase() || "?";

  const tooltipText = [user.fullName, user.username ? `@${user.username}` : null].filter(Boolean).join("\n");

  const avatarBg = user.imageUrl ? undefined : (() => {
    let hash = 0;
    for (let i = 0; i < initials.length; i++) hash = initials.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
  })();

  const popperStyle: React.CSSProperties = {
    position: "fixed",
    top: anchorRef.current?.getBoundingClientRect().bottom ?? 0,
    right: window.innerWidth - (anchorRef.current?.getBoundingClientRect().right ?? 0),
    zIndex: 100,
  };

  return createPortal(
    <div
      className="profile-menu-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 99 }}
    >
      <div
        ref={menuRef}
        className="profile-menu"
        role="menu"
        aria-orientation="vertical"
        style={popperStyle}
      >
        <div className="profile-menu__header">
          <div className="profile-menu__avatar" style={{ background: avatarBg }}>
            {user.imageUrl ? (
              <Image unoptimized width={64} height={64} src={user.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            ) : (
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>{initials}</span>
            )}
          </div>
          <div className="profile-menu__identity">
            {user.fullName && <div className="profile-menu__name">{user.fullName}</div>}
            {user.username && <div className="profile-menu__username">@{user.username}</div>}
            {user.email && <div className="profile-menu__email">{user.email}</div>}
          </div>
        </div>
        <div className="profile-menu__divider" />
        <div className="profile-menu__items" role="menu">
          {items.map((item) => (
            item.dividerBefore ? (
              <div key={item.id} className="profile-menu__divider" />
            ) : (
              <button
                key={item.id}
                ref={item.id === "signout" ? focusRef : undefined}
                role="menuitem"
                className={`profile-menu__item${item.danger ? " profile-menu__item--danger" : ""}`}
                onClick={item.action}
                style={item.icon ? undefined : { visibility: "hidden" }}
              >
                {item.icon && <span className="profile-menu__item-icon">{item.icon}</span>}
                <span className="profile-menu__item-label">{item.label}</span>
              </button>
            )
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export const HelpIcon = (p: { size?: number }) => (
  <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
);