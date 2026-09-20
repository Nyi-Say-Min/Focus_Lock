import { execFile } from "node:child_process";
import { basename, join } from "node:path";
import type { Application } from "../shared/applications";
import type { SessionResult } from "../shared/session";

export type BlockRequest = { names: string[]; until: number };
export type Terminate = (request: BlockRequest, signal: AbortSignal) => Promise<void>;
const command = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new()
$data = [Console]::In.ReadToEnd() | ConvertFrom-Json
$session = (Get-Process -Id $PID).SessionId
$failed = $false
foreach ($p in Get-Process) {
  if ($data.names -notcontains ($p.ProcessName + '.exe')) { continue }
  try {
    if ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $data.until) { break }
    if ($p.SessionId -ne $session) { continue }
    $null = $p.Handle
    $path = $p.Path
    if (!$path -or $path.StartsWith($env:SystemRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or $path -eq $data.self) {
      $failed = $true
      continue
    }
    $p.Kill()
  } catch { if (!$p.HasExited) { $failed = $true } }
  finally { $p.Dispose() }
}
if ($failed) { exit 1 }
`;
export const terminateWindows: Terminate = async (request, signal) => {
  if (process.platform !== "win32") throw Error("Windows required");
  const forbidden = [basename(process.execPath).toLowerCase(), "focuslock.exe", "electron.exe"];
  const names = request.names.filter((name) => !forbidden.includes(name.toLowerCase()));
  if (!names.length) throw Error("FocusLock cannot block itself");
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      join(process.env.SystemRoot || "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe"),
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { windowsHide: true, timeout: 8000, maxBuffer: 65536, signal },
      (error) => (error ? reject(error) : resolve()),
    );
    child.stdin?.on("error", () => {});
    child.stdin?.end(JSON.stringify({ ...request, names, self: process.execPath }));
  });
  if (names.length !== request.names.length) throw Error("FocusLock cannot block itself");
};

export function createBlocker(read: () => Application[], terminate: Terminate = terminateWindows, clock = Date.now) {
  let pending: AbortController | undefined,
    key = "",
    error = "",
    next = 0,
    closed = false;
  return {
    update(result: SessionResult) {
      let request: BlockRequest = { names: [], until: 0 };
      try {
        if (result.ok && result.value?.status === "blocking" && result.value.blockEndsAt > clock())
          request = {
            names: read()
              .filter((item) => item.enabled)
              .map((item) => item.id)
              .sort(),
            until: result.value.blockEndsAt,
          };
      } catch {
        pending?.abort();
        key = "";
        return "Cannot read selected apps. Blocking is unavailable.";
      }
      const current = JSON.stringify(request);
      if (key !== current) {
        pending?.abort();
        key = current;
        error = "";
        next = 0;
      }
      if (!closed && !pending && request.names.length && clock() >= next) {
        const controller = new AbortController();
        pending = controller;
        void terminate(request, controller.signal)
          .then(() => {
            if (!controller.signal.aborted) error = "";
          })
          .catch(() => {
            if (!controller.signal.aborted)
              error = "Some selected apps could not be closed. Protected apps are skipped. Retrying…";
          })
          .finally(() => {
            pending = undefined;
            next = clock() + 1000;
          });
      }
      return error;
    },
    close() {
      closed = true;
      pending?.abort();
    },
  };
}
