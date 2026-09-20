import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

export type ProcessController = { listRunning(): Promise<Set<string>> };

export function parseProcesses(json: string): Set<string> {
  const names: unknown = JSON.parse(json.replace(/^\uFEFF/, ""));
  if (!Array.isArray(names) || !names.every((name) => typeof name === "string" && name.length > 0))
    throw Error("PROCESS_SCAN_FAILED");
  return new Set(names.map((name) => name.toLowerCase()));
}

export const windowsProcesses: ProcessController = {
  async listRunning() {
    if (process.platform !== "win32") throw Error("UNSUPPORTED_PLATFORM");
    const command =
      "[Console]::OutputEncoding = [Text.UTF8Encoding]::new(); ConvertTo-Json -Compress -InputObject @((Get-Process -ErrorAction Stop).ProcessName | ForEach-Object { $_ + '.exe' })";
    const { stdout } = await promisify(execFile)(
      join(process.env.SystemRoot || "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe"),
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { windowsHide: true, timeout: 8000, maxBuffer: 1024 * 1024, encoding: "utf8" },
    );
    return parseProcesses(stdout);
  },
};

export function cachedScanner(controller: ProcessController = windowsProcesses, clock = Date.now) {
  let pending: Promise<Set<string>> | undefined,
    expires = 0;
  return () => {
    if (!pending || clock() >= expires) {
      expires = Infinity;
      pending = controller.listRunning().finally(() => {
        expires = clock() + 2000;
      });
    }
    return pending;
  };
}
