// Changes to a workout that couldn't be sent wait here, in the order they were made, until the
// server can be reached. They are kept in localStorage (in memory if storage is blocked), so an
// app closed in the meantime still has them.
//
// A change that makes something new (a set, an exercise, a workout) gives it a temporary id below
// zero at once, so later changes can name it. When the server answers with the real id, the
// changes after it are sent with that one instead.

const STORAGE_KEY = "ironlog-outbox";
// Temporary ids only have to be remembered as long as something on screen may still use them.
const MAX_REMEMBERED_IDS = 500;

const empty = () => ({ items: [], ids: {}, nextTempId: -1 });

let memory = null;
const listeners = new Set();

function read() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.items)) return { ...empty(), ...stored };
  } catch {
    // No storage (or nothing readable in it): the copy in memory is all there is.
  }
  return memory ?? empty();
}

function write(state) {
  const previous = read().items.length;
  memory = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked or full: the copy in memory keeps the changes while the app is open.
  }
  if (state.items.length !== previous) {
    for (const listener of listeners) listener({ pending: state.items.length, previous });
  }
}

/** Calls `listener({ pending, previous })` each time the number of waiting changes moves. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pendingCount() {
  return read().items.length;
}

/** Whether changes to the workout of `date` (or of any day, without it) are still waiting. */
export function hasPending(date) {
  const { items } = read();
  return date === undefined ? items.length > 0 : items.some((item) => item.date === date);
}

/** A new temporary id: -1, -2, … */
export function newTempId() {
  const state = read();
  write({ ...state, nextTempId: state.nextTempId - 1 });
  return state.nextTempId;
}

/**
 * Puts a change at the end of the queue: { date, method, path, json, key, creates }. `key` is the
 * Idempotency-Key it was first sent with, and `creates` says which temporary ids its answer gives
 * real ones to (see realIdsFrom).
 */
export function enqueue(item) {
  const state = read();
  write({ ...state, items: [...state.items, item] });
}

/** The real ids known so far for temporary ones: { "-3": 812, … }. */
export function knownIds() {
  return read().ids;
}

/**
 * Whether a failed request is worth sending again later: no connection at all (fetch's
 * TypeError), a server that can't answer now (5xx, 408, 429), or a login that has to be renewed
 * first (401). Anything else the server refused, and sending it again would only fail again.
 */
export function isWorthRetrying(err) {
  if (err instanceof TypeError) return true;
  const status = err?.status;
  return status === 401 || status === 408 || status === 429 || status >= 500;
}

/** No connection to the server at all, as opposed to an answer that refused the request. */
export function isConnectionError(err) {
  return err instanceof TypeError;
}

/** A path with its temporary ids ("/api/workouts/sets/-3") swapped for the real ones. */
export function pathWithRealIds(path, ids) {
  return path.replace(/\/(-\d+)(?=\/|\?|$)/g, (segment, id) => `/${ids[id] ?? id}`);
}

/** A body with its temporary ids (negative numbers anywhere in it) swapped for the real ones. */
export function bodyWithRealIds(value, ids) {
  if (typeof value === "number") return value < 0 && ids[value] !== undefined ? ids[value] : value;
  if (Array.isArray(value)) return value.map((entry) => bodyWithRealIds(entry, ids));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([field, entry]) => [field, bodyWithRealIds(entry, ids)]),
    );
  }
  return value;
}

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The real ids that a change's answer gives the temporary ones it made up, by what it `creates`:
 * - { kind: "row", id }: a workout, exercise or set; the answer is that row.
 * - { kind: "sets", ids, position }: sets added at the "start" or "end" of an exercise; the answer
 *   is all of the exercise's sets in their new order.
 * - { kind: "programDay", exercises: [{ name, id, setIds }] }: a program day loaded into the
 *   workout; the answer is the workout. An exercise already in it (id null) took the sets at its
 *   end, and a new one was made with them.
 */
export function realIdsFrom(creates, answer) {
  if (!creates || !answer) return {};
  if (creates.kind === "row") return { [creates.id]: answer.id };
  if (creates.kind === "sets") {
    const fresh =
      creates.position === "start"
        ? answer.slice(0, creates.ids.length)
        : answer.slice(-creates.ids.length);
    return Object.fromEntries(creates.ids.map((id, index) => [id, fresh[index]?.id]));
  }
  if (creates.kind === "programDay") {
    const ids = {};
    for (const exercise of creates.exercises) {
      const saved = answer.exercises?.find((other) => sameName(other.name, exercise.name));
      if (!saved) continue;
      if (exercise.id !== null) ids[exercise.id] = saved.id;
      const fresh = saved.sets.slice(-exercise.setIds.length);
      exercise.setIds.forEach((id, index) => {
        if (fresh[index]) ids[id] = fresh[index].id;
      });
    }
    return ids;
  }
  return {};
}

const keepRecent = (ids) => Object.fromEntries(Object.entries(ids).slice(-MAX_REMEMBERED_IDS));

let flushing = null;

/**
 * Sends the waiting changes one by one, oldest first, through `send(item)` (which sends
 * item.method to item.path with item.json and item.key, the ids already swapped, and resolves to
 * the answer). It stops at the first one that has to wait longer (see isWorthRetrying); one the
 * server refused is dropped and handed back in `refused`. Only one run at a time: a second call
 * gets the run already going.
 */
export function flush(send) {
  if (!flushing) {
    flushing = drain(send).finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function drain(send) {
  const refused = [];
  for (;;) {
    const { items, ids } = read();
    if (items.length === 0) return { remaining: 0, refused };
    const [item] = items;
    let answer;
    try {
      answer = await send({
        ...item,
        path: pathWithRealIds(item.path, ids),
        json: bodyWithRealIds(item.json, ids),
      });
    } catch (err) {
      if (isWorthRetrying(err)) return { remaining: items.length, refused };
      refused.push(err);
    }
    let newIds = {};
    try {
      newIds = realIdsFrom(item.creates, answer);
    } catch {
      // An answer of another shape than expected: the change is saved, its ids just stay unknown
      // until the day is loaded again (it is, once the queue is empty).
    }
    // The queue may have grown while this one was on its way.
    const now = read();
    write({ ...now, items: now.items.slice(1), ids: keepRecent({ ...now.ids, ...newIds }) });
  }
}

/** Forgets everything (for tests). */
export function resetOutbox() {
  memory = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // No storage.
  }
}
