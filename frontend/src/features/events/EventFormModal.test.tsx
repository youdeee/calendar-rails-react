import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventFormModal } from "./EventFormModal";
import type { CalendarEvent } from "./api";

const defaultDate = new Date(2026, 7, 10);

function renderModal(onClose = vi.fn(), event?: CalendarEvent) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <EventFormModal onClose={onClose} event={event} defaultDate={defaultDate} />
    </QueryClientProvider>
  );
  return { onClose };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

it("defaults to an all-day event on the currently displayed date when creating", () => {
  renderModal();

  expect(screen.getByLabelText("終日")).toBeChecked();
  expect(screen.getByLabelText("開始日")).toHaveValue("2026-08-10");
  expect(screen.getByLabelText("終了日")).toHaveValue("2026-08-10");
});

it("shows a validation error and does not submit when the title is blank", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const { onClose } = renderModal();

  await userEvent.click(screen.getByRole("button", { name: "保存" }));

  expect(screen.getByRole("alert")).toHaveTextContent("タイトルを入力してください");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

it("submits a valid all-day event using the default date", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: 1,
        title: "Holiday",
        start_at: "2026-08-10T00:00:00Z",
        end_at: "2026-08-11T00:00:00Z",
        all_day: true,
        recurring: false,
        recurrence: null,
      }),
      { status: 201 }
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  const { onClose } = renderModal();

  await userEvent.type(screen.getByLabelText("タイトル"), "Holiday");
  await userEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await waitFor(() => expect(onClose).toHaveBeenCalled());

  const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
  expect(body.event.all_day).toBe(true);
  expect(body.event.start_on).toBe("2026-08-10");
  expect(body.event.end_on).toBe("2026-08-10");
  expect(body.event.reminder_minutes).toBe(360);
});

it("submits a timed event after unchecking all-day", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: 1,
        title: "Lunch",
        start_at: "2026-08-10T12:00:00Z",
        end_at: "2026-08-10T13:00:00Z",
        all_day: false,
        recurring: false,
        recurrence: null,
      }),
      { status: 201 }
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  const { onClose } = renderModal();

  await userEvent.click(screen.getByLabelText("終日"));
  await userEvent.type(screen.getByLabelText("タイトル"), "Lunch");
  fireEvent.change(screen.getByLabelText("開始日時"), { target: { value: "2026-08-10T12:00" } });
  fireEvent.change(screen.getByLabelText("終了日時"), { target: { value: "2026-08-10T13:00" } });
  await userEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await waitFor(() => expect(onClose).toHaveBeenCalled());

  const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
  expect(body.event.reminder_minutes).toBe(15);
});

it("auto-fills the end time as start time + 1 hour when unchecking all-day", async () => {
  renderModal();

  await userEvent.click(screen.getByLabelText("終日"));

  expect(screen.getByLabelText("開始日時")).toHaveValue("2026-08-10T09:00");
  expect(screen.getByLabelText("終了日時")).toHaveValue("2026-08-10T10:00");
});

it("keeps the end time following start time + 1 hour until the user edits it manually", () => {
  renderModal();
  fireEvent.click(screen.getByLabelText("終日"));

  fireEvent.change(screen.getByLabelText("開始日時"), { target: { value: "2026-08-10T14:00" } });
  expect(screen.getByLabelText("終了日時")).toHaveValue("2026-08-10T15:00");

  fireEvent.change(screen.getByLabelText("終了日時"), { target: { value: "2026-08-10T18:00" } });
  fireEvent.change(screen.getByLabelText("開始日時"), { target: { value: "2026-08-10T15:00" } });
  expect(screen.getByLabelText("終了日時")).toHaveValue("2026-08-10T18:00");
});

it("re-syncs the end time once a manual edit becomes invalid against a new start time", () => {
  renderModal();
  fireEvent.click(screen.getByLabelText("終日"));

  fireEvent.change(screen.getByLabelText("終了日時"), { target: { value: "2026-08-10T18:00" } });
  fireEvent.change(screen.getByLabelText("開始日時"), { target: { value: "2026-08-10T19:00" } });

  expect(screen.getByLabelText("終了日時")).toHaveValue("2026-08-10T20:00");
});

it("shows the interval field only when recurrence is enabled", async () => {
  renderModal();

  expect(screen.queryByLabelText("間隔")).not.toBeInTheDocument();
  await userEvent.click(screen.getByLabelText("繰り返す"));
  expect(screen.getByLabelText("間隔")).toBeInTheDocument();
});

it("keeps the modal open and shows an error when saving fails", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", fetchMock);
  const { onClose } = renderModal();

  await userEvent.type(screen.getByLabelText("タイトル"), "Lunch");
  await userEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("保存に失敗しました"));
  expect(onClose).not.toHaveBeenCalled();
});

it("opens an existing timed event with its own time fields, ignoring the all-day default", () => {
  const event: CalendarEvent = {
    id: 1,
    title: "Standup",
    description: null,
    start_at: "2026-08-10T03:00:00Z",
    end_at: "2026-08-10T04:00:00Z",
    start_on: null,
    end_on: null,
    all_day: false,
    reminder_minutes: null,
    recurring: false,
    recurrence: null,
  };
  renderModal(vi.fn(), event);

  expect(screen.getByLabelText("終日")).not.toBeChecked();

  const expectedStart = new Date(event.start_at!);
  const offsetMinutes = expectedStart.getTimezoneOffset();
  const localStart = new Date(expectedStart.getTime() - offsetMinutes * 60000).toISOString().slice(0, 16);

  expect(screen.getByLabelText("開始日時")).toHaveValue(localStart);
});

it("does not overwrite the end time when only the start time of an existing timed event is changed", () => {
  const event: CalendarEvent = {
    id: 1,
    title: "Meeting",
    description: null,
    start_at: "2026-08-10T10:00:00Z",
    end_at: "2026-08-10T12:00:00Z",
    start_on: null,
    end_on: null,
    all_day: false,
    reminder_minutes: null,
    recurring: false,
    recurrence: null,
  };
  renderModal(vi.fn(), event);

  // Represent local wall-clock values in the "local-as-UTC" domain (offset already
  // subtracted), matching how the component derives datetime-local field values, so
  // the computed strings are correct regardless of the test runner's timezone.
  const offsetMinutes = new Date(event.start_at!).getTimezoneOffset();
  const localStart = new Date(new Date(event.start_at!).getTime() - offsetMinutes * 60000);
  const localEnd = new Date(new Date(event.end_at).getTime() - offsetMinutes * 60000);
  const newStartValue = new Date(localStart.getTime() - 60 * 60000).toISOString().slice(0, 16);

  fireEvent.change(screen.getByLabelText("開始日時"), { target: { value: newStartValue } });

  expect(screen.getByLabelText("終了日時")).toHaveValue(localEnd.toISOString().slice(0, 16));
});

it("exposes the form as an accessible dialog", () => {
  renderModal();

  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog).toHaveAccessibleName();
});

it("closes the modal when Escape is pressed", () => {
  const { onClose } = renderModal();

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

  expect(onClose).toHaveBeenCalled();
});

it("re-deriving the date from the edited start time when re-checking all-day", () => {
  renderModal();

  fireEvent.click(screen.getByLabelText("終日"));
  fireEvent.change(screen.getByLabelText("開始日時"), { target: { value: "2026-08-15T09:00" } });
  fireEvent.click(screen.getByLabelText("終日"));

  expect(screen.getByLabelText("開始日")).toHaveValue("2026-08-15");
  expect(screen.getByLabelText("終了日")).toHaveValue("2026-08-15");
});

it("opens an existing all-day event with the all-day toggle on", () => {
  const event: CalendarEvent = {
    id: 1,
    title: "Holiday",
    description: null,
    start_at: "2026-08-10T00:00:00Z",
    end_at: "2026-08-11T00:00:00Z",
    start_on: "2026-08-10",
    end_on: "2026-08-10",
    all_day: true,
    reminder_minutes: null,
    recurring: false,
    recurrence: null,
  };
  renderModal(vi.fn(), event);

  expect(screen.getByLabelText("終日")).toBeChecked();
});

it("edits an all-day event with an inclusive end date", async () => {
  const event: CalendarEvent = {
    id: 1,
    title: "Trip",
    description: null,
    start_at: null,
    end_at: null,
    start_on: "2026-08-10",
    end_on: "2026-08-12",
    all_day: true,
    reminder_minutes: null,
    recurring: false,
    recurrence: null,
  };
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(event), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  renderModal(vi.fn(), event);

  expect(screen.getByLabelText("開始日")).toHaveValue("2026-08-10");
  expect(screen.getByLabelText("終了日")).toHaveValue("2026-08-12");
  await userEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
  expect(body.event.start_on).toBe("2026-08-10");
  expect(body.event.end_on).toBe("2026-08-12");
});

it("loads existing recurrence settings into the edit form", () => {
  const event: CalendarEvent = {
    id: 1,
    title: "Standup",
    description: null,
    start_at: "2026-08-10T00:00:00Z",
    end_at: "2026-08-11T00:00:00Z",
    start_on: "2026-08-10",
    end_on: "2026-08-10",
    all_day: true,
    reminder_minutes: null,
    recurring: true,
    recurrence: { frequency: "monthly", interval: 2, until: "2026-12-31" },
  };
  renderModal(vi.fn(), event);

  expect(screen.getByLabelText("繰り返す")).toBeChecked();
  expect(screen.getByLabelText("頻度")).toHaveValue("monthly");
  expect(screen.getByLabelText("間隔")).toHaveValue("2");
});

it("shows a delete confirmation only for an existing event and cancels without a request", async () => {
  const event: CalendarEvent = {
    id: 1, title: "Meeting", description: null, start_at: null, end_at: null,
    start_on: "2026-08-10", end_on: "2026-08-10", all_day: true, reminder_minutes: null, recurring: false, recurrence: null,
  };
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  renderModal(vi.fn(), event);

  await userEvent.click(screen.getByRole("button", { name: "予定を削除" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("このイベントを削除しますか？");
  await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "キャンセル" }));

  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("deletes an event after confirmation and closes the edit modal", async () => {
  const event: CalendarEvent = {
    id: 42, title: "Meeting", description: null, start_at: null, end_at: null,
    start_on: "2026-08-10", end_on: "2026-08-10", all_day: true, reminder_minutes: null, recurring: false, recurrence: null,
  };
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  const { onClose } = renderModal(vi.fn(), event);

  await userEvent.click(screen.getByRole("button", { name: "予定を削除" }));
  await userEvent.click(screen.getByRole("button", { name: "削除する" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0][0]).toContain("/api/events/42");
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});

it("keeps the confirmation open and reports a delete failure", async () => {
  const event: CalendarEvent = {
    id: 1, title: "Meeting", description: null, start_at: null, end_at: null,
    start_on: "2026-08-10", end_on: "2026-08-10", all_day: true, reminder_minutes: null, recurring: false, recurrence: null,
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
  renderModal(vi.fn(), event);

  await userEvent.click(screen.getByRole("button", { name: "予定を削除" }));
  await userEvent.click(screen.getByRole("button", { name: "削除する" }));

  await waitFor(() => expect(screen.getByRole("alertdialog")).toHaveTextContent("削除に失敗しました"));
});

it("explains that deleting a recurring event deletes its series", async () => {
  const event: CalendarEvent = {
    id: 1, title: "Standup", description: null, start_at: null, end_at: null,
    start_on: "2026-08-10", end_on: "2026-08-10", all_day: true, reminder_minutes: null, recurring: true, recurrence: { frequency: "weekly", interval: 1 },
  };
  renderModal(vi.fn(), event);

  await userEvent.click(screen.getByRole("button", { name: "予定を削除" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("この繰り返し予定をすべて削除しますか？");
});
