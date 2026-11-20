const test = require("node:test");
const assert = require("node:assert/strict");
const { createIdempotency, KEEP_MS } = require("./idempotency");

// Just enough of Express's req and res for the middleware.
function fakeRequest(method, key) {
  return { method, get: (name) => (name === "Idempotency-Key" ? key : undefined) };
}
function fakeResponse() {
  const res = { statusCode: 200, sent: [] };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.sent.push({ status: res.statusCode, body });
    return res;
  };
  return res;
}
// Runs a request through the middleware; `handle` stands for the route behind it.
function send(middleware, method, key, handle) {
  const req = fakeRequest(method, key);
  const res = fakeResponse();
  let reachedRoute = false;
  middleware(req, res, () => {
    reachedRoute = true;
    handle(res);
  });
  return { res, reachedRoute };
}

test("a change sent again with the same key gets the first answer, without doing it again", () => {
  const middleware = createIdempotency();
  let created = 0;
  const createSet = (res) => res.json({ id: 41 + ++created });
  const first = send(middleware, "POST", "key-1", createSet);
  const again = send(middleware, "POST", "key-1", createSet);
  assert.equal(first.reachedRoute, true);
  assert.equal(again.reachedRoute, false);
  assert.equal(created, 1);
  assert.deepEqual(again.res.sent, [{ status: 200, body: { id: 42 } }]);
  assert.equal(send(middleware, "POST", "key-2", createSet).res.sent[0].body.id, 43);
});

test("without a key, for a read, or after a refusal, the request goes through as usual", () => {
  const middleware = createIdempotency();
  let calls = 0;
  const route = (res) => res.json({ calls: ++calls });
  send(middleware, "POST", undefined, route);
  send(middleware, "POST", undefined, route);
  send(middleware, "GET", "key-1", route);
  send(middleware, "GET", "key-1", route);
  assert.equal(calls, 4);

  const refuse = (res) => res.status(400).json({ error: "Reps must be a whole number" });
  send(middleware, "POST", "key-2", refuse);
  assert.equal(send(middleware, "POST", "key-2", route).reachedRoute, true);
});

test("an answer is kept for a day", () => {
  let now = 0;
  const middleware = createIdempotency({ now: () => now });
  const route = (res) => res.json({ ok: true });
  send(middleware, "DELETE", "key-1", route);
  now = KEEP_MS - 1;
  assert.equal(send(middleware, "DELETE", "key-1", route).reachedRoute, false);
  now = KEEP_MS + 1;
  assert.equal(send(middleware, "DELETE", "key-1", route).reachedRoute, true);
});
