import { supabase } from './supabase';
import { TEMPO_API_URL } from './config';
import type { EventRecord, EventDraft } from '../features/calendar/types';
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {throw new Error('Sign in to continue.');}
  let response: Response;
  try {
    response = await fetch(TEMPO_API_URL + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + data.session.access_token,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(
      'Cannot reach Tempo. Check your connection and the backend address.',
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    {throw new Error(
      result.error?.message ?? 'Request failed (' + response.status + ')',
    );}
  return result as T;
}
export async function fetchEvents(args: {
  workspaceId: string;
  calendarIds: string[];
  rangeStart: Date;
  rangeEnd: Date;
  q?: string;
}) {
  const params = new URLSearchParams({
    workspaceId: args.workspaceId,
    rangeStart: args.rangeStart.toISOString(),
    rangeEnd: args.rangeEnd.toISOString(),
  });
  args.calendarIds.forEach((id) => params.append('calendarId', id));
  if (!args.calendarIds.length) {params.append('_emptyCalendars', '1');}
  if (args.q) {params.append('q', args.q);}
  return (await api<{ events: EventRecord[] }>('/api/events?' + params)).events;
}
export async function createEvent(draft: EventDraft) {
  return (await api<{ event: EventRecord }>('/api/events', 'POST', draft))
    .event;
}
