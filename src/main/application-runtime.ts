import { ipcMain, type BrowserWindow } from "electron";
import Store from "electron-store";
import type { Application, ApplicationsResult } from "../shared/applications";
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
  for (const action of ["list", "add", "setEnabled", "remove"])
    ipcMain.handle(`applications:${action}`, async (event, ...args): Promise<ApplicationsResult> => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame.url !== url
      )
        return { ok: false, error: "FORBIDDEN" };
      try {
        if (action === "list" && args.length) return { ok: false, error: "INVALID_APPLICATION" };
        if (action !== "list") registry.change(action, args);
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
}
