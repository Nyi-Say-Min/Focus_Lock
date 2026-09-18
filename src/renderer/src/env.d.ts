import type { SettingsAPI } from "../../shared/types";
declare global {
  interface Window {
    focusLock: { settings: SettingsAPI };
  }
}
