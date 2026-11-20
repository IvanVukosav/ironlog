import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bodyWithRealIds,
  enqueue,
  flush,
  hasPending,
  isConnectionError,
  isWorthRetrying,
  knownIds,
  newTempId,
  pathWithRealIds,
  pendingCount,
  realIdsFrom,
  resetOutbox,
  subscribe,
} from "./outbox";

// localStorage as a plain map, so the queue's storage can be looked at.
function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const refusal = (status, message = "Refused") => Object.assign(new Error(message), { status });
const noConnection = () => new TypeError("Failed to fetch");

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage());
  resetOutbox();
});
afterEach(() => vi.unstubAllGlobals());

describe("the queue", () => {
  it("keeps changes in order, by day, and says when their number moves", () => {
    const events = [];
    const unsubscribe = subscribe((event) => events.push(event));
    enqueue({ date: "2026-11-20", method: "POST", path: "/a" });
    enqueue({ date: "2026-11-20", method: "POST", path: "/b" });
    unsubscribe();
    enqueue({ date: "2026-11-19", method: "POST", path: "/c" });
    expect(pendingCount()).toBe(3);
    expect([hasPending(), hasPending("2026-11-19"), hasPending("2026-11-18")]).toEqual([
      true,
      true,
      false,
    ]);
    expect(events).toEqual([
      { pending: 1, previous: 0 },
      { pending: 2, previous: 1 },
    ]);
  });

  it("keeps its changes in storage, so a closed app still has them", () => {
    enqueue({ date: "2026-11-20", method: "DELETE", path: "/api/workouts/sets/5" });
    const stored = JSON.parse(localStorage.getItem("ironlog-outbox"));
    expect(stored.items).toHaveLength(1);
  });

  it("gives temporary ids below zero, never the same twice", () => {
    expect([newTempId(), newTempId(), newTempId()]).toEqual([-1, -2, -3]);
  });
});

describe("temporary ids", () => {
  const ids = { "-1": 900, "-2": 77 };

  it("are swapped in a path's segments, and nowhere else", () => {
    expect(pathWithRealIds("/api/workouts/-1/exercises", ids)).toBe("/api/workouts/900/exercises");
    expect(pathWithRealIds("/api/workouts/sets/-2", ids)).toBe("/api/workouts/sets/77");
    expect(pathWithRealIds("/api/workouts/sets/-5", ids)).toBe("/api/workouts/sets/-5");
    expect(pathWithRealIds("/api/workouts?date=2026-11-20", ids)).toBe(
      "/api/workouts?date=2026-11-20",
    );
  });

  it("are swapped as numbers anywhere in a body", () => {
    expect(bodyWithRealIds({ exerciseIds: [-2, 5], weight: 100 }, ids)).toEqual({
      exerciseIds: [77, 5],
      weight: 100,
    });
    expect(bodyWithRealIds({ workoutId: -1, name: "-1" }, ids)).toEqual({
      workoutId: 900,
      name: "-1",
    });
    expect(bodyWithRealIds(undefined, ids)).toBeUndefined();
  });

  it("learn their real ids from the answers", () => {
    expect(realIdsFrom({ kind: "row", id: -4 }, { id: 31 })).toEqual({ "-4": 31 });
    const sets = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(realIdsFrom({ kind: "sets", ids: [-5, -6], position: "start" }, sets)).toEqual({
      "-5": 1,
      "-6": 2,
    });
    expect(realIdsFrom({ kind: "sets", ids: [-5, -6], position: "end" }, sets)).toEqual({
      "-5": 3,
      "-6": 4,
    });
    // A program day: Bench press was there already and got two sets, Čučanj is new.
    const workout = {
      exercises: [
        { id: 10, name: "Bench press", sets: [{ id: 100 }, { id: 101 }, { id: 102 }] },
        { id: 11, name: "Čučanj", sets: [{ id: 110 }] },
      ],
    };
    const creates = {
      kind: "programDay",
      exercises: [
        { name: "bench press ", id: null, setIds: [-7, -8] },
        { name: "Čučanj", id: -9, setIds: [-10] },
      ],
    };
    expect(realIdsFrom(creates, workout)).toEqual({ "-7": 101, "-8": 102, "-9": 11, "-10": 110 });
    expect(realIdsFrom(undefined, { id: 1 })).toEqual({});
  });
});

describe("sending the queue", () => {
  // A server that answers each change with what `answer(item)` gives, and keeps what it got.
  function server(answer = () => ({ success: true })) {
    const got = [];
    const send = vi.fn(async (item) => {
      got.push(`${item.method} ${item.path}${item.json ? ` ${JSON.stringify(item.json)}` : ""}`);
      return answer(item);
    });
    return { got, send };
  }

  it("sends the changes in order, each with the real ids the ones before it got", async () => {
    enqueue({
      method: "POST",
      path: "/api/workouts",
      json: { date: "2026-11-20" },
      creates: { kind: "row", id: -1 },
    });
    enqueue({
      method: "POST",
      path: "/api/workouts/-1/exercises",
      json: { name: "Bench press" },
      creates: { kind: "row", id: -2 },
    });
    enqueue({
      method: "POST",
      path: "/api/workouts/exercises/-2/sets",
      json: { weight: 100, reps: 5 },
      creates: { kind: "row", id: -3 },
    });
    enqueue({ method: "PATCH", path: "/api/workouts/sets/-3", json: { isDone: true } });
    const ids = {
      "/api/workouts": 900,
      "/api/workouts/900/exercises": 77,
      "/api/workouts/exercises/77/sets": 5,
    };
    const { got, send } = server((item) => ({ id: ids[item.path] }));

    expect(await flush(send)).toEqual({ remaining: 0, refused: [] });
    expect(got).toEqual([
      'POST /api/workouts {"date":"2026-11-20"}',
      'POST /api/workouts/900/exercises {"name":"Bench press"}',
      'POST /api/workouts/exercises/77/sets {"weight":100,"reps":5}',
      'PATCH /api/workouts/sets/5 {"isDone":true}',
    ]);
    expect(pendingCount()).toBe(0);
    expect(knownIds()).toEqual({ "-1": 900, "-2": 77, "-3": 5 });
  });

  it("stops while there is no connection, and goes on from there later", async () => {
    enqueue({ method: "DELETE", path: "/api/workouts/sets/1" });
    enqueue({ method: "DELETE", path: "/api/workouts/sets/2" });
    const offline = vi.fn(async () => {
      throw noConnection();
    });
    expect(await flush(offline)).toEqual({ remaining: 2, refused: [] });
    expect(offline).toHaveBeenCalledTimes(1);

    const { got, send } = server();
    expect((await flush(send)).remaining).toBe(0);
    expect(got).toEqual(["DELETE /api/workouts/sets/1", "DELETE /api/workouts/sets/2"]);
  });

  it("waits for a server that can't answer now or a login, and drops what it refused", async () => {
    for (const status of [503, 401, 429]) {
      resetOutbox();
      enqueue({ method: "DELETE", path: "/api/workouts/sets/1" });
      const busy = vi.fn(async () => {
        throw refusal(status);
      });
      expect((await flush(busy)).remaining).toBe(1);
    }

    resetOutbox();
    enqueue({ method: "PATCH", path: "/api/workouts/sets/1", json: { reps: "pet" } });
    enqueue({ method: "DELETE", path: "/api/workouts/sets/2" });
    const refusedOnce = refusal(400, "Reps must be a whole number");
    const send = vi.fn(async (item) => {
      if (item.method === "PATCH") throw refusedOnce;
      return { success: true };
    });
    expect(await flush(send)).toEqual({ remaining: 0, refused: [refusedOnce] });
  });

  it("sends a change queued while it runs, and runs only once at a time", async () => {
    enqueue({ method: "DELETE", path: "/api/workouts/sets/1" });
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const got = [];
    const send = vi.fn(async (item) => {
      got.push(item.path);
      if (got.length === 1) await gate;
      return { success: true };
    });
    const first = flush(send);
    const second = flush(send);
    expect(second).toBe(first);
    enqueue({ method: "DELETE", path: "/api/workouts/sets/2" });
    release();
    expect((await first).remaining).toBe(0);
    expect(got).toEqual(["/api/workouts/sets/1", "/api/workouts/sets/2"]);
  });
});

describe("failures", () => {
  it("tell no connection from a refusal", () => {
    expect(isConnectionError(noConnection())).toBe(true);
    expect(isConnectionError(refusal(500))).toBe(false);
    expect(
      [noConnection(), refusal(500), refusal(502), refusal(401), refusal(408)].every(
        isWorthRetrying,
      ),
    ).toBe(true);
    expect([refusal(400), refusal(404), refusal(409), new Error("bug")].some(isWorthRetrying)).toBe(
      false,
    );
  });
});
