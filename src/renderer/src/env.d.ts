import type { SettingsAPI } from "../../shared/types";
import type { SessionAPI } from "../../shared/session";
declare global {
  interface Window {
    focusLock: { settings: SettingsAPI; session: SessionAPI };
  }
}
