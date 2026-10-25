"use client";
import Image from "next/image";
import { useMemo } from "react";
import { UserIcon } from "@/lib/icons";

export function ProfileAvatar({
  imageUrl,
  fullName,
  username,
  email,
  size = 36,
}: {
  imageUrl?: string | null;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
  size?: number;
}) {
  const initials = useMemo(() => {
    if (fullName?.trim()) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 2) return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
      return (parts[0] ?? "").slice(0, 2).toUpperCase();
    }
    if (username?.trim()) return username.trim().slice(0, 2).toUpperCase();
    if (email?.trim()) return email.trim().slice(0, 2).toUpperCase();
    return "?";
  }, [fullName, username, email]);

  const tooltipText = useMemo(() => {
    const lines: string[] = [];
    if (fullName?.trim()) lines.push(fullName.trim());
    if (username?.trim()) lines.push(`@${username.trim()}`);
    return lines.join("\n");
  }, [fullName, username]);

  const bgColor = useMemo(() => {
    // deterministic color from initials
    let hash = 0;
    for (let i = 0; i < initials.length; i++) hash = initials.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 55%)`;
  }, [initials]);

  if (imageUrl) {
    return (
      <div
        className="profile-avatar"
        style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden" }}
        title={tooltipText || undefined}
      >
        <Image unoptimized width={64} height={64}
          src={imageUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className="profile-avatar profile-avatar--initials"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.4,
      }}
      title={tooltipText || undefined}
    >
      {initials}
    </div>
  );
}