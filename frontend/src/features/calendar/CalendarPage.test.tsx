import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../auth/AuthContext";
import { CalendarPage } from "./CalendarPage";

function mockFetchRouter() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/auth/refresh")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: "t1",
            user: { id: 1, email: "a@example.com", name: "A", avatar_url: null },
          }),
          { status: 200 }
        )
      );
    }
    if (url.includes("/api/events")) {
      return Promise.resolve(new Response("[]", { status: 200 }));
    }
    return Promise.resolve(new Response("{}", { status: 404 }));
  });
}

function renderCalendarPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CalendarPage />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function monthLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", mockFetchRouter());
});

it("shows the current month and moves to the next month on click", async () => {
  renderCalendarPage();
  const today = new Date();

  await screen.findByText(monthLabel(today));

  fireEvent.click(screen.getByRole("button", { name: "次へ" }));

  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  await screen.findByText(monthLabel(nextMonth));
});

it("returns to the current month when the today button is clicked", async () => {
  renderCalendarPage();
  const today = new Date();

  await screen.findByText(monthLabel(today));
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));

  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  await screen.findByText(monthLabel(nextMonth));

  fireEvent.click(screen.getByRole("button", { name: "今日" }));
  await screen.findByText(monthLabel(today));
});

it("shows a day-level label when switching to day view", async () => {
  renderCalendarPage();
  const today = new Date();

  await screen.findByText(monthLabel(today));
  fireEvent.click(screen.getByRole("button", { name: "日" }));

  await screen.findByText(`${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`);
});
