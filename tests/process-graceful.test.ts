import { expect, it } from "vitest";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { terminationCommand } from "../src/main/process-blocker";

// Run the actual PowerShell algorithm against harmless process doubles.
const harness = String.raw`
class TestProcess {
  [string]$ProcessName = 'demo'
  [int]$SessionId = 1
  [int]$Handle = 1
  [string]$Path = 'C:\FocusLock-test\demo.exe'
  [bool]$HasExited = $false
  [string]$Mode
  TestProcess([string]$mode) { $this.Mode = $mode }
  [bool] CloseMainWindow() {
    [Console]::WriteLine('close')
    if ($this.Mode -eq 'throws') { throw 'Cannot close window' }
    if ($this.Mode -eq 'graceful') { $this.HasExited = $true }
    return $this.HasExited
  }
  [bool] WaitForExit([int]$ms) {
    [Console]::WriteLine('wait')
    [Threading.Thread]::Sleep($ms)
    return $this.HasExited
  }
  [void] Kill() { [Console]::WriteLine('kill'); $this.HasExited = $true }
  [void] Dispose() { [Console]::WriteLine('dispose') }
}
function Get-Process($Id) {
  if ($Id) {
    $script:data.until = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + $(if ($data.mode -eq 'expiry') { 100 } else { 10000 })
    return @{ SessionId = 1 }
  }
  $p = [TestProcess]::new($data.mode)
  if ($data.mode -eq 'protected') { $p.Path = $env:SystemRoot + '\test.exe' }
  if ($data.mode -eq 'other-session') { $p.SessionId = 2 }
  return $p
}
`;

function run(mode: string, cancelOnClose = false) {
  const controller = new AbortController();
  return new Promise<{ output: string; error: Error | null }>((resolve) => {
    const child = execFile(
      join(process.env.SystemRoot || "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe"),
      ["-NoProfile", "-NonInteractive", "-Command", harness + terminationCommand],
      { windowsHide: true, timeout: 10000, signal: controller.signal },
      (error, output) => resolve({ error, output }),
    );
    child.stdout?.on("data", (data) => {
      if (cancelOnClose && String(data).includes("close")) controller.abort();
    });
    child.stdin?.on("error", () => {});
    child.stdin?.end(JSON.stringify({ names: ["demo.exe"], until: 0, self: "C:\\FocusLock-test\\self.exe", mode }));
  });
}

it.skipIf(process.platform !== "win32").each(["graceful", "refuses", "throws", "expiry"])(
  "handles %s shutdown without force-closing an exited or expired target",
  async (mode) => {
    const { output, error } = await run(mode);
    expect(error).toBeNull();
    const events = output.trim().split(/\r?\n/);
    expect(events).toEqual(
      mode === "graceful"
        ? ["close", "dispose"]
        : mode === "expiry"
          ? ["close", "wait", "dispose"]
          : ["close", "wait", "kill", "dispose"],
    );
  },
  15000,
);

it.skipIf(process.platform !== "win32").each(["protected", "other-session"])(
  "does not request a graceful close for a %s process",
  async (mode) => {
    const { output, error } = await run(mode);
    expect(output.trim()).toBe("dispose");
    if (mode === "protected") expect(error).not.toBeNull();
    else expect(error).toBeNull();
  },
  15000,
);

it.skipIf(process.platform !== "win32")(
  "aborting during the grace period prevents the force-close step",
  async () => {
    const { output, error } = await run("refuses", true);
    expect(error?.name).toBe("AbortError");
    expect(output).toContain("close");
    expect(output).not.toContain("kill");
  },
  15000,
);
