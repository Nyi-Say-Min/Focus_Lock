import { contextBridge, ipcRenderer } from "electron";
import type { SettingsAPI } from "../shared/types";

const settings: SettingsAPI = {
  get: () => ipcRenderer.invoke("settings:get"),
  update: (patch) => ipcRenderer.invoke("settings:update", patch),
};

contextBridge.exposeInMainWorld("focusLock", { settings });
