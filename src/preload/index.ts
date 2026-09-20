import { contextBridge, ipcRenderer } from "electron";
import type { SettingsAPI } from "../shared/types";
import type { SessionAPI } from "../shared/session";
import type { ApplicationsAPI } from "../shared/applications";

const settings: SettingsAPI = {
  get: () => ipcRenderer.invoke("settings:get"),
  update: (patch) => ipcRenderer.invoke("settings:update", patch),
};

const session: SessionAPI = {
  getCurrent: () => ipcRenderer.invoke("session:getCurrent"),
  start: () => ipcRenderer.invoke("session:start"),
  stop: () => ipcRenderer.invoke("session:stop"),
};
const applications: ApplicationsAPI = {
  list: () => ipcRenderer.invoke("applications:list"),
  add: (name) => ipcRenderer.invoke("applications:add", name),
  setEnabled: (id, enabled) =>
    ipcRenderer.invoke("applications:setEnabled", id, enabled),
  remove: (id) => ipcRenderer.invoke("applications:remove", id),
};
contextBridge.exposeInMainWorld("focusLock", {
  settings,
  session,
  applications,
});
