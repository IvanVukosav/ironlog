// A change sent twice with the same Idempotency-Key header is done once: the second time gets the
// first answer back. The app sends a key with each change to a workout, so a change it sends again
// after a lost connection (which the server may have done already) doesn't happen twice. Answers
// are kept in memory for a day; a restart forgets them, which only matters for a retry across it.

const KEEP_MS = 24 * 60 * 60 * 1000;
const MAX_KEYS = 2000;

function createIdempotency({ now = Date.now } = {}) {
  // Key → { at, status, body }, oldest first (a Map keeps the order keys came in).
  const answers = new Map();

  const forgetOld = () => {
    const cutoff = now() - KEEP_MS;
    for (const [key, saved] of answers) {
      if (saved.at >= cutoff && answers.size <= MAX_KEYS) break;
      answers.delete(key);
    }
  };

  return function idempotency(req, res, next) {
    const key = req.get("Idempotency-Key");
    if (!key || req.method === "GET") return next();
    forgetOld();
    const saved = answers.get(key);
    if (saved) return res.status(saved.status).json(saved.body);

    // Only an answer that did what was asked is kept: a refused change may be sent again.
    const send = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) answers.set(key, { at: now(), status: res.statusCode, body });
      return send(body);
    };
    return next();
  };
}

module.exports = { createIdempotency, KEEP_MS };
