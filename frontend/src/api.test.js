import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./api";

function stubFetch(status, body) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError("Unexpected end of JSON input");
      return body;
    },
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchJson", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends `json` as a JSON body with the matching header", async () => {
    const fetchMock = stubFetch(200, { id: 1 });

    const data = await fetchJson("/api/workouts", { method: "POST", json: { date: "2026-11-12" } });

    expect(data).toEqual({ id: 1 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/workouts$/);
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.body).toBe('{"date":"2026-11-12"}');
    expect(options).not.toHaveProperty("json");
  });

  it("sends no body and no content type without `json`", async () => {
    const fetchMock = stubFetch(200, []);

    await fetchJson("/api/workouts");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBeUndefined();
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("sends falsy values too, since only a missing `json` means no body", async () => {
    const fetchMock = stubFetch(200, null);

    await fetchJson("/api/anything", { method: "PUT", json: 0 });

    expect(fetchMock.mock.calls[0][1].body).toBe("0");
  });

  it("rejects with the server's error message", async () => {
    stubFetch(400, { error: "Weight is required" });

    await expect(fetchJson("/api/workouts/exercises/1/sets", { json: {} })).rejects.toThrow(
      "Weight is required",
    );
  });

  it("rejects with the status when the failure has no JSON body", async () => {
    stubFetch(502);

    await expect(fetchJson("/api/workouts")).rejects.toThrow("Request failed with status 502");
  });

  it("resolves to null for a success without a body", async () => {
    stubFetch(204);

    await expect(fetchJson("/api/workouts/1", { method: "DELETE" })).resolves.toBeNull();
  });
});
