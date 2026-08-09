import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventFormModal } from "./EventFormModal";

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <EventFormModal onClose={onClose} />
    </QueryClientProvider>
  );
  return { onClose };
}

beforeEach(() => {
  vi.restoreAllMocks();
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

it("submits a valid event and closes the modal", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: 1, title: "Lunch", start_at: "2026-08-10T12:00:00Z", end_at: "2026-08-10T13:00:00Z",
        all_day: false, recurring: false, recurrence: null,
      }),
      { status: 201 }
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  const { onClose } = renderModal();

  await userEvent.type(screen.getByLabelText("タイトル"), "Lunch");
  fireEvent.change(screen.getByLabelText("開始日時"), { target: { value: "2026-08-10T12:00" } });
  fireEvent.change(screen.getByLabelText("終了日時"), { target: { value: "2026-08-10T13:00" } });
  await userEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(onClose).toHaveBeenCalled();
});

it("shows the interval field only when recurrence is enabled", async () => {
  renderModal();

  expect(screen.queryByLabelText("間隔")).not.toBeInTheDocument();
  await userEvent.click(screen.getByLabelText("繰り返す"));
  expect(screen.getByLabelText("間隔")).toBeInTheDocument();
});
