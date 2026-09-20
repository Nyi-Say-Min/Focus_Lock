import type { SettingsAPI } from "../../shared/types";
import type { SessionAPI } from "../../shared/session";
import type { ApplicationsAPI } from "../../shared/applications";
declare global {
  interface Window {
    focusLock: {
      settings: SettingsAPI;
      session: SessionAPI;
      applications: ApplicationsAPI;
    };
  }
}
