import { expect, it, vi } from "vitest";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createBlocker, terminateWindows, type Terminate } from "../src/main/process-blocker";
import type { Session, SessionResult } from "../src/shared/session";

const apps = [{ id: "demo.exe", name: "Demo", executableName: "demo.exe", enabled: true }];

const snapshot = (status: Session["status"] = "blocking"): SessionResult => ({
  ok: true,
  now: 2000,
  value: { status, startedAt: 0, allowanceEndsAt: 1000, blockEndsAt: 9000 },
});

const settle = () => new Promise((resolve) => setImmediate(resolve));

it("enforces only blocking sessions, uses selections and retries relaunches without overlapping", async () => {
  let now = 2000;
  const terminate = vi.fn().mockResolvedValue(undefined);
  const blocker = createBlocker(
    () => [...apps, { ...apps[0], id: "ignored.exe", enabled: false }],
    terminate,
    () => now,
  );
  for (const status of ["active", "completed", "cancelled"] as const) blocker.update(snapshot(status));
  expect(terminate).not.toHaveBeenCalled();
  blocker.update(snapshot());
  blocker.update(snapshot());
  expect(terminate).toHaveBeenCalledOnce();
  expect(terminate.mock.calls[0][0]).toEqual({ names: ["demo.exe"], until: 9000 });
  await settle();
  blocker.update(snapshot());
  expect(terminate).toHaveBeenCalledOnce();
  now = 3000;
  blocker.update(snapshot());
  expect(terminate).toHaveBeenCalledTimes(2);
  await settle();
  now = 9000;
  blocker.update(snapshot());
  expect(terminate).toHaveBeenCalledTimes(2);
});

it.each(["stop", "quit", "selection", "storage", "session error"])("cancels in-flight enforcement on %s", (reason) => {
  let items = apps;
  const read = vi.fn(() => items),
    terminate = vi.fn<Terminate>(() => new Promise<void>(() => {}));
  const blocker = createBlocker(read, terminate, () => 2000);
  blocker.update(snapshot());
  if (reason === "quit") blocker.close();
  else if (reason === "stop") blocker.update(snapshot("cancelled"));
  else if (reason === "session error") blocker.update({ ok: false, error: "STORAGE_FAILED" });
  else {
    if (reason === "storage")
      read.mockImplementation(() => {
        throw Error("corrupt");
      });
    else items = [];
    blocker.update(snapshot());
  }
  expect(terminate.mock.calls[0][1].aborted).toBe(true);
});

it("reports failure, recovers on retry, and never resumes after shutdown", async () => {
  let now = 2000;
  const terminate = vi.fn().mockRejectedValueOnce(Error("access denied")).mockResolvedValue(undefined);
  const blocker = createBlocker(
    () => apps,
    terminate,
    () => now,
  );
  blocker.update(snapshot());
  await settle();
  expect(blocker.update(snapshot())).toContain("could not be closed");
  now = 4000;
  blocker.update(snapshot());
  await settle();
  expect(blocker.update(snapshot())).toBe("");
  blocker.close();
  now = 6000;
  blocker.update(snapshot());
  expect(terminate).toHaveBeenCalledTimes(2);
});

it.skipIf(process.platform !== "win32")("refuses the current executable", async () => {
  await expect(
    terminateWindows({ names: [basename(process.execPath)], until: Date.now() + 10000 }, new AbortController().signal),
  ).rejects.toThrow("itself");
});

it.skipIf(process.platform !== "win32")(
  "terminates only a disposable selected executable and respects expiry",
  async () => {
    const folder = await mkdtemp(join(tmpdir(), "focuslock-block-test-"));
    const name = `${basename(folder)}.exe`,
      executable = join(folder, name);
    await copyFile(process.execPath, executable);
    const child = spawn(executable, ["-e", "process.stdout.write('ready');setInterval(()=>{},1000)"], {
      windowsHide: true,
    });
    const exited = once(child, "exit");
    try {
      await once(child.stdout!, "data");
      await terminateWindows({ names: [name], until: Date.now() - 1 }, new AbortController().signal);
      expect(child.exitCode).toBeNull();
      await terminateWindows({ names: [`other-${name}`], until: Date.now() + 10000 }, new AbortController().signal);
      expect(child.exitCode).toBeNull();
      await expect(
        terminateWindows(
          { names: [name.toUpperCase(), basename(process.execPath)], until: Date.now() + 10000 },
          new AbortController().signal,
        ),
      ).rejects.toThrow("itself");
      await exited;
      expect(child.exitCode).not.toBeNull();
    } finally {
      if (child.exitCode === null) child.kill();
      await exited;
      await rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  },
  25000,
);
