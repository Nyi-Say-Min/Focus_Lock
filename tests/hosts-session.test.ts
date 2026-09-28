import { expect, it, vi } from "vitest";
vi.mock("electron-store", () => ({ default: class {} }));
import { createWebsiteBlocker } from "../src/main/hosts-session";
import type { HostsJournal } from "../src/main/hosts-blocker";
import type { SessionResult } from "../src/shared/session";
const state = (blocking = true, startedAt = 1): SessionResult => ({
  ok: true,
  now: 100,
  value: { startedAt, allowanceEndsAt: 50, blockEndsAt: 5000, status: blocking ? "blocking" : "cancelled" },
});
const settle = () => new Promise((done) => setImmediate(done));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup() {
  let text = "# personal\n",
    journal: HostsJournal | null = null;
  const io = {
    read: async () => text,
    replace: async (_: string, next: string) => {
      text = next;
    },
    readJournal: async () => journal,
    writeJournal: async (j: HostsJournal) => {
      journal = j;
    },
    clearJournal: async () => {
      journal = null;
    },
    close: vi.fn(),
  };
  const read = vi.fn(() => [{ domain: "youtube.com", enabled: true }]),
    connect = vi.fn(async (signal: AbortSignal) => {
      if (signal.aborted) throw Error("cancelled");
      return io;
    }),
    mark = vi.fn();
  const controller = createWebsiteBlocker(read, connect, mark, () => 100);
  const snapshot = () => text;
  return { io, read, connect, mark, text: snapshot, controller };
}
it("blocks selected sites only in breaks, coalesces polling, updates selections and releases on stop", async () => {
  const f = setup();
  f.controller.update(state(false));
  await settle();
  expect(f.connect).not.toHaveBeenCalled();
  f.controller.update(state());
  await settle();
  f.controller.update(state());
  await settle();
  expect(f.connect).toHaveBeenCalledOnce();
  expect(f.text()).toContain("youtube.com");
  f.read.mockReturnValue([{ domain: "discord.com", enabled: true }]);
  f.controller.update(state());
  await settle();
  expect(f.text()).toContain("discord.com");
  expect(f.text()).not.toContain("youtube.com");
  f.read.mockReturnValue([]);
  f.controller.update(state());
  await settle();
  expect(f.text()).toBe("# personal\n");
  f.read.mockReturnValue([{ domain: "discord.com", enabled: true }]);
  f.controller.update(state());
  await settle();
  expect(f.text()).toContain("discord.com");
  expect(f.connect).toHaveBeenCalledOnce();
  f.controller.update(state(false));
  await settle();
  expect(f.text()).toBe("# personal\n");
  expect(f.mark).toHaveBeenLastCalledWith(false);
});
it("does not repeatedly prompt after denial; a new session can retry", async () => {
  const f = setup();
  f.connect.mockRejectedValueOnce(Error("denied"));
  f.controller.update(state());
  await settle();
  expect(f.controller.update(state())).toContain("failed");
  await settle();
  expect(f.connect).toHaveBeenCalledOnce();
  f.controller.update(state(true, 2));
  await settle();
  expect(f.connect).toHaveBeenCalledTimes(2);
});
it("does not apply stale rules after delayed approval or after quitting", async () => {
  const f = setup();
  const approval = deferred<typeof f.io>();
  f.connect.mockReturnValueOnce(approval.promise);
  f.controller.update(state());
  f.controller.update(state(false));
  approval.resolve(f.io);
  await settle();
  f.controller.update(state(false));
  await settle();
  expect(f.text()).toBe("# personal\n");
  f.controller.close();
  f.controller.update(state(true, 3));
  await settle();
  expect(f.connect).toHaveBeenCalledOnce();
});
it("removes rules on selection read failure and supports explicit recovery", async () => {
  const f = setup();
  f.controller.update(state());
  await settle();
  f.read.mockImplementation(() => {
    throw Error("storage");
  });
  f.controller.update(state());
  await settle();
  expect(f.text()).toBe("# personal\n");
  await f.controller.recover();
  expect(f.io.close).toHaveBeenCalled();
});
it("keeps startup recovery alive while idle sessions are polled", async () => {
  const f = setup();
  const approval = deferred<typeof f.io>();
  f.connect.mockReturnValueOnce(approval.promise);
  const recovery = f.controller.recover();
  f.controller.update(state(false));
  expect(f.connect.mock.calls[0][0]?.aborted).not.toBe(true);
  approval.resolve(f.io);
  await recovery;
  expect(f.mark).toHaveBeenLastCalledWith(false);
});
