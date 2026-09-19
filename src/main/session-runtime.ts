import { app, ipcMain, powerMonitor, type BrowserWindow, type Tray } from "electron";
import Store from "electron-store";
import type { Session } from "../shared/session";
import { createSessionEngine } from "./session";
import { settings } from "./settings";

export function installSessions(window: BrowserWindow, tray: Tray, url: string) {
  let store: Store<{ current: Session | null }>;
  const open = () =>
    (store ??= new Store<{ current: Session | null }>({
      name: "session",
      defaults: { current: null },
      clearInvalidConfig: false,
    }));
  const engine = createSessionEngine({
    read: () => open().get("current"),
    write: (value) => open().set("current", value),
  });
  const refresh = () => {
    const result = engine("getCurrent");
    const value = result.ok ? result.value : null;
    const end = value?.status === "active" ? value.allowanceEndsAt : value?.blockEndsAt;
    const seconds = result.ok && end ? Math.max(0, Math.ceil((end - result.now) / 1000)) : 0;
    tray.setToolTip(
      !result.ok
        ? "FocusLock • Session unavailable"
        : value && ["active", "blocking"].includes(value.status)
          ? `FocusLock • ${value.status === "active" ? "Social time" : "Break"}: ${seconds}s remaining`
          : "FocusLock • No active session",
    );
    return result;
  };
  for (const action of ["getCurrent", "start", "stop"] as const)
    ipcMain.handle(`session:${action}`, (event, ...args) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame.url !== url ||
        args.length
      )
        return { ok: false, error: "FORBIDDEN" };
      if (action === "getCurrent") return refresh();
      const saved = action === "start" ? settings(app.getPath("userData")) : null;
      if (saved && !saved.ok) return saved;
      const result = engine(action, saved?.ok ? saved.value : undefined);
      refresh();
      return result;
    });
  refresh();
  const timer = setInterval(refresh, 1000);
  powerMonitor.on("resume", refresh);
  app.once("before-quit", () => {
    clearInterval(timer);
    powerMonitor.removeListener("resume", refresh);
  });
}
