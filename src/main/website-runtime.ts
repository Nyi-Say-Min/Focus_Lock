import { ipcMain, type BrowserWindow } from "electron";
import { websiteStore } from "./websites";
export function installWebsites(window: BrowserWindow, url: string) {
  const request = websiteStore();
  ipcMain.handle("websites:request", (event, action, args) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== url
    )
      return { ok: false, error: "FORBIDDEN" };
    return request(action, args);
  });
}
