import { contextBridge, ipcRenderer } from "electron";
import type { WebsitesAPI } from "../shared/websites";
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
  discover: () => ipcRenderer.invoke("applications:discover"),
  browse: () => ipcRenderer.invoke("applications:browse"),
  list: () => ipcRenderer.invoke("applications:list"),
  add: (name) => ipcRenderer.invoke("applications:add", name),
  setEnabled: (id, enabled) =>
    ipcRenderer.invoke("applications:setEnabled", id, enabled),
  remove: (id) => ipcRenderer.invoke("applications:remove", id),
};
const websites: WebsitesAPI = {
  list: () => ipcRenderer.invoke("websites:request", "list", []),
  add: (address) => ipcRenderer.invoke("websites:request", "add", [address]),
  setEnabled: (domain, enabled) =>
    ipcRenderer.invoke("websites:request", "setEnabled", [domain, enabled]),
  remove: (domain) =>
    ipcRenderer.invoke("websites:request", "remove", [domain]),
};
contextBridge.exposeInMainWorld("focusLock", {
  settings,
  session,
  applications,
  websites,
});
