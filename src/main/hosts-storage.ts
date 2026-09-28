import { spawn } from "node:child_process";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { HostsStorage } from "./hosts-blocker";

// Internal adapter only. Production requires an already elevated helper process;
// do not expose this transport or its script/fixture paths through renderer IPC.
export function openHostsStorage(script: string, fixtureRoot?: string): Promise<HostsStorage & { close(): void }> {
  if (process.platform !== "win32") return Promise.reject(Error("HOSTS_WINDOWS_ONLY"));

  const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "RemoteSigned", "-File", script];
  if (fixtureRoot) args.push("-FixtureRoot", fixtureRoot);
  const child = spawn(
    join(process.env.SystemRoot || "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe"),
    args,
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  child.stderr.resume();
  child.on("error", (error) => child.stdout.destroy(error));
  child.on("exit", () => child.stdout.destroy(Error("HOSTS_HELPER_EXITED")));
  return hostsStorageConnection(child.stdout, child.stdin, () => {
    child.kill();
  });
}

export function hostsStorageConnection(
  input: Readable,
  output: Writable,
  dispose: () => void,
): Promise<HostsStorage & { close(): void }> {
  return new Promise((resolve, reject) => {
    const lines = createInterface({ input });
    let pending: { resolve(value: unknown): void; reject(error: Error): void } | undefined;
    let closed = false;
    let tail = Promise.resolve<unknown>(undefined);
    let timer: ReturnType<typeof setTimeout>;
    function fail(error: Error) {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      reject(error);
      pending?.reject(error);
      pending = undefined;
      lines.close();
      dispose();
    }
    const deadline = () => (timer = setTimeout(() => fail(Error("HOSTS_HELPER_TIMEOUT")), 15000));
    function request(op: string, data = {}) {
      const result = tail.then(
        () =>
          new Promise<unknown>((done, failed) => {
            if (closed) return failed(Error("HOSTS_HELPER_CLOSED"));
            pending = { resolve: done, reject: failed };
            deadline();
            output.write(`${JSON.stringify({ op, ...data })}\n`, (error) => {
              if (error) fail(error);
            });
          }),
      );
      tail = result.catch(() => {});
      return result;
    }
    deadline();

    input.on("error", fail);
    output.on("error", fail);
    input.on("close", () => fail(Error("HOSTS_HELPER_EXITED")));
    lines.on("line", (line) => {
      try {
        const message = JSON.parse(line);
        clearTimeout(timer);
        if (message.ready === true) {
          resolve({
            read: async () => {
              const value = await request("read");
              if (typeof value !== "string") throw Error("HOSTS_INVALID_RESPONSE");
              return value;
            },
            replace: async (expected, next) => {
              await request("replace", { expected, next });
            },
            readJournal: () => request("readJournal"),
            writeJournal: async (journal) => {
              await request("writeJournal", { journal });
            },
            clearJournal: async () => {
              await request("clearJournal");
            },
            close: () => fail(Error("HOSTS_HELPER_CLOSED")),
          });
        } else if (pending) {
          const current = pending;
          pending = undefined;
          if (message.error) current.reject(Error(message.error));
          else if (message.ok === true) current.resolve(message.value);
          else {
            current.reject(Error("HOSTS_INVALID_RESPONSE"));
            fail(Error("HOSTS_INVALID_RESPONSE"));
          }
        } else fail(Error(message.error || "HOSTS_INVALID_RESPONSE"));
      } catch {
        fail(Error("HOSTS_INVALID_RESPONSE"));
      }
    });
  });
}
