import { beforeEach, expect, it, vi } from "vitest";
import { createSessionEngine } from "../src/main/session";
let saved: unknown, now: number;
const storage = {
  read: () => saved,
  write: vi.fn((value: unknown) => {
    saved = structuredClone(value);
  }),
};
let engine: ReturnType<typeof createSessionEngine>;
const durations = { allowanceMinutes: 1, blockMinutes: 2 };
beforeEach(() => {
  saved = null;
  now = 1000;
  storage.write.mockClear();
  engine = createSessionEngine(storage, () => now);
});
it("persists deadlines, prevents duplicate starts and advances exactly at boundaries", () => {
  expect(engine("start", durations)).toMatchObject({
    ok: true,
    value: { allowanceEndsAt: 61000, blockEndsAt: 181000, status: "active" },
  });
  expect(engine("start", durations)).toMatchObject({ error: "SESSION_ALREADY_ACTIVE" });
  now = 60999;
  expect(engine("getCurrent")).toMatchObject({ value: { status: "active" } });
  expect(storage.write).toHaveBeenCalledTimes(1);
  now = 61000;
  expect(engine("getCurrent")).toMatchObject({ value: { status: "blocking" } });
  now = 181000;
  expect(engine("getCurrent")).toMatchObject({ value: { status: "completed" } });
});
it.each([
  [30000, "active"],
  [90000, "blocking"],
  [200000, "completed"],
])("restores correctly after restart or sleep at %i", (time, status) => {
  engine("start", durations);
  now = time;
  expect(createSessionEngine(storage, () => now)("getCurrent")).toMatchObject({
    value: { status, allowanceEndsAt: 61000, blockEndsAt: 181000 },
  });
});
it("persists cancellation, allows a new session and rejects stopping idle sessions", () => {
  expect(engine("stop")).toMatchObject({ error: "NO_ACTIVE_SESSION" });
  engine("start", durations);
  expect(engine("stop")).toMatchObject({ value: { status: "cancelled" } });
  now = 999999;
  expect(createSessionEngine(storage, () => now)("getCurrent")).toMatchObject({ value: { status: "cancelled" } });
  expect(engine("start", durations).ok).toBe(true);
});
it("does not acknowledge a failed write and retries an expired transition", () => {
  storage.write.mockImplementationOnce(() => {
    throw Error("disk full");
  });
  expect(engine("start", durations)).toMatchObject({ error: "SESSION_STORAGE_FAILED" });
  expect(engine("getCurrent")).toMatchObject({ value: null });
  engine("start", durations);
  now = 61000;
  storage.write.mockImplementationOnce(() => {
    throw Error("disk full");
  });
  expect(engine("getCurrent")).toMatchObject({ error: "SESSION_STORAGE_FAILED" });
  expect(engine("getCurrent")).toMatchObject({ value: { status: "blocking" } });
});
it("preserves corrupt state and rejects invalid durations", () => {
  expect(engine("start", { ...durations, allowanceMinutes: 0 })).toMatchObject({ error: "INVALID_SESSION_DURATION" });
  saved = { status: "active" };
  expect(createSessionEngine(storage)("getCurrent")).toMatchObject({ error: "INVALID_SAVED_SESSION" });
  expect(storage.write).not.toHaveBeenCalled();
});
