import { CalendarShell } from "@/features/calendar/components/CalendarShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureDefaultWorkspaceForUser, resolveDefaultWorkspace } from "@/server/services/workspace-service";
import { prisma } from "@/lib/prisma/client";
import Link from "next/link";

export default async function Page() {
  let user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = (data?.user as { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null) ?? null;
  } catch (e) {
    // Supabase not configured and not in demo mode → fail closed
    return (
      <div style={{ padding: 32, fontFamily: "system-ui" }}>
        <h1>Configuration required</h1>
        <p>Supabase is not configured. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and keys, and sign in to your account.</p>
        <p style={{ color: "#666", fontSize: 12 }}>{String((e as Error).message)}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 32, fontFamily: "system-ui" }}>
        <h1>Sign in required</h1>
        <p>You need to sign in to see your calendar.</p>
        <p><Link href="/login" style={{ color: "var(--accent)" }}>Go to login →</Link></p>
      </div>
    );
  }

  // Resolve workspace server-side — never trust client-supplied workspaceId
  // If no workspace exists for this Supabase user (just signed up), auto-onboard them
  let workspaceId: string | null = null;
  try {
    const resolved = await resolveDefaultWorkspace(user.id);
    workspaceId = resolved?.workspaceId ?? null;
    if (!workspaceId) {
      const onboarded = await ensureDefaultWorkspaceForUser(user.id, {
        email: user.email ?? null,
        displayName: (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined) ?? null,
      });
      workspaceId = onboarded.workspaceId;
    }
  } catch (e) {
    return (
      <div style={{ padding: 32 }}>
        <p>Database unavailable. Try again.</p>
        <p style={{ fontSize: 12, color: "#666" }}>{String((e as Error).message)}</p>
      </div>
    );
  }

  let timeZone = "America/Toronto";
  try {
    const profile = await prisma.userProfile.findUnique({ where: { id: user.id } });
    if (profile?.defaultTimezone) timeZone = profile.defaultTimezone;
  } catch {
    // ignore, use fallback
  }

  return <CalendarShell workspaceId={workspaceId} timeZone={timeZone} />;
}
