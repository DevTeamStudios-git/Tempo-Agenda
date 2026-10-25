import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchEvents, createEvent } from '@/lib/api';

export interface RangeArgs {
  workspaceId: string;
  calendarIds: string[];
  rangeStart: Date;
  rangeEnd: Date;
  q?: string;
}

function key(a: RangeArgs) {
  return ['events', a.workspaceId, [...a.calendarIds].sort().join(','), a.rangeStart.toISOString(), a.rangeEnd.toISOString(), a.q ?? ''];
}

export function useCalendarEvents(args: RangeArgs) {
  return useQuery({ queryKey: key(args), queryFn: () => fetchEvents(args), enabled: !!args.workspaceId });
}

export function useCreateEvent(args: RangeArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: key(args) }),
  });
}
