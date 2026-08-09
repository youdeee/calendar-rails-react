import { apiFetch, apiRequest, setAccessToken, setUnauthorizedHandler, ApiError } from "./client";

beforeEach(() => {
  setAccessToken(null);
  vi.restoreAllMocks();
});

it("attaches the Authorization header for non-auth endpoints when a token is set", async () => {
  setAccessToken("token-123");
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  await apiFetch("/api/events");

  const [, init] = fetchMock.mock.calls[0];
  expect((init!.headers as Headers).get("Authorization")).toBe("Bearer token-123");
  expect(init!.credentials).toBe("same-origin");
});

it("does not attach Authorization and includes credentials for /api/auth/* endpoints", async () => {
  setAccessToken("token-123");
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  await apiFetch("/api/auth/refresh", { method: "POST" });

  const [, init] = fetchMock.mock.calls[0];
  expect((init!.headers as Headers).has("Authorization")).toBe(false);
  expect(init!.credentials).toBe("include");
});

it("refreshes the access token and retries once on 401", async () => {
  setAccessToken("expired-token");
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "new-token" }), { status: 200 }))
    .mockResolvedValueOnce(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const response = await apiFetch("/api/events");

  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  const [, retriedInit] = fetchMock.mock.calls[2];
  expect((retriedInit!.headers as Headers).get("Authorization")).toBe("Bearer new-token");
});

it("returns the original 401 without looping when refresh also fails", async () => {
  setAccessToken("expired-token");
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response("{}", { status: 401 }));
  vi.stubGlobal("fetch", fetchMock);

  const response = await apiFetch("/api/events");

  expect(response.status).toBe(401);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

describe("apiRequest", () => {
  it("throws ApiError with the parsed message on failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: { message: "Not Found" } }), { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/api/events/999")).rejects.toThrow(ApiError);
  });
});

describe("setUnauthorizedHandler", () => {
  it("calls the registered handler when a mid-session refresh also fails", async () => {
    setAccessToken("expired-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await apiFetch("/api/events");

    expect(handler).toHaveBeenCalledTimes(1);
    setUnauthorizedHandler(null);
  });
});
