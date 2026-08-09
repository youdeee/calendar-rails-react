# カレンダーUI Googleカレンダー風スタイリング Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フロントエンド(`frontend/`)にGoogleカレンダー風のCSSを適用し、それに伴って必要になる日付ナビゲーションと終日予定の作成UIを実装する。

**Architecture:** 既存のReact + Vite + Tailwind v4構成はそのまま流用する。`CalendarPage`が`currentDate`を状態として持ちヘッダーのナビゲーションで更新する形に変更し、週表示・日表示は新規の共通コンポーネント`TimeGrid`で時間軸グリッド化する。予定作成フォームは終日/時間指定を切り替えるトグルを持つ。バックエンドの変更は不要(`all_day`は既にAPI対応済み)。

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), Vitest + React Testing Library, `@dnd-kit/core`(既存のドラッグ&ドロップ、変更なし)。

**設計書:** `docs/superpowers/specs/2026-08-09-calendar-ui-restyle-design.md`

## Global Constraints

- 新規パッケージは追加しない。既存の依存関係(Tailwind v4, dnd-kit, react-query)のみを使う
- サイドバーは実装しない。ナビゲーションはヘッダーに集約する
- 終日予定は単日のみ対応する(開始日=終了日の複数日にまたがる終日予定は対象外)
- 週表示・日表示に時間軸ドラッグ&ドロップは実装しない。月表示の日付間ドラッグは現状維持
- イベントの色分けは行わない(バックエンドに色フィールドがないため、単色の`bg-brand`で統一)
- 月表示の今日ハイライトは既存テスト互換のため`bg-blue-50`クラスを維持する
- 各タスクの実装後、必ず`cd frontend && npm test`(と該当する場合`npm run build`)を実行し、全テストが通ることを確認してからコミットする
- **タスクが1つ完了するごとに、ユーザーに次のタスクへ進んでよいか確認する**(次のタスクには着手しない)

---

## Task 1: 日付ナビゲーションのユーティリティ関数

**Files:**
- Modify: `frontend/src/features/calendar/dateUtils.ts`
- Test: `frontend/src/features/calendar/dateUtils.test.ts`

**Interfaces:**
- Produces: `addMonths(date: Date, amount: number): Date`, `addWeeks(date: Date, amount: number): Date`, `addDays(date: Date, amount: number): Date` — Task 4で使用する

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/features/calendar/dateUtils.test.ts` の末尾に以下を追加する(既存の内容はそのまま残す):

```ts
describe("addDays", () => {
  it("adds the given number of days", () => {
    expect(toDateKey(addDays(new Date(2026, 7, 10), 3))).toBe("2026-08-13");
  });

  it("subtracts days for a negative amount", () => {
    expect(toDateKey(addDays(new Date(2026, 7, 10), -3))).toBe("2026-08-07");
  });

  it("rolls over into the next month", () => {
    expect(toDateKey(addDays(new Date(2026, 7, 30), 3))).toBe("2026-09-02");
  });
});

describe("addWeeks", () => {
  it("adds 7 days per week", () => {
    expect(toDateKey(addWeeks(new Date(2026, 7, 10), 1))).toBe("2026-08-17");
  });

  it("subtracts weeks for a negative amount", () => {
    expect(toDateKey(addWeeks(new Date(2026, 7, 10), -1))).toBe("2026-08-03");
  });
});

describe("addMonths", () => {
  it("adds months, keeping the same day of month", () => {
    expect(toDateKey(addMonths(new Date(2026, 7, 10), 1))).toBe("2026-09-10");
  });

  it("subtracts months for a negative amount", () => {
    expect(toDateKey(addMonths(new Date(2026, 7, 10), -1))).toBe("2026-07-10");
  });

  it("rolls over the year when crossing December", () => {
    expect(toDateKey(addMonths(new Date(2026, 11, 15), 1))).toBe("2027-01-15");
  });

  it("clamps to the last day of the target month instead of overflowing", () => {
    // Jan 31 + 1 month must land on Feb 28 (2026 is not a leap year), not Mar 3
    expect(toDateKey(addMonths(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
  });
});
```

そして先頭のimportを更新する:

```ts
import { getMonthGridDays, getWeekDays, isSameDay, toDateKey, addDays, addWeeks, addMonths } from "./dateUtils";
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd frontend && npx vitest run src/features/calendar/dateUtils.test.ts`
Expected: FAIL(`addDays`/`addWeeks`/`addMonths` が存在しないため)

- [ ] **Step 3: 実装する**

`frontend/src/features/calendar/dateUtils.ts` の末尾(`getWeekDays`の後)に追加:

```ts
export function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function addWeeks(date: Date, amount: number): Date {
  return addDays(date, amount * 7);
}

export function addMonths(date: Date, amount: number): Date {
  const day = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const daysInTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, daysInTargetMonth));
  return result;
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd frontend && npx vitest run src/features/calendar/dateUtils.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
cd frontend
git add src/features/calendar/dateUtils.ts src/features/calendar/dateUtils.test.ts
git commit -m "feat(frontend): add addDays/addWeeks/addMonths date navigation helpers"
```

---

## Task 2: 時間軸グリッドの配置計算ロジック

**Files:**
- Create: `frontend/src/features/calendar/timeGridLayout.ts`
- Test: `frontend/src/features/calendar/timeGridLayout.test.ts`

**Interfaces:**
- Consumes: `isSameDay` from `./dateUtils`(既存)
- Produces: `layoutTimedEvent(event: { start_at: string; end_at: string }, day: Date): { topPercent: number; heightPercent: number }` — Task 7の`TimeGrid`で使用する

- [ ] **Step 1: 失敗するテストを書く**

Create `frontend/src/features/calendar/timeGridLayout.test.ts`:

```ts
import { layoutTimedEvent } from "./timeGridLayout";

function event(startAt: string, endAt: string) {
  return { start_at: startAt, end_at: endAt };
}

it("positions an event fully within the day", () => {
  const { topPercent, heightPercent } = layoutTimedEvent(
    event("2026-08-10T10:00:00", "2026-08-10T11:00:00"),
    new Date(2026, 7, 10)
  );

  expect(topPercent).toBeCloseTo(((10 * 60) / 1440) * 100);
  expect(heightPercent).toBeCloseTo((60 / 1440) * 100);
});

it("starts at 0% for an event beginning at midnight", () => {
  const { topPercent } = layoutTimedEvent(event("2026-08-10T00:00:00", "2026-08-10T01:00:00"), new Date(2026, 7, 10));

  expect(topPercent).toBe(0);
});

it("clips an overnight event to the end of the day when viewed on its start day", () => {
  const { topPercent, heightPercent } = layoutTimedEvent(
    event("2026-08-10T23:00:00", "2026-08-11T01:00:00"),
    new Date(2026, 7, 10)
  );

  expect(topPercent).toBeCloseTo(((23 * 60) / 1440) * 100);
  expect(heightPercent).toBeCloseTo(((1440 - 23 * 60) / 1440) * 100);
});

it("clips an overnight event to the start of the day when viewed on its end day", () => {
  const { topPercent, heightPercent } = layoutTimedEvent(
    event("2026-08-10T23:00:00", "2026-08-11T01:00:00"),
    new Date(2026, 7, 11)
  );

  expect(topPercent).toBe(0);
  expect(heightPercent).toBeCloseTo((60 / 1440) * 100);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd frontend && npx vitest run src/features/calendar/timeGridLayout.test.ts`
Expected: FAIL(`timeGridLayout.ts` が存在しない)

- [ ] **Step 3: 実装する**

Create `frontend/src/features/calendar/timeGridLayout.ts`:

```ts
import { isSameDay } from "./dateUtils";

const MINUTES_PER_DAY = 24 * 60;

function minutesSinceStartOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function layoutTimedEvent(
  event: { start_at: string; end_at: string },
  day: Date
): { topPercent: number; heightPercent: number } {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);

  const startMinutes = isSameDay(start, day) ? minutesSinceStartOfDay(start) : 0;
  const endMinutes = isSameDay(end, day) ? minutesSinceStartOfDay(end) : MINUTES_PER_DAY;

  return {
    topPercent: (startMinutes / MINUTES_PER_DAY) * 100,
    heightPercent: Math.max(((endMinutes - startMinutes) / MINUTES_PER_DAY) * 100, 0),
  };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd frontend && npx vitest run src/features/calendar/timeGridLayout.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
cd frontend
git add src/features/calendar/timeGridLayout.ts src/features/calendar/timeGridLayout.test.ts
git commit -m "feat(frontend): add pure layout calc for the week/day time grid"
```

**既知の制約(このタスクでは対応しない):** `groupEventsByDay`はイベントを開始日のみでバケット化しているため、日をまたぐ時間指定イベント(例: 23:00〜翌1:00)は終了日側のカラムには表示されない。`layoutTimedEvent`自体は両方向のクリップを正しく計算できるが、呼び出し側(Task 7の`TimeGrid`)が終了日側のバケットを見に行かない限りこの分は表示されない。将来`groupEventsByDay`を複数日バケット対応にする際に解消する。

---

## Task 3: フォームバリデーションを終日対応に拡張

**Files:**
- Modify: `frontend/src/features/events/validateEventForm.ts`
- Modify: `frontend/src/features/events/validateEventForm.test.ts`

**Interfaces:**
- Produces: 更新された `EventFormValues`(`allDay: boolean`, `date: string` を追加)と `EventFormErrors`(`date` を追加)、`validateEventForm` — Task 5の`EventFormModal`で使用する

- [ ] **Step 1: 失敗するテストを書く**

Replace `frontend/src/features/events/validateEventForm.test.ts` entirely with:

```ts
import { validateEventForm, type EventFormValues } from "./validateEventForm";

const base: EventFormValues = {
  title: "Meeting",
  allDay: false,
  date: "2026-08-10",
  startAt: "2026-08-10T10:00",
  endAt: "2026-08-10T11:00",
  recurrenceEnabled: false,
  frequency: "weekly",
  interval: "1",
  until: "",
};

it("passes for valid values", () => {
  expect(validateEventForm(base)).toEqual({});
});

it("requires a title", () => {
  expect(validateEventForm({ ...base, title: "" })).toHaveProperty("title");
});

it("rejects a title longer than 200 characters", () => {
  expect(validateEventForm({ ...base, title: "a".repeat(201) })).toHaveProperty("title");
});

it("requires end_at to be after start_at", () => {
  expect(validateEventForm({ ...base, endAt: "2026-08-10T09:00" })).toHaveProperty("endAt");
});

it("rejects end_at equal to start_at, matching the backend's strict inequality", () => {
  expect(validateEventForm({ ...base, endAt: base.startAt })).toHaveProperty("endAt");
});

it("requires a positive integer interval when recurrence is enabled", () => {
  expect(validateEventForm({ ...base, recurrenceEnabled: true, interval: "0" })).toHaveProperty("interval");
  expect(validateEventForm({ ...base, recurrenceEnabled: true, interval: "abc" })).toHaveProperty("interval");
});

it("does not validate interval when recurrence is disabled", () => {
  expect(validateEventForm({ ...base, recurrenceEnabled: false, interval: "abc" })).toEqual({});
});

it("requires a date when all-day is enabled, and ignores start/end time fields", () => {
  const allDayValues = { ...base, allDay: true, date: "", startAt: "", endAt: "" };
  expect(validateEventForm(allDayValues)).toHaveProperty("date");
  expect(validateEventForm({ ...allDayValues, date: "2026-08-10" })).toEqual({});
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd frontend && npx vitest run src/features/events/validateEventForm.test.ts`
Expected: FAIL(`EventFormValues` に `allDay`/`date` が存在しない型エラー、および終日バリデーションが未実装)

- [ ] **Step 3: 実装する**

Replace `frontend/src/features/events/validateEventForm.ts` entirely with:

```ts
export type EventFormValues = {
  title: string;
  allDay: boolean;
  date: string;
  startAt: string;
  endAt: string;
  recurrenceEnabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  interval: string;
  until: string;
};

export type EventFormErrors = Partial<Record<"title" | "date" | "startAt" | "endAt" | "interval", string>>;

export function validateEventForm(values: EventFormValues): EventFormErrors {
  const errors: EventFormErrors = {};

  if (!values.title.trim()) {
    errors.title = "タイトルを入力してください";
  } else if (values.title.length > 200) {
    errors.title = "タイトルは200文字以内で入力してください";
  }

  if (values.allDay) {
    if (!values.date) errors.date = "日付を入力してください";
  } else {
    if (!values.startAt) errors.startAt = "開始日時を入力してください";
    if (!values.endAt) errors.endAt = "終了日時を入力してください";
    if (values.startAt && values.endAt && new Date(values.endAt) <= new Date(values.startAt)) {
      errors.endAt = "終了日時は開始日時より後にしてください";
    }
  }

  if (values.recurrenceEnabled) {
    const interval = Number(values.interval);
    if (!Number.isInteger(interval) || interval <= 0) {
      errors.interval = "繰り返し間隔は1以上の整数で入力してください";
    }
  }

  return errors;
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd frontend && npx vitest run src/features/events/validateEventForm.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
cd frontend
git add src/features/events/validateEventForm.ts src/features/events/validateEventForm.test.ts
git commit -m "feat(frontend): support all-day validation in the event form"
```

**注意:** この時点で `EventFormModal.tsx` は古い `EventFormValues` の形(`allDay`/`date` なし)を前提にしているため型エラーになる。Task 5で解消するまでの一時的な状態であり、この計画の意図した進行順序。

---

## Task 4: ヘッダーと日付ナビゲーションの実装

**Files:**
- Modify: `frontend/src/features/calendar/CalendarPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/features/calendar/CalendarPage.test.tsx` (create)

**Interfaces:**
- Consumes: Task 1の `addMonths`/`addWeeks`/`addDays`、既存の `useAuth`(`user`, `logout`)
- Produces: `CalendarPage` が `currentDate` の状態とセッターを持つようになる(Task 5でモーダルへ`defaultDate`として渡す際に使う)

- [ ] **Step 1: 失敗するテストを書く**

Create `frontend/src/features/calendar/CalendarPage.test.tsx`:

```tsx
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd frontend && npx vitest run src/features/calendar/CalendarPage.test.tsx`
Expected: FAIL(「次へ」「今日」ボタンや年月表示が存在しない)

- [ ] **Step 3: 実装する**

`frontend/src/index.css` を以下に置き換える:

```css
@import "tailwindcss";

@theme {
  --color-brand: #1a73e8;
}
```

Replace `frontend/src/features/calendar/CalendarPage.tsx` entirely with:

```tsx
import { useState } from "react";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { EventFormModal } from "../events/EventFormModal";
import { addMonths, addWeeks, addDays } from "./dateUtils";
import { useAuth } from "../auth/AuthContext";
import type { CalendarEvent } from "../events/api";

type ViewMode = "month" | "week" | "day";

const VIEW_LABELS: Record<ViewMode, string> = { month: "月", week: "週", day: "日" };

function formatHeaderLabel(date: Date, viewMode: ViewMode): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (viewMode === "day") return `${year}年${month}月${date.getDate()}日`;
  return `${year}年${month}月`;
}

function stepDate(date: Date, viewMode: ViewMode, direction: 1 | -1): Date {
  if (viewMode === "month") return addMonths(date, direction);
  if (viewMode === "week") return addWeeks(date, direction);
  return addDays(date, direction);
}

export function CalendarPage() {
  const { user, logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);

  const isModalOpen = isCreating || editingEvent !== undefined;

  function closeModal() {
    setIsCreating(false);
    setEditingEvent(undefined);
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-gray-200 px-4 py-2">
        <span className="text-xl font-medium text-gray-700">カレンダー</span>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
        >
          今日
        </button>
        <div className="flex items-center">
          <button
            aria-label="前へ"
            onClick={() => setCurrentDate((d) => stepDate(d, viewMode, -1))}
            className="rounded-full p-2 hover:bg-gray-100"
          >
            ←
          </button>
          <button
            aria-label="次へ"
            onClick={() => setCurrentDate((d) => stepDate(d, viewMode, 1))}
            className="rounded-full p-2 hover:bg-gray-100"
          >
            →
          </button>
        </div>
        <span className="text-lg text-gray-700">{formatHeaderLabel(currentDate, viewMode)}</span>

        <button
          onClick={() => setIsCreating(true)}
          className="ml-4 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:brightness-110"
        >
          予定を追加
        </button>

        <div className="ml-auto flex items-center gap-2">
          {(["month", "week", "day"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded px-3 py-1.5 text-sm ${
                viewMode === mode ? "bg-blue-100 text-brand" : "hover:bg-gray-100"
              }`}
            >
              {VIEW_LABELS[mode]}
            </button>
          ))}
          {user?.avatar_url && <img src={user.avatar_url} alt={user.name} className="h-8 w-8 rounded-full" />}
          <button onClick={() => void logout()} className="rounded px-3 py-1.5 text-sm hover:bg-gray-100">
            ログアウト
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {viewMode === "month" && <MonthView month={currentDate} onSelectEvent={setEditingEvent} />}
        {viewMode === "week" && <WeekView weekStart={currentDate} onSelectEvent={setEditingEvent} />}
        {viewMode === "day" && <DayView day={currentDate} onSelectEvent={setEditingEvent} />}
      </div>

      {isModalOpen && <EventFormModal event={editingEvent} onClose={closeModal} />}
    </div>
  );
}
```

Replace `frontend/src/App.tsx` entirely with:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { GoogleLoginButton } from "./features/auth/GoogleLoginButton";
import { CalendarPage } from "./features/calendar/CalendarPage";

const queryClient = new QueryClient();

function AuthGate() {
  const { status } = useAuth();

  if (status === "loading") return <div>Loading...</div>;
  if (status === "unauthenticated") return <GoogleLoginButton />;

  return <CalendarPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd frontend && npm test`
Expected: PASS(全ファイル。`vitest`は型チェックをしないため、`EventFormModal.tsx`がTask 3で変更した`EventFormValues`の新しい形(`allDay`/`date`)にまだ追随していなくても実行時テストは通る — 未設定の`values.allDay`は`undefined`となり、既存の非終日ロジックにフォールスルーするため。ただし`npm run build`(`tsc`)はTask 5まで型エラーになるので、このタスクでは実行しない)

- [ ] **Step 5: コミット**

```bash
cd frontend
git add src/features/calendar/CalendarPage.tsx src/features/calendar/CalendarPage.test.tsx src/App.tsx src/index.css
git commit -m "feat(frontend): add calendar header with date navigation and view switching"
```

---

## Task 5: 予定作成・編集モーダルの再構築

**Files:**
- Modify: `frontend/src/features/events/EventFormModal.tsx`
- Modify: `frontend/src/features/events/EventFormModal.test.tsx`
- Modify: `frontend/src/features/calendar/CalendarPage.tsx:` の `EventFormModal` 呼び出し箇所

**Interfaces:**
- Consumes: Task 3の `validateEventForm`/`EventFormValues`/`EventFormErrors`、既存の `toDateKey`(`../calendar/dateUtils`)
- Produces: `EventFormModal` の Props が `{ event?: CalendarEvent; defaultDate: Date; onClose: () => void }` になる

- [ ] **Step 1: 失敗するテストを書く**

Replace `frontend/src/features/events/EventFormModal.test.tsx` entirely with:

```tsx
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd frontend && npx vitest run src/features/events/EventFormModal.test.tsx`
Expected: FAIL(`defaultDate` propが存在しない、「終日」チェックボックスが存在しない)

- [ ] **Step 3: 実装する**

Replace `frontend/src/features/events/EventFormModal.tsx` entirely with:

```tsx
import { useState, type FormEvent } from "react";
import { useCreateEvent, useUpdateEvent } from "./hooks";
import { validateEventForm, type EventFormValues, type EventFormErrors } from "./validateEventForm";
import { toDateKey } from "../calendar/dateUtils";
import type { CalendarEvent, RecurrenceParams } from "./api";

type Props = {
  event?: CalendarEvent;
  defaultDate: Date;
  onClose: () => void;
};

// datetime-local inputs display and submit local wall-clock time, but the API
// exchanges UTC ISO strings; slicing the UTC string directly would show (and
// on re-save, silently shift by) the browser's UTC offset.
function toDatetimeLocalValue(isoString: string): string {
  const date = new Date(isoString);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function addHours(datetimeLocalValue: string, hours: number): string {
  const date = new Date(datetimeLocalValue);
  date.setHours(date.getHours() + hours);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateOnlyToRange(dateStr: string): { start_at: string; end_at: string } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

function toFormValues(event: CalendarEvent | undefined, defaultDate: Date): EventFormValues {
  if (!event) {
    return {
      title: "",
      allDay: true,
      date: toDateKey(defaultDate),
      startAt: "",
      endAt: "",
      recurrenceEnabled: false,
      frequency: "weekly",
      interval: "1",
      until: "",
    };
  }

  return {
    title: event.title,
    allDay: event.all_day,
    date: toDateKey(new Date(event.start_at)),
    startAt: event.all_day ? "" : toDatetimeLocalValue(event.start_at),
    endAt: event.all_day ? "" : toDatetimeLocalValue(event.end_at),
    recurrenceEnabled: Boolean(event.recurrence),
    frequency: event.recurrence?.frequency ?? "weekly",
    interval: String(event.recurrence?.interval ?? 1),
    until: event.recurrence?.until ?? "",
  };
}

export function EventFormModal({ event, defaultDate, onClose }: Props) {
  const [values, setValues] = useState<EventFormValues>(() => toFormValues(event, defaultDate));
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [endAtTouched, setEndAtTouched] = useState(false);
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const errorMessages = Object.values(errors).filter((message): message is string => Boolean(message));

  function updateField<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleStartAtChange(newStartAt: string) {
    setValues((prev) => {
      const shouldAutoFillEnd = !endAtTouched || !prev.endAt || new Date(prev.endAt) <= new Date(newStartAt);
      return {
        ...prev,
        startAt: newStartAt,
        endAt: shouldAutoFillEnd && newStartAt ? addHours(newStartAt, 1) : prev.endAt,
      };
    });
  }

  function handleEndAtChange(newEndAt: string) {
    setEndAtTouched(true);
    updateField("endAt", newEndAt);
  }

  function handleAllDayToggle(checked: boolean) {
    if (checked) {
      updateField("allDay", true);
      return;
    }
    const startAt = `${values.date}T09:00`;
    setEndAtTouched(false);
    setValues((prev) => ({ ...prev, allDay: false, startAt, endAt: addHours(startAt, 1) }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validateEventForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const recurrence: RecurrenceParams | null = values.recurrenceEnabled
      ? { frequency: values.frequency, interval: Number(values.interval), until: values.until || null }
      : null;

    const { start_at, end_at } = values.allDay
      ? dateOnlyToRange(values.date)
      : { start_at: new Date(values.startAt).toISOString(), end_at: new Date(values.endAt).toISOString() };

    const input = { title: values.title, start_at, end_at, all_day: values.allDay, recurrence };

    if (event) {
      updateEvent.mutate({ id: event.id, input }, { onSuccess: onClose });
    } else {
      createEvent.mutate(input, { onSuccess: onClose });
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-3 rounded-lg bg-white p-6 shadow-lg">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          タイトル
          <input
            value={values.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={values.allDay} onChange={(e) => handleAllDayToggle(e.target.checked)} />
          終日
        </label>

        {values.allDay ? (
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            日付
            <input
              type="date"
              value={values.date}
              onChange={(e) => updateField("date", e.target.value)}
              className="rounded border border-gray-300 px-2 py-1.5"
            />
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              開始日時
              <input
                type="datetime-local"
                value={values.startAt}
                onChange={(e) => handleStartAtChange(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              終了日時
              <input
                type="datetime-local"
                value={values.endAt}
                onChange={(e) => handleEndAtChange(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5"
              />
            </label>
          </>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={values.recurrenceEnabled}
            onChange={(e) => updateField("recurrenceEnabled", e.target.checked)}
          />
          繰り返す
        </label>

        {values.recurrenceEnabled && (
          <>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              頻度
              <select
                value={values.frequency}
                onChange={(e) => updateField("frequency", e.target.value as EventFormValues["frequency"])}
                className="rounded border border-gray-300 px-2 py-1.5"
              >
                <option value="daily">毎日</option>
                <option value="weekly">毎週</option>
                <option value="monthly">毎月</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              間隔
              <input
                value={values.interval}
                onChange={(e) => updateField("interval", e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5"
              />
            </label>
          </>
        )}

        {errorMessages.length > 0 && (
          <p role="alert" className="text-sm text-red-600">
            {errorMessages.join(" ")}
          </p>
        )}
        {(createEvent.isError || updateEvent.isError) && (
          <p role="alert" className="text-sm text-red-600">
            保存に失敗しました
          </p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-gray-100">
            キャンセル
          </button>
          <button
            type="submit"
            className="rounded bg-brand px-4 py-1.5 text-sm font-medium text-white hover:brightness-110"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
```

In `frontend/src/features/calendar/CalendarPage.tsx`, update the modal render line:

```tsx
      {isModalOpen && <EventFormModal event={editingEvent} onClose={closeModal} />}
```

to:

```tsx
      {isModalOpen && <EventFormModal event={editingEvent} defaultDate={currentDate} onClose={closeModal} />}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd frontend && npm test`
Expected: PASS(全ファイル)

- [ ] **Step 5: コミット**

```bash
cd frontend
git add src/features/events/EventFormModal.tsx src/features/events/EventFormModal.test.tsx src/features/calendar/CalendarPage.tsx
git commit -m "feat(frontend): rebuild the event modal with an all-day toggle and smart defaults"
```

---

## Task 6: 月表示のGoogleカレンダー風スタイリング

**Files:**
- Modify: `frontend/src/features/calendar/MonthView.tsx`
- Modify: `frontend/src/features/calendar/MonthView.test.tsx`

**Interfaces:**
- 変更なし。`MonthView`のPropsは`{ month: Date; onSelectEvent: (event: CalendarEvent) => void }`のまま

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/features/calendar/MonthView.test.tsx` の末尾に以下を追加する(既存の内容はそのまま残す):

```tsx
it("caps events at 3 per day and shows an overflow count", async () => {
  const events = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    title: `Event ${i + 1}`,
    description: null,
    start_at: "2026-08-10T09:00:00+09:00",
    end_at: "2026-08-10T10:00:00+09:00",
    all_day: false,
    recurring: false,
  }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(events), { status: 200 })));

  renderMonthView();

  await waitFor(() => screen.getByText("Event 1"));
  expect(screen.getByText("Event 3")).toBeInTheDocument();
  expect(screen.queryByText("Event 4")).not.toBeInTheDocument();
  expect(screen.getByText("+2件")).toBeInTheDocument();
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd frontend && npx vitest run src/features/calendar/MonthView.test.tsx`
Expected: FAIL(件数キャップが未実装のため5件全て表示され、「+2件」が存在しない)

- [ ] **Step 3: 実装する**

Replace `frontend/src/features/calendar/MonthView.tsx` entirely with:

```tsx
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { getMonthGridDays, isSameDay, toDateKey } from "./dateUtils";
import { computeDroppedDates } from "./dragDrop";
import { groupEventsByDay } from "./groupEventsByDay";
import { EventLabel } from "./EventButton";
import { useEvents, useUpdateEvent } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  month: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const MAX_VISIBLE_EVENTS = 3;

function capEvents(events: CalendarEvent[]): { visible: CalendarEvent[]; overflowCount: number } {
  if (events.length <= MAX_VISIBLE_EVENTS) return { visible: events, overflowCount: 0 };
  return { visible: events.slice(0, MAX_VISIBLE_EVENTS), overflowCount: events.length - MAX_VISIBLE_EVENTS };
}

function EventChip({ event, onSelectEvent }: { event: CalendarEvent; onSelectEvent: (e: CalendarEvent) => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `${event.id}:${event.start_at}`,
    disabled: event.recurring,
    data: { event },
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelectEvent(event)}
      className="truncate rounded bg-brand px-1.5 py-0.5 text-left text-xs text-white hover:brightness-110"
    >
      <EventLabel event={event} />
    </button>
  );
}

function DayCell({
  day,
  today,
  month,
  events,
  onSelectEvent,
}: {
  day: Date;
  today: Date;
  month: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
}) {
  const key = toDateKey(day);
  const { setNodeRef } = useDroppable({ id: key });
  const isCurrentMonth = day.getMonth() === month.getMonth();
  const { visible, overflowCount } = capEvents(events);

  const dateLabelClass = isSameDay(day, today)
    ? "flex h-6 w-6 items-center justify-center rounded-full bg-brand font-medium text-white"
    : isCurrentMonth
      ? "text-gray-700"
      : "text-gray-400";

  return (
    <div
      ref={setNodeRef}
      data-date-key={key}
      className={`flex min-h-24 flex-col gap-1 border-b border-r border-gray-200 p-1 ${
        isSameDay(day, today) ? "bg-blue-50" : ""
      }`}
    >
      <div className={`self-end text-sm ${dateLabelClass}`}>{day.getDate()}</div>
      {visible.map((event) => (
        <EventChip key={`${event.id}-${event.start_at}`} event={event} onSelectEvent={onSelectEvent} />
      ))}
      {overflowCount > 0 && <span className="text-xs text-gray-500">+{overflowCount}件</span>}
    </div>
  );
}

export function MonthView({ month, onSelectEvent }: Props) {
  const days = getMonthGridDays(month);
  const { data: events = [], isError } = useEvents(days[0], days[days.length - 1]);
  const updateEvent = useUpdateEvent();
  const eventsByDay = groupEventsByDay(events);
  const today = new Date();
  // Without a movement threshold, PointerSensor activates a drag on plain
  // pointerdown and swallows the resulting click, breaking click-to-open.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;

    const event = active.data.current?.event as CalendarEvent | undefined;
    if (!event || event.recurring) return;

    const updated = computeDroppedDates(event, String(over.id));
    if (!updated) return;

    updateEvent.mutate({ id: event.id, input: updated });
  }

  return (
    <div className="flex h-full flex-col">
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      {updateEvent.isError && <p role="alert">予定の更新に失敗しました</p>}
      <div className="grid grid-cols-7 border-b border-gray-200 text-center text-xs text-gray-500">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid flex-1 grid-cols-7 border-l border-t border-gray-200">
          {days.map((day) => {
            const key = toDateKey(day);
            return (
              <DayCell
                key={key}
                day={day}
                today={today}
                month={month}
                events={eventsByDay.get(key) ?? []}
                onSelectEvent={onSelectEvent}
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd frontend && npx vitest run src/features/calendar/MonthView.test.tsx`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
cd frontend
git add src/features/calendar/MonthView.tsx src/features/calendar/MonthView.test.tsx
git commit -m "feat(frontend): restyle month view as a Google Calendar-like grid"
```

---

## Task 7: 時間軸グリッド共通コンポーネント(TimeGrid)

**Files:**
- Create: `frontend/src/features/calendar/TimeGrid.tsx`
- Test: `frontend/src/features/calendar/TimeGrid.test.tsx`

**Interfaces:**
- Consumes: Task 2の `layoutTimedEvent`、既存の `toDateKey`/`isSameDay`(`./dateUtils`)、`EventLabel`(`./EventButton`)
- Produces: `TimeGrid({ days: Date[], eventsByDay: Map<string, CalendarEvent[]>, onSelectEvent: (event: CalendarEvent) => void })` — Task 8で `WeekView`/`DayView` から使用する

- [ ] **Step 1: 失敗するテストを書く**

Create `frontend/src/features/calendar/TimeGrid.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeGrid } from "./TimeGrid";
import type { CalendarEvent } from "../events/api";

function makeEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 1,
    title: "Event",
    description: null,
    start_at: "2026-08-10T09:00:00",
    end_at: "2026-08-10T10:00:00",
    all_day: false,
    recurring: false,
    recurrence: null,
    ...overrides,
  };
}

it("renders all-day events in the all-day row", () => {
  const day = new Date(2026, 7, 10);
  const eventsByDay = new Map([["2026-08-10", [makeEvent({ id: 1, title: "Holiday", all_day: true })]]]);

  render(<TimeGrid days={[day]} eventsByDay={eventsByDay} onSelectEvent={vi.fn()} />);

  expect(screen.getByText("Holiday")).toBeInTheDocument();
});

it("calls onSelectEvent when a timed event block is clicked", async () => {
  const day = new Date(2026, 7, 10);
  const eventsByDay = new Map([["2026-08-10", [makeEvent({ id: 2, title: "Lunch" })]]]);
  const onSelectEvent = vi.fn();

  render(<TimeGrid days={[day]} eventsByDay={eventsByDay} onSelectEvent={onSelectEvent} />);

  await userEvent.click(screen.getByText("Lunch"));

  expect(onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
});

it("shows the current time line only on the column matching today", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 10, 12, 0));

  const today = new Date(2026, 7, 10);
  const otherDay = new Date(2026, 7, 11);
  const eventsByDay = new Map<string, CalendarEvent[]>();

  const { container } = render(<TimeGrid days={[today, otherDay]} eventsByDay={eventsByDay} onSelectEvent={vi.fn()} />);

  const lines = container.querySelectorAll(".border-red-500");
  expect(lines).toHaveLength(1);

  vi.useRealTimers();
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd frontend && npx vitest run src/features/calendar/TimeGrid.test.tsx`
Expected: FAIL(`TimeGrid.tsx` が存在しない)

- [ ] **Step 3: 実装する**

Create `frontend/src/features/calendar/TimeGrid.tsx`:

```tsx
import { toDateKey, isSameDay } from "./dateUtils";
import { layoutTimedEvent } from "./timeGridLayout";
import { EventLabel } from "./EventButton";
import type { CalendarEvent } from "../events/api";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_ROW_HEIGHT_PX = 48;
const GRID_HEIGHT_PX = HOUR_ROW_HEIGHT_PX * HOURS.length;
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

type Props = {
  days: Date[];
  eventsByDay: Map<string, CalendarEvent[]>;
  onSelectEvent: (event: CalendarEvent) => void;
};

function CurrentTimeLine() {
  const now = new Date();
  const topPercent = ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-red-500"
      style={{ top: `${topPercent}%` }}
    />
  );
}

export function TimeGrid({ days, eventsByDay, onSelectEvent }: Props) {
  const today = new Date();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex border-b border-gray-200">
        <div className="w-14 shrink-0" />
        {days.map((day) => (
          <div
            key={toDateKey(day)}
            className="flex-1 border-l border-gray-200 py-1 text-center text-xs text-gray-500"
          >
            {WEEKDAY_LABELS[day.getDay()]}{" "}
            <span
              className={
                isSameDay(day, today)
                  ? "ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand font-medium text-white"
                  : "ml-1"
              }
            >
              {day.getDate()}
            </span>
          </div>
        ))}
      </div>

      <div className="flex border-b border-gray-200">
        <div className="w-14 shrink-0 text-right text-xs text-gray-400">終日</div>
        {days.map((day) => {
          const dayEvents = eventsByDay.get(toDateKey(day)) ?? [];
          const allDayEvents = dayEvents.filter((event) => event.all_day);
          return (
            <div key={toDateKey(day)} className="flex flex-1 flex-col gap-1 border-l border-gray-200 p-1">
              {allDayEvents.map((event) => (
                <button
                  key={`${event.id}-${event.start_at}`}
                  onClick={() => onSelectEvent(event)}
                  className="truncate rounded bg-brand px-1.5 py-0.5 text-left text-xs text-white"
                >
                  <EventLabel event={event} />
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="relative flex" style={{ height: `${GRID_HEIGHT_PX}px` }}>
        <div className="w-14 shrink-0">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="pr-1 text-right text-xs text-gray-400"
              style={{ height: `${HOUR_ROW_HEIGHT_PX}px` }}
            >
              {hour === 0 ? "" : `${hour}:00`}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayEvents = eventsByDay.get(toDateKey(day)) ?? [];
          const timedEvents = dayEvents.filter((event) => !event.all_day);

          return (
            <div key={toDateKey(day)} className="relative flex-1 border-l border-gray-200">
              {HOURS.map((hour) => (
                <div key={hour} className="border-b border-gray-100" style={{ height: `${HOUR_ROW_HEIGHT_PX}px` }} />
              ))}
              {isSameDay(day, today) && <CurrentTimeLine />}
              {timedEvents.map((event) => {
                const { topPercent, heightPercent } = layoutTimedEvent(event, day);
                return (
                  <button
                    key={`${event.id}-${event.start_at}`}
                    onClick={() => onSelectEvent(event)}
                    className="absolute left-1 right-1 overflow-hidden rounded bg-brand px-1.5 py-0.5 text-left text-xs text-white"
                    style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
                  >
                    <EventLabel event={event} />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd frontend && npx vitest run src/features/calendar/TimeGrid.test.tsx`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
cd frontend
git add src/features/calendar/TimeGrid.tsx src/features/calendar/TimeGrid.test.tsx
git commit -m "feat(frontend): add shared hour-grid component for week/day views"
```

---

## Task 8: 週表示・日表示の作り直し、不要コードの削除、最終確認

**Files:**
- Modify: `frontend/src/features/calendar/WeekView.tsx`
- Modify: `frontend/src/features/calendar/DayView.tsx`
- Modify: `frontend/src/features/calendar/EventButton.tsx`

**Interfaces:**
- Consumes: Task 7の `TimeGrid`
- 変更なし: `WeekView`/`DayView`のPropsはそれぞれ既存のまま(`{ weekStart: Date; onSelectEvent }` / `{ day: Date; onSelectEvent }`)

- [ ] **Step 1: 実装する(このタスクは既存コンポーネントの置き換えのため、TimeGridのテストが既にカバーしているロジックの再テストはしない)**

Replace `frontend/src/features/calendar/WeekView.tsx` entirely with:

```tsx
import { getWeekDays } from "./dateUtils";
import { groupEventsByDay } from "./groupEventsByDay";
import { TimeGrid } from "./TimeGrid";
import { useEvents } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  weekStart: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function WeekView({ weekStart, onSelectEvent }: Props) {
  const days = getWeekDays(weekStart);
  const { data: events = [], isError } = useEvents(days[0], days[days.length - 1]);
  const eventsByDay = groupEventsByDay(events);

  return (
    <div className="flex h-full flex-col">
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      <TimeGrid days={days} eventsByDay={eventsByDay} onSelectEvent={onSelectEvent} />
    </div>
  );
}
```

Replace `frontend/src/features/calendar/DayView.tsx` entirely with:

```tsx
import { groupEventsByDay } from "./groupEventsByDay";
import { TimeGrid } from "./TimeGrid";
import { useEvents } from "../events/hooks";
import type { CalendarEvent } from "../events/api";

type Props = {
  day: Date;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function DayView({ day, onSelectEvent }: Props) {
  const { data: events = [], isError } = useEvents(day, day);
  const eventsByDay = groupEventsByDay(events);

  return (
    <div className="flex h-full flex-col">
      {isError && <p role="alert">予定の取得に失敗しました</p>}
      <TimeGrid days={[day]} eventsByDay={eventsByDay} onSelectEvent={onSelectEvent} />
    </div>
  );
}
```

`EventButton`は`WeekView`/`DayView`から使われなくなり、`EventLabel`のみが(`MonthView`/`TimeGrid`から)使われ続ける。Replace `frontend/src/features/calendar/EventButton.tsx` entirely with:

```tsx
import type { CalendarEvent } from "../events/api";

export function EventLabel({ event }: { event: CalendarEvent }) {
  return (
    <>
      {event.title}
      {event.recurring && <span> (繰り返し)</span>}
    </>
  );
}
```

- [ ] **Step 2: フロントエンド全体のテストと型チェックを実行する**

Run: `cd frontend && npm test`
Expected: PASS(全ファイル)

Run: `cd frontend && npm run build`
Expected: 成功(型エラー・未使用importなし)

- [ ] **Step 3: バックエンドのテストも変更していないことを確認する(念のため)**

Run: `cd backend && bundle exec rspec`
Expected: PASS(69 examples, 0 failures — このタスクではバックエンドを変更していないため元々通っているはず)

- [ ] **Step 4: 開発サーバーで目視確認する**

Run: `cd frontend && npm run dev` (バックエンドも`cd backend && bin/rails s`で起動しておく)
ブラウザで `http://localhost:5173` を開き、以下を確認する:
- 月表示: グリッド、今日のハイライト、イベントチップ、5件以上の予定がある日に「+N件」が出ること
- 週表示・日表示: 時間軸グリッドが表示され、終日予定が上部の行に出ること、今日の列に赤い現在時刻線が出ること
- 「予定を追加」→ デフォルトで「終日」がONで日付が現在表示中の日になっていること。「終日」を外すと開始9:00・終了10:00が入ること
- ヘッダーの「今日」「←」「→」で表示期間が変わること

- [ ] **Step 5: コミット**

```bash
cd frontend
git add src/features/calendar/WeekView.tsx src/features/calendar/DayView.tsx src/features/calendar/EventButton.tsx
git commit -m "feat(frontend): rebuild week/day views on the shared time grid"
```

---

## 既知の制約(将来拡張)

- 日をまたぐ時間指定イベント(例: 23:00〜翌1:00)は開始日側のカラムにのみ表示される(`groupEventsByDay`が開始日のみでバケット化しているため)
- 終日予定は単日のみ。複数日にまたがる終日予定(旅行など)は未対応
- 週表示・日表示での時間軸上のドラッグ&ドロップ(時刻変更)は未実装。月表示の日付間ドラッグのみ
- 複数カレンダー・色分けは未対応(全イベント単色)
