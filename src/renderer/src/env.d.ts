import type { WebsitesAPI } from "../../shared/websites";
import type { SettingsAPI } from "../../shared/types";
import type { SessionAPI } from "../../shared/session";
import type { ApplicationsAPI } from "../../shared/applications";
import type { BrowserAPI } from "../../shared/browser";
declare global {
  interface Window {
    focusLock: {
      browser: BrowserAPI;
      websites: WebsitesAPI;
      settings: SettingsAPI;
      session: SessionAPI;
      applications: ApplicationsAPI;
    };
  }
}
