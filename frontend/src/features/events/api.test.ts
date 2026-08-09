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
