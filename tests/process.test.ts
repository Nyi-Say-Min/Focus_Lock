import { expect, it, vi } from "vitest";
import { cachedScanner, parseProcesses, windowsProcesses } from "../src/main/process-controller";

it("matches whole executable names and preserves Unicode", () => {
  const names = parseProcesses('\uFEFF["Discord.exe","DISCORD.EXE","日本 App.exe"]');
  expect([...names]).toEqual(["discord.exe", "日本 app.exe"]);
  expect(names.has("cord.exe")).toBe(false);
});

it.each(["{}", "null", "[42]", '[""]', "broken"])("rejects invalid process output %s", (json) => {
  expect(() => parseProcesses(json)).toThrow();
});

it("shares pending scans, caches failures briefly and recovers", async () => {
  let now = 0;
  const listRunning = vi
    .fn()
    .mockRejectedValueOnce(Error("scan failed"))
    .mockResolvedValue(new Set(["node.exe"]));
  const scan = cachedScanner({ listRunning }, () => now);
  const first = scan();
  expect(scan()).toBe(first);
  await expect(first).rejects.toThrow("scan failed");
  expect(scan()).toBe(first);
  now = 2000;
  await expect(scan()).resolves.toEqual(new Set(["node.exe"]));
  expect(listRunning).toHaveBeenCalledTimes(2);
});

it.skipIf(process.platform !== "win32")(
  "reads real Windows processes with the fixed command",
  async () => {
    expect((await windowsProcesses.listRunning()).has("powershell.exe")).toBe(true);
  },
  12000,
);
