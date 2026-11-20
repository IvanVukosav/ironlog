import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { useToast } from "../context/useToast";
import {
  bodyWithRealIds,
  flush,
  hasPending,
  knownIds,
  pathWithRealIds,
  pendingCount,
  subscribe,
} from "../utils/outbox";
import { useReportError } from "./useReportError";

// While changes wait, how often to try sending them again (besides when the connection is back).
const RETRY_MS = 15_000;

/** A key that makes a change, sent twice, happen once (the server's Idempotency-Key). */
export function newChangeKey() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

/**
 * Sends a change to a workout, { method, path, json, key }, with its Idempotency-Key. Temporary
 * ids whose real ones are known by now (the screen may still show them) are swapped first.
 */
export function sendChange({ method, path, json, key }) {
  const ids = knownIds();
  return fetchJson(pathWithRealIds(path, ids), {
    method,
    json: json === undefined ? undefined : bodyWithRealIds(json, ids),
    headers: { "Idempotency-Key": key },
  });
}

/** How many changes are waiting to be sent, kept up to date. */
export function usePendingChanges() {
  const [pending, setPending] = useState(pendingCount);
  useEffect(() => subscribe(({ pending: now }) => setPending(now)), []);
  return pending;
}

/**
 * Sends the waiting changes whenever there is a chance: when the app opens, a change is queued,
 * the connection comes back, the app is looked at again, and every RETRY_MS while any wait. Says
 * so once they are all saved, and reports any the server refused. Used once, in App.
 */
export function useOutboxSync() {
  const { t } = useTranslation();
  const { showSuccess } = useToast();
  const reportError = useReportError();

  useEffect(() => {
    const send = () => {
      if (!hasPending()) return;
      flush(sendChange).then(({ refused }) => refused.forEach(reportError));
    };
    const unsubscribe = subscribe(({ pending, previous }) => {
      if (pending === 0 && previous > 0) showSuccess(t("offline.saved"));
      if (pending > previous) send();
    });
    const sendIfShown = () => {
      if (document.visibilityState === "visible") send();
    };
    window.addEventListener("online", send);
    document.addEventListener("visibilitychange", sendIfShown);
    const timer = window.setInterval(send, RETRY_MS);
    send();
    return () => {
      unsubscribe();
      window.removeEventListener("online", send);
      document.removeEventListener("visibilitychange", sendIfShown);
      window.clearInterval(timer);
    };
  }, [t, showSuccess, reportError]);
}
