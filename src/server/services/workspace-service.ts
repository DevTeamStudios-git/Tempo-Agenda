import { prisma } from "@/lib/prisma/client";

/**
 * Every mutation is authorized against workspace membership
 * (Construction Notebook §30 rule 4, Notebook v2 §§6-9).
 *
 * IMPORTANT ARCHITECTURAL CORRECTION (Notebook v2 §3-4):
 * The Supabase SSR client (`createSupabaseServerClient().auth.getUser()`) only
 * authenticates the HTTP request — it does NOT make the subsequent Prisma query
 * run under that user's Supabase RLS identity. Prisma uses its own pooled
 * DATABASE_URL connection which bypasses RLS. Therefore this service layer is the
 * primary authorization boundary for all Prisma reads/writes; RLS remains defense-
 * in-depth for any data exposed via Supabase Data API directly.
 */

export type MembershipRole = "owner" | "admin" | "member" | "viewer";

// Central permission matrix (Notebook v2 §6.1)
const CAN_WRITE: MembershipRole[] = ["owner", "admin", "member"];
const CAN_MANAGE_CALENDAR: MembershipRole[] = ["owner", "admin"];
const CAN_MANAGE_MEMBERS: MembershipRole[] = ["owner", "admin"];

export async function assertWorkspaceMember(userId: string, workspaceId: string) {
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!membership) {
    throw new Error("FORBIDDEN: not a member of this workspace");
  }
  return membership;
}

export async function assertCanReadWorkspace(userId: string, workspaceId: string) {
  return assertWorkspaceMember(userId, workspaceId);
}

export async function assertCanWriteWorkspace(userId: string, workspaceId: string) {
  const m = await assertWorkspaceMember(userId, workspaceId);
  if (!(CAN_WRITE as string[]).includes(m.role)) {
    throw new Error("FORBIDDEN: viewer cannot mutate");
  }
  return m;
}

export async function assertCalendarAccess(userId: string, calendarId: string) {
  const calendar = await prisma.calendar.findUnique({ where: { id: calendarId } });
  if (!calendar || calendar.deletedAt) throw new Error("NOT_FOUND: calendar");
  await assertWorkspaceMember(userId, calendar.workspaceId);
  return calendar;
}

export async function assertCanCreateEvent(userId: string, calendarId: string) {
  const cal = await assertCalendarAccess(userId, calendarId);
  if(cal.isArchived)throw new Error("CONFLICT: calendar is archived");
  await assertCanWriteWorkspace(userId, cal.workspaceId);
  return cal;
}

export async function assertCanEditEvent(userId: string, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { calendar: true } });
  if (!event || event.calendar.deletedAt) throw new Error("NOT_FOUND: event");
  if (event.deletedAt) throw new Error("CONFLICT: event is deleted");
  await assertCanWriteWorkspace(userId, event.calendar.workspaceId);
  return event;
}

export async function assertCanDeleteEvent(userId: string, eventId: string) {
  return assertCanEditEvent(userId, eventId);
}

export async function assertCanManageCalendar(userId: string, calendarId: string) {
  const cal = await assertCalendarAccess(userId, calendarId);
  const m = await assertWorkspaceMember(userId, cal.workspaceId);
  if (!(CAN_MANAGE_CALENDAR as string[]).includes(m.role)) {
    throw new Error("FORBIDDEN: cannot manage calendars");
  }
  return cal;
}

export async function assertCanManageMembers(userId: string, workspaceId: string) {
  const m = await assertWorkspaceMember(userId, workspaceId);
  if (!(CAN_MANAGE_MEMBERS as string[]).includes(m.role)) {
    throw new Error("FORBIDDEN: cannot manage members");
  }
  return m;
}

/**
 * Notebook v3 §2.1: real auth → workspace resolver. Returns the user's default
 * workspace (owner's first membership, or first membership) — never trusts client-supplied id.
 */
export async function resolveDefaultWorkspace(userId: string): Promise<{ workspaceId: string; role: MembershipRole } | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: [{ role: "asc" }], // owner < admin < member < viewer lexicographically, but we explicitly prefer owner
    include: { workspace: true },
  });
  if (!membership) return null;
  // Prefer owner membership if multiple.
  const ownerMembership = await prisma.membership.findFirst({ where: { userId, role: "owner" } });
  const chosen = ownerMembership ?? membership;
  return { workspaceId: chosen.workspaceId, role: chosen.role as MembershipRole };
}

export async function getUserWorkspaceOrThrow(userId: string, requestedWorkspaceId?: string | null): Promise<string> {
  if (requestedWorkspaceId) {
    await assertWorkspaceMember(userId, requestedWorkspaceId);
    return requestedWorkspaceId;
  }
  const resolved = await resolveDefaultWorkspace(userId);
  if (!resolved) throw new Error("NOT_FOUND: no workspace for user — run onboarding");
  return resolved.workspaceId;
}

/**
 * Auto-onboarding for real Supabase users (fixes "No workspace found").
 * The seed only covers `seed-user`; a user who just signed up via /login has no
 * UserProfile/Workspace/Membership/Calendars yet. This creates them idempotently
 * inside a transaction to avoid race duplication (P1 §12).
 */
export async function ensureDefaultWorkspaceForUser(
  userId: string,
  opts?: { email?: string | null; displayName?: string | null }
): Promise<{ workspaceId: string; role: MembershipRole }> {
  const existing = await resolveDefaultWorkspace(userId);
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const recheck = await tx.membership.findFirst({ where: { userId } });
    if (recheck) return { workspaceId: recheck.workspaceId, role: recheck.role as MembershipRole };

    const displayName =
      opts?.displayName?.trim() ||
      (opts?.email ? opts.email.split("@")[0]! : null) ||
      `User ${userId.slice(0, 8)}`;
    await tx.userProfile.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, displayName, defaultTimezone: "America/Toronto" },
    });

    const baseSlug = (opts?.email ? opts.email.split("@")[0]! : `user-${userId.slice(0, 8)}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20) || `user-${userId.slice(0, 8)}`;
    let slug = baseSlug;
    let suffix = 0;
    while (await tx.workspace.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
      if (suffix > 10) slug = `user-${userId.slice(0, 12)}-${Date.now()}`;
    }

    const workspace = await tx.workspace.create({
      data: { name: `${displayName}'s Workspace`, slug, ownerId: userId },
    });

    await tx.membership.create({
      data: { workspaceId: workspace.id, userId, role: "owner" },
    });

    const defaults = [{name:"My calendar",color:"#0b57d0",isDefault:true}];
    for (const cal of defaults) {
      await tx.calendar.create({
        data: { workspaceId: workspace.id, name: cal.name, color: cal.color, isDefault: cal.isDefault },
      });
    }

    return { workspaceId: workspace.id, role: "owner" };
  });
}

export async function assertCanManageCalendarsInWorkspace(userId: string, workspaceId: string) {
  const m = await assertWorkspaceMember(userId, workspaceId);
  if (!(CAN_MANAGE_CALENDAR as string[]).includes(m.role)) {
    throw new Error("FORBIDDEN: cannot manage calendars");
  }
  return m;
}
