import { ipcMain, type BrowserWindow } from "electron";
import Store from "electron-store";
import type { Application, ApplicationsResult, DiscoveryResult } from "../shared/applications";
import { applicationPicker } from "./application-discovery";
import { applicationRegistry, defaultApplications } from "./application-registry";
import { cachedScanner } from "./process-controller";

export function installApplications(window: BrowserWindow, url: string) {
  let store: Store<{ items: Application[] }>;
  const open = () =>
    (store ??= new Store({
      name: "applications",
      defaults: { items: defaultApplications },
      clearInvalidConfig: false,
    }));
  const registry = applicationRegistry({
    read: () => open().get("items"),
    write: (items) => open().set("items", items),
  });
  const scan = cachedScanner();
  const picker = applicationPicker(window);
  for (const action of ["list", "add", "setEnabled", "remove", "discover", "browse"])
    ipcMain.handle(`applications:${action}`, async (event, ...args): Promise<ApplicationsResult | DiscoveryResult> => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame.url !== url
      )
        return { ok: false, error: "FORBIDDEN" };
      try {
        if (["list", "discover", "browse"].includes(action) && args.length)
          return { ok: false, error: "INVALID_APPLICATION" };
        if (action === "discover") return { ok: true, value: await picker.discover() };
        if (action === "browse") {
          const item = await picker.browse();
          if (item) registry.change("add", [item.executableName], item.name);
        } else if (action !== "list")
          registry.change(action, args, action === "add" ? picker.label(args[0]) : undefined);
        registry.list();
        let running: Set<string> | null = null,
          scanFailed = false;
        if (window.isVisible() && !window.isMinimized()) {
          try {
            running = await scan();
          } catch {
            scanFailed = true;
          }
        }
        return {
          ok: true,
          value: registry.list().map((item) => ({ ...item, running: running ? running.has(item.id) : null })),
          scanFailed,
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        return {
          ok: false,
          error: /^(INVALID_|DUPLICATE_|APPLICATION_(LIMIT|NOT_FOUND))/.test(code)
            ? code
            : "APPLICATION_STORAGE_FAILED",
        };
      }
    });
  return registry.list;
}
