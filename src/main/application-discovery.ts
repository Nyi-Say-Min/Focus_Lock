import { app, dialog, shell, type BrowserWindow } from "electron";
import { readdir, realpath, stat } from "node:fs/promises";
import { basename, dirname, extname, join, isAbsolute } from "node:path";
import type { InstalledApplication } from "../shared/applications";

export async function describeExecutable(
  path: string,
  name = basename(path, extname(path)),
): Promise<InstalledApplication> {
  if (!isAbsolute(path) || extname(path).toLowerCase() !== ".exe" || !(await stat(path)).isFile())
    throw Error("INVALID_EXECUTABLE");
  const resolved = await realpath(path);
  if (
    resolved.toLowerCase() === process.execPath.toLowerCase() ||
    resolved.toLowerCase().startsWith((process.env.SystemRoot || "C:\\Windows").toLowerCase() + "\\")
  )
    throw Error("INVALID_EXECUTABLE");
  const executableName = basename(resolved);
  const icon = await app
    .getFileIcon(path, { size: "small" })
    .then((image) => image.toDataURL())
    .catch(() => "");
  return { executableName, name: (name.trim() || basename(resolved, extname(resolved))).slice(0, 120), icon };
}

export async function discoverApplications(roots: string[]): Promise<InstalledApplication[]> {
  const found = new Map<string, InstalledApplication>();
  let inspected = 0;
  async function walk(folder: string, depth = 0) {
    if (depth > 6 || inspected >= 2000 || found.size >= 300) return;
    const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (++inspected > 2000 || found.size >= 300) break;
      const path = join(folder, entry.name);
      if (entry.isDirectory()) {
        await walk(path, depth + 1);
        continue;
      }
      if (!entry.isFile() || extname(path).toLowerCase() !== ".lnk") continue;
      try {
        const shortcut = shell.readShortcutLink(path);
        let target = shortcut.target;
        if (basename(target).toLowerCase() === "update.exe") {
          const match = /^--processStart\s+(?:"([^"\\/]+\.exe)"|([^\s\\/]+\.exe))(?:\s|$)/i.exec(shortcut.args || "");
          if (!match) continue;
          const versions = (await readdir(dirname(target)))
            .filter((name) => /^app-\d/.test(name))
            .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
          target = join(dirname(target), versions[0] || "", match[1] || match[2]);
        } else if (shortcut.args?.trim()) continue;
        if (/^(unins.*|setup|update|cmd|powershell|pwsh|rundll32|explorer|msiexec)\.exe$/i.test(basename(target)))
          continue;
        const item = await describeExecutable(target, basename(path, extname(path)));
        if (!found.has(item.executableName.toLowerCase())) found.set(item.executableName.toLowerCase(), item);
      } catch {
        /* Broken or unsupported shortcuts are omitted. */
      }
    }
  }
  for (const root of roots) await walk(root);
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function applicationPicker(window: BrowserWindow) {
  let catalog: InstalledApplication[] = [],
    pending: Promise<InstalledApplication[]> | undefined,
    browsing = false;
  return {
    async discover() {
      if (process.platform !== "win32") throw Error("UNSUPPORTED_PLATFORM");
      pending ??= discoverApplications(
        [app.getPath("appData"), process.env.ProgramData || "C:\\ProgramData"].map((root) =>
          join(root, "Microsoft/Windows/Start Menu/Programs"),
        ),
      ).finally(() => {
        pending = undefined;
      });
      catalog = await pending;
      return catalog;
    },
    label(executable: unknown) {
      return catalog.find((item) => item.executableName.toLowerCase() === String(executable).toLowerCase())?.name;
    },
    async browse() {
      if (browsing) throw Error("INVALID_APPLICATION");
      browsing = true;
      try {
        const selected = await dialog.showOpenDialog(window, {
          title: "Choose an application",
          properties: ["openFile"],
          filters: [{ name: "Applications", extensions: ["exe"] }],
        });
        return selected.canceled ? null : await describeExecutable(selected.filePaths[0]);
      } finally {
        browsing = false;
      }
    },
  };
}
