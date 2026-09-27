import { spawn } from "node:child_process";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { connect, type Socket } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { hostsStorageConnection } from "./hosts-storage";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const encoded = (value: string) => Buffer.from(value, "utf16le").toString("base64");
// Internal main-process API. Never accept script paths, secrets, or fixture roots from renderer IPC.
// Production callers must supply the packaged resources directory, not a downloaded script.
export function openElevatedHosts(resources: string, signal: AbortSignal, fixtureRoot?: string) {
  if (process.platform !== "win32") return Promise.reject(Error("HOSTS_WINDOWS_ONLY"));
  if (signal.aborted) return Promise.reject(Error("HOSTS_ELEVATION_CANCELLED"));
  const pipe = `FocusLock-${randomBytes(24).toString("hex")}`,
    secret = randomBytes(32).toString("hex");
  const executable = join(process.env.SystemRoot || "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
  const invocation = `& ${quote(join(resources, "hosts-elevated.ps1"))} -PipeName '${pipe}' -Secret '${secret}' -CallerSid `;
  const sid = "[Security.Principal.WindowsIdentity]::GetCurrent().User.Value";
  const command = fixtureRoot
    ? `${invocation}(${sid}) -FixtureRoot ${quote(fixtureRoot)}`
    : `$sid = ${sid}; $code = ${quote(invocation)} + "'" + $sid + "'"; $b64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code)); Start-Process -FilePath ${quote(executable)} -Verb RunAs -WindowStyle Hidden -ArgumentList ('-NoProfile -NonInteractive -EncodedCommand ' + $b64) -Wait`;
  return new Promise<Awaited<ReturnType<typeof hostsStorageConnection>>>((resolve, reject) => {
    const child = spawn(executable, ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded(command)], {
      windowsHide: true,
      stdio: "ignore",
      env: { ...process.env, PSModulePath: join(executable, "..", "Modules") },
    });
    let socket: Socket | undefined, retry: ReturnType<typeof setTimeout>;
    let finished = false,
      authenticated = false;
    const dispose = () => {
      finished = true;
      clearTimeout(timer);
      clearTimeout(retry);
      signal.removeEventListener("abort", abort);
      socket?.destroy();
      child.kill();
    };
    const fail = (error: Error) => {
      dispose();
      reject(error);
    };
    const abort = () => fail(Error("HOSTS_ELEVATION_CANCELLED"));
    child.on("error", () => fail(Error("HOSTS_HELPER_START_FAILED")));
    child.on("exit", () => {
      if (!finished) fail(Error("HOSTS_ELEVATION_ENDED"));
    });
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => fail(Error("HOSTS_ELEVATION_TIMEOUT")), 60000);
    const attempt = () => {
      if (finished) return;
      const client = connect(`\\\\.\\pipe\\${pipe}`);
      let connected = false;
      socket = client;
      client.once("error", (error: NodeJS.ErrnoException) => {
        client.destroy();
        if (finished) return;
        if (!connected && ["ENOENT", "EBUSY"].includes(error.code ?? "")) retry = setTimeout(attempt, 100);
        else fail(Error("HOSTS_CONNECTION_FAILED"));
      });
      client.once("connect", () => {
        connected = true;
        const nonce = randomBytes(32).toString("hex");
        const proof = (role: string) => createHmac("sha256", secret).update(`${role}:${nonce}`).digest("hex");
        const lines = createInterface({ input: client });
        const authTimer = setTimeout(() => fail(Error("HOSTS_AUTH_TIMEOUT")), 5000);
        client.once("close", () => {
          clearTimeout(authTimer);
          lines.close();
          if (!authenticated && !finished) fail(Error("HOSTS_AUTH_FAILED"));
        });
        lines.once("line", (line) => {
          clearTimeout(authTimer);
          lines.close();
          if (!/^[a-f0-9]{64}$/.test(line) || !timingSafeEqual(Buffer.from(line), Buffer.from(proof("server"))))
            return fail(Error("HOSTS_AUTH_FAILED"));
          authenticated = true;
          const ready = hostsStorageConnection(client, client, dispose);
          client.write(`${proof("client")}\n`);
          void ready.then((storage) => {
            if (finished) {
              storage.close();
              return;
            }
            clearTimeout(timer);
            resolve(storage);
          }, fail);
        });
        client.write(`${nonce}\n`);
      });
    };
    attempt();
  });
}
