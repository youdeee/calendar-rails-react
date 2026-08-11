import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createEvent, deleteEvent, fetchEvents, updateEvent, type CalendarEvent, type EventInput } from "./api";

export function useEvents(from: Date, to: Date) {
  return useQuery({
    queryKey: ["events", from.toISOString(), to.toISOString()],
    queryFn: ({ signal }) => fetchEvents(from, to, signal),
  });
}

function useEventMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: ["events"] });
      if (typeof args === "object" && args !== null && "id" in args) {
        const id = (args as { id: number }).id;
        queryClient.setQueriesData<CalendarEvent[]>({ queryKey: ["events"] }, (events) => events?.filter((event) => event.id !== id));
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["events"], refetchType: "active" }),
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
