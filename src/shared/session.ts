export type Session = {
  startedAt: number;
  allowanceEndsAt: number;
  blockEndsAt: number;
  status: "active" | "blocking" | "completed" | "cancelled";
};

export type SessionResult =
  { ok: true; value: Session | null; now: number; blockingError?: string } | { ok: false; error: string };

export type SessionAPI = Record<"getCurrent" | "start" | "stop", () => Promise<SessionResult>>;
