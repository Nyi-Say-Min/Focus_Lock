import { contextBridge, ipcRenderer } from "electron";
import type { SettingsAPI } from "../shared/types";
import type { SessionAPI } from "../shared/session";

const settings: SettingsAPI = {
  get: () => ipcRenderer.invoke("settings:get"),
  update: (patch) => ipcRenderer.invoke("settings:update", patch),
};

const session: SessionAPI = {
  getCurrent: () => ipcRenderer.invoke("session:getCurrent"),
  start: () => ipcRenderer.invoke("session:start"),
  stop: () => ipcRenderer.invoke("session:stop"),
};
contextBridge.exposeInMainWorld("focusLock", { settings, session });
