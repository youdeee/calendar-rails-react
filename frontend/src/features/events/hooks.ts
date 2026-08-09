import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createEvent, deleteEvent, fetchEvents, updateEvent, type EventInput } from "./api";

export function useEvents(from: Date, to: Date) {
  return useQuery({
    queryKey: ["events", from.toISOString(), to.toISOString()],
    queryFn: () => fetchEvents(from, to),
  });
}

function useEventMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useCreateEvent() {
  return useEventMutation(createEvent);
}

export function useUpdateEvent() {
  return useEventMutation(({ id, input }: { id: number; input: Partial<EventInput> }) => updateEvent(id, input));
}

export function useDeleteEvent() {
  return useEventMutation(deleteEvent);
}
