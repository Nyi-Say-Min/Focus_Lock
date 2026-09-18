import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  session,
  Tray,
} from "electron";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { settings } from "./settings";

let dashboard: BrowserWindow,
  overlay: BrowserWindow,
  tray: Tray,
  quitting = false;
const root = fileURLToPath(new URL("..", import.meta.url));
const dev = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined;
const page = (name: string) =>
  dev
    ? `${dev.replace(/\/$/, "")}/${name}`
    : pathToFileURL(join(root, "renderer", name)).href;

function secure(window: BrowserWindow) {
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

function createOverlay(interactive = false) {
  overlay = new BrowserWindow({
    show: false,
    transparent: true,
    frame: false,
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: interactive,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlay.setIgnoreMouseEvents(!interactive);
  secure(overlay);
  return overlay.loadURL(page("overlay/index.html"));
}

function openDashboard() {
  dashboard.show();
  dashboard.restore();
  dashboard.focus();
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (dashboard) openDashboard();
  });
  app.on("before-quit", () => {
    quitting = true;
  });
  app.on("window-all-closed", () => {
    if (quitting) app.quit();
  });
  app
    .whenReady()
    .then(async () => {
      session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            "Content-Security-Policy": [
              `default-src 'self'; script-src 'self'${dev ? " 'unsafe-inline'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'${dev ? ` ${dev} ${dev.replace(/^http/, "ws")}` : ""}; object-src 'none'; frame-src 'none'; base-uri 'none'`,
            ],
          },
        }),
      );
      dashboard = new BrowserWindow({
        width: 900,
        height: 800,
        minWidth: 520,
        minHeight: 550,
        show: false,
        backgroundColor: "#111714",
        title: "FocusLock",
        autoHideMenuBar: true,
        webPreferences: {
          preload: join(root, "preload", "index.cjs"),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      secure(dashboard);
      dashboard.on("close", (event) => {
        if (!quitting) {
          event.preventDefault();
          dashboard.hide();
        }
      });
      for (const channel of ["settings:get", "settings:update"])
        ipcMain.handle(channel, (event, patch) => {
          if (
            event.sender !== dashboard.webContents ||
            event.senderFrame !== dashboard.webContents.mainFrame ||
            event.senderFrame.url !== page("index.html")
          )
            return { ok: false, error: "FORBIDDEN" };
          if (channel === "settings:update" && patch === undefined)
            return { ok: false, error: "INVALID_SETTINGS" };
          return settings(
            app.getPath("userData"),
            channel === "settings:update" ? patch : undefined,
          );
        });
      const pixels = Buffer.alloc(16 * 16 * 4);
      for (let y = 2; y < 14; y++)
        for (let x = 3; x < 13; x++) {
          if (x < 6 || y < 5 || (y >= 7 && y < 10 && x < 11))
            pixels.set([130, 220, 170, 255], (y * 16 + x) * 4);
        }
      tray = new Tray(
        nativeImage.createFromBitmap(pixels, { width: 16, height: 16 }),
      );
      tray.setToolTip("FocusLock • No active session");
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: "Open Dashboard", click: openDashboard },
          { label: "No active session", enabled: false },
          { type: "separator" },
          { label: "Quit FocusLock", click: () => app.quit() },
        ]),
      );
      tray.on("double-click", openDashboard);
      await Promise.all([
        dashboard.loadURL(page("index.html")),
        createOverlay(),
      ]);
      openDashboard();
    })
    .catch(() => {
      dialog.showErrorBox(
        "FocusLock",
        "Unable to start the desktop application.",
      );
      app.quit();
    });
}
