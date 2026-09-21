import { afterAll, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { app, dialog, type BrowserWindow } from "electron";
import { applicationPicker, describeExecutable, discoverApplications } from "../src/main/application-discovery";

vi.mock("electron", () => ({
  app: { getFileIcon: vi.fn().mockResolvedValue({ toDataURL: () => "data:image/png;base64,a" }) },
  shell: { readShortcutLink: (path: string) => JSON.parse(readFileSync(path, "utf8")) },
  dialog: { showOpenDialog: vi.fn() },
}));

const folder = await mkdtemp(join(tmpdir(), "focuslock-discovery-"));

afterAll(() => rm(folder, { recursive: true, force: true }));

it("finds friendly names, deduplicates executables and resolves updater shortcuts without launching them", async () => {
  const menu = join(folder, "menu"),
    install = join(folder, "installed");
  await mkdir(menu);
  for (const version of ["app-9", "app-10"]) {
    await mkdir(join(install, version), { recursive: true });
    await writeFile(join(install, version, "Chat.exe"), "");
  }
  const target = join(folder, "Demo.exe");
  await writeFile(target, "");
  await writeFile(join(folder, "wrapper.exe"), "");
  for (const [name, shortcut] of Object.entries({
    "Demo Friendly": { target },
    Duplicate: { target },
    Missing: { target: join(folder, "gone.exe") },
    "Shell wrapper": { target: join(folder, "cmd.exe") },
    "Web app": { target: join(folder, "wrapper.exe"), args: "--app=https://example.com" },
    "Chat Friendly": { target: join(install, "Update.exe"), args: '--processStart "Chat.exe"' },
  }))
    await writeFile(join(menu, `${name}.lnk`), JSON.stringify(shortcut));
  const items = await discoverApplications([menu, join(folder, "missing-menu")]);
  expect(items.map((item) => [item.name, item.executableName])).toEqual([
    ["Chat Friendly", "Chat.exe"],
    ["Demo Friendly", "Demo.exe"],
  ]);
  expect(vi.mocked(app.getFileIcon).mock.calls.some(([path]) => path === join(install, "app-10", "Chat.exe"))).toBe(
    true,
  );
});

it("validates browse targets and tolerates unavailable icons", async () => {
  const target = join(folder, "Portable.exe");
  await writeFile(target, "");
  vi.mocked(app.getFileIcon).mockRejectedValueOnce(Error("no icon"));
  expect(await describeExecutable(target)).toEqual({ name: "Portable", executableName: "Portable.exe", icon: "" });
  await expect(describeExecutable("relative.exe")).rejects.toThrow("INVALID_EXECUTABLE");
  await expect(describeExecutable(join(folder, "not.txt"))).rejects.toThrow("INVALID_EXECUTABLE");
  await expect(describeExecutable(process.execPath)).rejects.toThrow("INVALID_EXECUTABLE");
  const window = {} as BrowserWindow,
    picker = applicationPicker(window);
  vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] });
  expect(await picker.browse()).toBeNull();
  vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: false, filePaths: [target] });
  expect((await picker.browse())?.executableName).toBe("Portable.exe");
  expect(dialog.showOpenDialog).toHaveBeenCalledWith(window, expect.objectContaining({ properties: ["openFile"] }));
});
