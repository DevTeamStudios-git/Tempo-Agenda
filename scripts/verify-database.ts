import {
  createCalendar,
  updateCalendar,
  deleteCalendar,
  restoreCalendar,
  listCalendars,
} from "../src/server/services/calendar-service";
import {
  getAssistantPermissions,
  setAssistantPermissions,
  applyAssistantPlan,
  denied,
  assistantTurn,
} from "../src/server/services/assistant-service";
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma/client";
import {
  createEvent,
  updateEvent,
  listEventsInRange,
  mutateOccurrence,
  searchEventsGlobal,
  deleteEvent,
  restoreEvent,
} from "../src/server/services/event-service";
import {
  renewInvitationLink,
  getInvitation,
  respondToInvitation,
} from "../src/server/services/invitation-service";
import { deliverReminders } from "../src/server/services/reminder-service";
import {
  createTask,
  listTasks,
  updateTask,
} from "../src/server/services/task-service";
async function main() {
  const prefix = "qa-" + crypto.randomUUID(),
    owner = prefix + "-owner",
    viewer = prefix + "-viewer",
    outsider = prefix + "-outsider",
    workspace = prefix + "-workspace",
    calendar = prefix + "-calendar";
  let setup = false;
  try {
    await prisma.userProfile.createMany({
      data: [owner, viewer, outsider].map((id) => ({
        id,
        displayName: "Temporary QA fixture",
      })),
    });
    setup = true;
    await prisma.workspace.create({
      data: {
        id: workspace,
        name: "Temporary QA fixture",
        slug: workspace,
        ownerId: owner,
        memberships: {
          create: [
            { userId: owner, role: "owner" },
            { userId: viewer, role: "viewer" },
          ],
        },
        calendars: { create: { id: calendar, name: "QA", color: "#0b57d0" } },
      },
    });
    const draft = {
      calendarId: calendar,
      title: "QA private event",
      description: "Sensitive QA notes",
      location: "Room",
      startAt: "2026-03-02T14:00:00Z",
      endAt: "2026-03-02T15:00:00Z",
      timezone: "America/Toronto",
      allDay: false,
      labels: ["test"],
      priority: 3,
      visibility: "private",
      recurrence: { rrule: "FREQ=WEEKLY;COUNT=3" },
      reminders: [15, 60],
    };
    const event = await createEvent(owner, draft);
    assert.deepEqual(event.labels, ["test"]);
    assert.equal(event.priority, 3);
    assert.deepEqual(
      event.reminders?.sort((a, b) => a - b),
      [15, 60],
    );
    await updateEvent(owner, event.id, { title: "Renamed QA event" });
    const preserved = await prisma.event.findUniqueOrThrow({
      where: { id: event.id },
    });
    assert.equal(preserved.visibility, "private");
    assert.deepEqual(preserved.labels, ["test"]);
    assert.equal(preserved.priority, 3);
    await assert.rejects(() => createEvent(viewer, draft), /FORBIDDEN/);
    await assert.rejects(
      () =>
        listEventsInRange(
          outsider,
          workspace,
          undefined,
          new Date("2026-03-01"),
          new Date("2026-04-01"),
        ),
      /FORBIDDEN/,
    );
    await assert.rejects(() =>
      updateEvent(owner, event.id, { endAt: "2026-03-01T14:00:00Z" }),
    );
    const events = await listEventsInRange(
      owner,
      workspace,
      [calendar],
      new Date("2026-03-01"),
      new Date("2026-04-01"),
    );
    assert.equal(events.length, 3);
    const redacted = await listEventsInRange(
      viewer,
      workspace,
      [calendar],
      new Date("2026-03-01"),
      new Date("2026-04-01"),
    );
    assert.equal(redacted[0]!.title, "Busy");
    assert.equal(redacted[0]!.description, "");
    assert.equal(
      (await searchEventsGlobal(viewer, workspace, "Sensitive", undefined))
        .length,
      0,
    );
    const changed = await mutateOccurrence(
      owner,
      events[1]!.id,
      {
        title: "QA moved occurrence",
        startAt: "2026-03-10T13:00:00Z",
        endAt: "2026-03-10T14:00:00Z",
      },
      "this",
    );
    assert.ok(changed);
    const after = await listEventsInRange(
      owner,
      workspace,
      [calendar],
      new Date("2026-03-01"),
      new Date("2026-04-01"),
    );
    assert.equal(after.length, 3);
    assert.equal(
      after.filter((e) => e.title === "QA moved occurrence").length,
      1,
    );
    await deleteEvent(owner, changed!.id);
    await restoreEvent(owner, changed!.id);
    const firstDelivery = await deliverReminders(
      new Date("2026-03-02T13:45:00Z"),
      workspace,
    );
    assert.equal(firstDelivery.created, 1);
    const repeatedDelivery = await deliverReminders(
      new Date("2026-03-02T13:45:00Z"),
      workspace,
    );
    assert.equal(repeatedDelivery.created, 0);
    const invited = await createEvent(owner, {
      ...draft,
      title: "QA invitation",
      recurrence: null,
      guests: [{ email: "qa@example.invalid" }],
    });
    assert.equal(invited.guests?.[0]?.responseStatus, "needs_action");
    assert.equal(
      await prisma.deliveryJob.count({
        where: { payload: { path: ["eventId"], equals: invited.id } },
      }),
      1,
    );
    const token = await renewInvitationLink(
      owner,
      invited.id,
      "qa@example.invalid",
    );
    assert.equal((await getInvitation(token)).event.title, "QA invitation");
    await respondToInvitation(token, { responseStatus: "accepted" });
    assert.equal((await getInvitation(token)).responseStatus, "accepted");
    await renewInvitationLink(owner, invited.id, "qa@example.invalid");
    await assert.rejects(() => getInvitation(token), /NOT_FOUND/);
    const follow = await createEvent(owner, {
      ...draft,
      title: "QA follow",
      recurrence: { rrule: "FREQ=WEEKLY;COUNT=4" },
      reminders: [],
    });
    const followEvents = (
      await listEventsInRange(
        owner,
        workspace,
        [calendar],
        new Date("2026-03-01"),
        new Date("2026-04-01"),
      )
    ).filter((e) => e.occurrenceOf?.seriesId === follow.id);
    const continuation = await mutateOccurrence(
      owner,
      followEvents[2]!.id,
      { title: "QA continuation" },
      "following",
    );
    assert.ok(continuation);
    const split = (
      await listEventsInRange(
        owner,
        workspace,
        [calendar],
        new Date("2026-03-01"),
        new Date("2026-04-01"),
      )
    ).filter((e) => e.title === "QA follow" || e.title === "QA continuation");
    assert.equal(split.length, 4);
    const toDelete = split.find((e) => e.title === "QA continuation")!;
    await mutateOccurrence(owner, toDelete.id, {}, "series", true);
    await restoreEvent(owner, continuation!.id);
    const task = await createTask(owner, workspace, {
      title: "QA task",
      startAt: "2026-10-24T13:00:00Z",
      endAt: "2026-10-24T14:00:00Z",
    });
    assert.equal((await listTasks(owner, workspace)).length, 1);
    assert.equal((await listTasks(viewer, workspace)).length, 0);
    await assert.rejects(
      () => updateTask(viewer, task.id, { completed: true }),
      /NOT_FOUND/,
    );
    const done = await updateTask(owner, task.id, { completed: true });
    assert.ok(done.completedAt);

    const extra = await createCalendar(owner, workspace, {
      name: "QA new calendar",
      color: "#00897b",
    });
    await updateCalendar(owner, extra.id, { name: "QA renamed" });
    assert.equal(
      (await listCalendars(owner, workspace)).find((c) => c.id === extra.id)
        ?.name,
      "QA renamed",
    );
    const ce = await createEvent(owner, {
      ...draft,
      calendarId: extra.id,
      recurrence: null,
      reminders: [],
    });
    await assert.rejects(() => deleteCalendar(viewer, extra.id), /FORBIDDEN/);
    await deleteCalendar(owner, extra.id);
    assert.ok(
      !(await listCalendars(owner, workspace)).some((c) => c.id === extra.id),
    );
    assert.ok(
      !(
        await listEventsInRange(
          owner,
          workspace,
          undefined,
          new Date("2026-03-01"),
          new Date("2026-04-01"),
        )
      ).some((e) => e.id === ce.id),
    );
    await assert.rejects(
      () => updateEvent(owner, ce.id, { title: "denied" }),
      /NOT_FOUND/,
    );
    await restoreCalendar(owner, extra.id);
    assert.ok(
      (await listCalendars(owner, workspace)).some((c) => c.id === extra.id),
    );
    assert.deepEqual(await getAssistantPermissions(owner), denied);
    await setAssistantPermissions(owner, { ...denied, canCreateEvents: true });
    const makePlan = (userId: string, actions: unknown) =>
      prisma.assistantPlan.create({
        data: {
          userId,
          workspaceId: workspace,
          actions: actions as never,
          expiresAt: new Date(Date.now() + 600000),
        },
      });
    const actions = [
      {
        name: "create_event",
        arguments: {
          calendarId: calendar,
          title: "QA approved AI event",
          startAt: "2026-10-25T13:00:00Z",
          endAt: "2026-10-25T14:00:00Z",
          timezone: "America/Toronto",
        },
      },
    ];
    const deniedPlan = await makePlan(owner, actions);
    await setAssistantPermissions(owner, denied);
    await assert.rejects(
      () => applyAssistantPlan(owner, deniedPlan.id, true),
      /FORBIDDEN/,
    );
    assert.equal(
      (
        await prisma.assistantPlan.findUniqueOrThrow({
          where: { id: deniedPlan.id },
        })
      ).state,
      "pending",
    );
    await setAssistantPermissions(owner, { ...denied, canCreateEvents: true });
    await assert.rejects(
      () => applyAssistantPlan(outsider, deniedPlan.id, true),
      /NOT_FOUND/,
    );
    const applied = await applyAssistantPlan(owner, deniedPlan.id, true);
    assert.equal(applied.state, "applied");
    assert.equal(
      await prisma.event.count({
        where: { calendarId: calendar, title: "QA approved AI event" },
      }),
      1,
    );
    await assert.rejects(
      () => applyAssistantPlan(owner, deniedPlan.id, true),
      /CONFLICT/,
    );
    const discard = await makePlan(owner, actions);
    assert.equal(
      (await applyAssistantPlan(owner, discard.id, false)).state,
      "discarded",
    );
    const expired = await makePlan(owner, actions);
    await prisma.assistantPlan.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(0) },
    });
    await assert.rejects(
      () => applyAssistantPlan(owner, expired.id, true),
      /expired/,
    );
    await setAssistantPermissions(viewer, { ...denied, canCreateEvents: true });
    const viewerPlan = await makePlan(viewer, actions);
    assert.equal(
      (await applyAssistantPlan(viewer, viewerPlan.id, true)).state,
      "failed",
    );
    const foreign = await makePlan(owner, [
      {
        name: "create_event",
        arguments: {
          ...actions[0]!.arguments,
          calendarId: "nonexistent-foreign",
        },
      },
    ]);
    await assert.rejects(
      () => applyAssistantPlan(owner, foreign.id, true),
      /NOT_FOUND|FORBIDDEN/,
    );
    if (process.env.VERIFY_LIVE_AI === "1") {
      await setAssistantPermissions(owner, {
        ...denied,
        canRead: true,
        canCreateEvents: true,
      });
      const answer = await assistantTurn(owner, {
        provider: "groq",
        workspaceId: workspace,
        timeZone: "America/Toronto",
        message:
          "Use the create_event tool to propose a one-hour event titled QA live AI on October 26 2026 at 9 AM Toronto in the calendar named QA. Do not merely describe the action.",
      });
      assert.ok(
        "plan" in answer && answer.plan,
        "Live model must propose a real calendar action",
      );
      if ("plan" in answer && answer.plan) {
        assert.equal(
          (await applyAssistantPlan(owner, answer.plan.id, true)).state,
          "applied",
        );
        console.log(
          "Live AI tool proposal and approved database write passed.",
        );
      }
    }
    console.log(
      "Calendar CRUD, deletion/restore, AI default deny, revocation, ownership, approval, expiration, duplicate prevention and workspace role tests passed.",
    );
    console.log(
      "Database integration passed: persistence, recurrence overrides/splitting, private redaction, authorization, trash/restore, task isolation, RSVP token revocation and reminder deduplication.",
    );
  } finally {
    if (setup) {
      const attendees = await prisma.attendee.findMany({
        where: { event: { calendar: { workspaceId: workspace } } },
        select: { id: true },
      });
      await prisma.deliveryJob.deleteMany({
        where: { dedupeKey: { in: attendees.map((a) => "invite:" + a.id) } },
      });
      await prisma.workspace.deleteMany({ where: { id: workspace } });
      await prisma.userProfile.deleteMany({
        where: { id: { in: [owner, viewer, outsider] } },
      });
      console.log("Temporary QA fixtures removed.");
    }
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
