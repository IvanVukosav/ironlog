const crypto = require("crypto");

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Auth is opt-in: without APP_PASSWORD the API stays open (local dev).
function isAuthEnabled() {
  return Boolean(process.env.APP_PASSWORD);
}

// Falls back to the password itself, so changing the password also
// invalidates every token issued before the change.
function getSecret() {
  return process.env.AUTH_SECRET || process.env.APP_PASSWORD;
}

function sign(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function createToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (typeof token !== "string") return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return false;
  }

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

// Hashing both sides first gives equal-length buffers for timingSafeEqual.
function passwordMatches(candidate) {
  const given = crypto
    .createHash("sha256")
    .update(String(candidate ?? ""))
    .digest();
  const expected = crypto.createHash("sha256").update(process.env.APP_PASSWORD).digest();
  return crypto.timingSafeEqual(given, expected);
}

function getBearerToken(req) {
  const header = req.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function requireAuth(req, res, next) {
  if (!isAuthEnabled() || verifyToken(getBearerToken(req))) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}

module.exports = {
  isAuthEnabled,
  createToken,
  verifyToken,
  passwordMatches,
  getBearerToken,
  requireAuth,
};
