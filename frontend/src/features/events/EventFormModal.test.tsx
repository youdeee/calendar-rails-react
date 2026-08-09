import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  expect(screen.getByLabelText("日付")).toHaveValue("2026-08-10");
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
  expect(new Date(body.event.start_at).toDateString()).toBe(new Date(2026, 7, 10).toDateString());
  expect(new Date(body.event.end_at).toDateString()).toBe(new Date(2026, 7, 11).toDateString());
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
    all_day: false,
    recurring: false,
    recurrence: null,
  };
  renderModal(vi.fn(), event);

  expect(screen.getByLabelText("終日")).not.toBeChecked();

  const expectedStart = new Date(event.start_at);
  const offsetMinutes = expectedStart.getTimezoneOffset();
  const localStart = new Date(expectedStart.getTime() - offsetMinutes * 60000).toISOString().slice(0, 16);

  expect(screen.getByLabelText("開始日時")).toHaveValue(localStart);
});

it("opens an existing all-day event with the all-day toggle on", () => {
  const event: CalendarEvent = {
    id: 1,
    title: "Holiday",
    description: null,
    start_at: "2026-08-10T00:00:00Z",
    end_at: "2026-08-11T00:00:00Z",
    all_day: true,
    recurring: false,
    recurrence: null,
  };
  renderModal(vi.fn(), event);

  expect(screen.getByLabelText("終日")).toBeChecked();
});
