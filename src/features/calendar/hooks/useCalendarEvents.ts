"use client";
/**
 * Server-state hook (Construction Notebook §11). Talks to the app's own
 * /api/events endpoints — never to Prisma or Supabase tables directly.
 * Swapping TanStack Query's fetcher for a different transport later doesn't
 * touch any component that calls this hook.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EventDraft, EventRecord } from "../types";
import { readApiError } from "@/lib/api/error";

interface RangeArgs {
  workspaceId: string;
  calendarIds: string[];
  rangeStart: Date;
  rangeEnd: Date;
  q?: string;
}

function rangeKey(args: RangeArgs) {
  // Notebook v2 §19: do not mutate calendarIds (sort in place mutates React state).
  return ["events", args.workspaceId, [...args.calendarIds].sort().join(","), args.rangeStart.toISOString(), args.rangeEnd.toISOString(), args.q ?? ""];
}

async function fetchEvents(args: RangeArgs): Promise<EventRecord[]> {
  const params = new URLSearchParams({
    workspaceId: args.workspaceId,
    rangeStart: args.rangeStart.toISOString(),
    rangeEnd: args.rangeEnd.toISOString(),
  });
  // Distinguish [] (show zero) from undefined (show all): API treats missing param as all.
  args.calendarIds.forEach((id) => params.append("calendarId", id));
  // Empty array + explicit marker so server can distinguish; server currently treats absent as all,
  // so we send a sentinel param for empty.
  if (args.calendarIds.length === 0) params.append("_emptyCalendars", "1");
  if (args.q) params.append("q", args.q);
  const res = await fetch(`/api/events?${params.toString()}`);
  if (!res.ok) await readApiError(res);
  return (await res.json()).events;
}

export function useCalendarEvents(args: RangeArgs) {
  return useQuery({ queryKey: rangeKey(args), queryFn: () => fetchEvents(args), refetchInterval: 30_000 });
}

export function useEventMutations(args: RangeArgs) {
  const queryClient = useQueryClient();
  const key = rangeKey(args);

  const create = useMutation({
    mutationFn: async (draft: EventDraft) => {
      const res = await fetch("/api/events", { method: "POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(draft) });
      if (!res.ok) await readApiError(res);
      return (await res.json()).event as EventRecord;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, editScope, ...draft }: EventDraft & { id: string }) => {
      const res = await fetch(`/api/events/${encodeURIComponent(id)}?scope=${editScope ?? "this"}`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify(draft) });
      if (!res.ok) await readApiError(res);
      return (await res.json()).event as EventRecord;
    },
    // Optimistic: apply the edit immediately, roll back on failure.
    onMutate: async (draft) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<EventRecord[]>(key);
      queryClient.setQueryData<EventRecord[]>(key, (old) =>
        old?.map((e) => (e.id === draft.id ? { ...e, ...draft } : e))
      );
      return { previous };
    },
    onError: (_err, _draft, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const moveOrResize = useMutation({
    mutationFn: async ({ id, startAt, endAt }: { id: string; startAt: string; endAt: string }) => {
      const res = await fetch(`/api/events/${id}`, { method: "PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ startAt, endAt }) });
      if (!res.ok) await readApiError(res);
      return (await res.json()).event as EventRecord;
    },
    onMutate: async ({ id, startAt, endAt }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<EventRecord[]>(key);
      queryClient.setQueryData<EventRecord[]>(key, (old) =>
        old?.map((e) => (e.id === id ? { ...e, startAt, endAt } : e))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) await readApiError(res);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<EventRecord[]>(key);
      queryClient.setQueryData<EventRecord[]>(key, (old) => old?.filter((e) => e.id !== id.split("?")[0]));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${id}/restore`, { method: "POST" });
      if (!res.ok) await readApiError(res);
      return (await res.json()).event as EventRecord;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  return { create, update, moveOrResize, remove, restore };
}
