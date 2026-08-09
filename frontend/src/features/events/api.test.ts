import { fetchEvents } from "./api";

beforeEach(() => {
  vi.restoreAllMocks();
});

it("requests through the end of the local day, not local midnight", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const from = new Date(2026, 7, 1);
  const to = new Date(2026, 7, 11); // local midnight, as getMonthGridDays produces
  await fetchEvents(from, to);

  const [url] = fetchMock.mock.calls[0] as [string];
  const to_param = new URL(url, "http://localhost").searchParams.get("to")!;
  const expectedEndOfDay = new Date(2026, 7, 11, 23, 59, 59, 999);
  expect(new Date(to_param).getTime()).toBe(expectedEndOfDay.getTime());
});

it("requests from the start of the local day, not the current wall-clock time", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const from = new Date(2026, 7, 1, 15, 30); // afternoon, as `new Date()` would carry
  const to = new Date(2026, 7, 11);
  await fetchEvents(from, to);

  const [url] = fetchMock.mock.calls[0] as [string];
  const from_param = new URL(url, "http://localhost").searchParams.get("from")!;
  const expectedStartOfDay = new Date(2026, 7, 1, 0, 0, 0, 0);
  expect(new Date(from_param).getTime()).toBe(expectedStartOfDay.getTime());
});
