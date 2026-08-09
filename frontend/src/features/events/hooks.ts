import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createEvent, deleteEvent, fetchEvents, updateEvent, type EventInput } from "./api";

export function useEvents(from: Date, to: Date) {
  return useQuery({
    queryKey: ["events", from.toISOString(), to.toISOString()],
    queryFn: () => fetchEvents(from, to),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventInput) => createEvent(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<EventInput> }) => updateEvent(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
}
