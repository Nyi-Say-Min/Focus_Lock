import type { Session, SessionResult } from "../shared/session";
import type { Settings } from "../shared/types";

type Storage = { read(): unknown; write(value: Session): void };

const running = (value: Session | null) => value?.status === "active" || value?.status === "blocking";

function isSession(value: unknown): value is Session | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const item = value as Session;
  return (
    [item.startedAt, item.allowanceEndsAt, item.blockEndsAt].every(Number.isSafeInteger) &&
    item.startedAt >= 0 &&
    item.allowanceEndsAt > item.startedAt &&
    item.blockEndsAt > item.allowanceEndsAt &&
    ["active", "blocking", "completed", "cancelled"].includes(item.status)
  );
}

export function createSessionEngine(storage: Storage, clock = Date.now) {
  let current: Session | null = null;
  let loaded = false;
  const commit = (next: Session) => {
    storage.write(next);
    current = next;
  };
  return (action: "getCurrent" | "start" | "stop", durations?: Settings): SessionResult => {
    try {
      if (!loaded) {
        const saved = storage.read();
        if (!isSession(saved)) return { ok: false, error: "INVALID_SAVED_SESSION" };
        current = saved;
        loaded = true;
      }
      const now = clock();
      if (running(current) && current) {
        const status =
          now >= current.blockEndsAt ? "completed" : now >= current.allowanceEndsAt ? "blocking" : current.status;
        if (status !== current.status) commit({ ...current, status });
      }
      if (action === "start") {
        if (running(current)) return { ok: false, error: "SESSION_ALREADY_ACTIVE" };
        if (
          !durations ||
          ![durations.allowanceMinutes, durations.blockMinutes].every((n) => Number.isInteger(n) && n >= 1 && n <= 1440)
        )
          return { ok: false, error: "INVALID_SESSION_DURATION" };
        const allowanceEndsAt = now + durations.allowanceMinutes * 60_000;
        commit({
          startedAt: now,
          allowanceEndsAt,
          blockEndsAt: allowanceEndsAt + durations.blockMinutes * 60_000,
          status: "active",
        });
      }
      if (action === "stop") {
        if (!running(current) || !current) return { ok: false, error: "NO_ACTIVE_SESSION" };
        commit({ ...current, status: "cancelled" });
      }
      return { ok: true, value: current ? { ...current } : null, now };
    } catch {
      return { ok: false, error: "SESSION_STORAGE_FAILED" };
    }
  };
}
