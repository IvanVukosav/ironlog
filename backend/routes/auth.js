const express = require("express");
const router = express.Router();
const {
  isAuthEnabled,
  createToken,
  verifyToken,
  passwordMatches,
  getBearerToken,
} = require("../utils/auth");

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map();

function isLockedOut(ip) {
  const entry = failedAttempts.get(ip);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    failedAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailure(ip) {
  if (failedAttempts.size > 1000) {
    for (const [key, value] of failedAttempts) {
      if (value.resetAt <= Date.now()) failedAttempts.delete(key);
    }
  }

  const entry = failedAttempts.get(ip);
  if (entry && entry.resetAt > Date.now()) {
    entry.count += 1;
  } else {
    failedAttempts.set(ip, { count: 1, resetAt: Date.now() + LOCKOUT_WINDOW_MS });
  }
}

router.get("/status", (req, res) => {
  const required = isAuthEnabled();
  res.json({
    required,
    authenticated: !required || verifyToken(getBearerToken(req)),
  });
});

router.post("/login", (req, res) => {
  if (!isAuthEnabled()) {
    return res.json({ token: null });
  }

  if (isLockedOut(req.ip)) {
    return res.status(429).json({ error: "Too many attempts" });
  }

  if (!passwordMatches(req.body?.password)) {
    recordFailure(req.ip);
    return res.status(401).json({ error: "Wrong password" });
  }

  failedAttempts.delete(req.ip);
  res.json({ token: createToken() });
});

module.exports = router;
