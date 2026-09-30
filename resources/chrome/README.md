# Chrome, Edge, and Firefox companion

This extension replaces selected HTTP/HTTPS tabs with a FocusLock break page, blocks new navigation and requests to those domains (including subdomains), and preserves each original URL in that tab's fragment. The return button unlocks when the break ends or Stop is pressed. Unsaved page state is not preserved.

## Install and pair

1. Run `npm run dev` in FocusLock.
2. In Chrome or Edge, open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select this `resources/chrome` folder. In Firefox, open `about:debugging` → **This Firefox** → **Load Temporary Add-on** and select `resources/chrome/manifest.json`. Firefox's temporary add-on must be loaded again after each browser restart. In packaged builds, the folder is under the application's `resources/resources/chrome` directory. Reload previously loaded companions after an update.
3. Right-click the FocusLock tray icon and choose **Copy Chrome pairing code**.
   Alternatively, click **Set up browsers** in the dashboard's Websites panel. The dialog can open the extension folder, copy the pairing code, and show each browser's connection status even before a session starts.
4. Open the extension's options or toolbar popup in each browser, paste the code, and click **Pair browser**. Wait for **Connected to FocusLock**. The desktop indicator is per browser, not per profile; check the popup in every profile.
5. Leave a selected site open and start a session. At the transition from social time to break, its tab should become a break page within approximately one second. Unselected tabs stay available. Attempting to open a selected site during the break should also show that page.
6. Press Stop in FocusLock. The return button should unlock; click it to reopen the preserved URL.

## Scope and connection

Chrome or Edge 121+, or Firefox 128+, is required. Install and pair the extension in each browser profile you use. Private/incognito windows require each browser's separate permission, and are not live-verified. Other browsers are not included in this phase. A persistent Firefox add-on would require Mozilla signing; this phase provides a temporary development add-on only.

The extension needs tab URLs and access to HTTP/HTTPS sites to enforce user-selected domains. It does not upload browsing history, page content, or original URLs. The desktop bridge listens only on `127.0.0.1:43821`, checks a random per-install pairing code, and rejects web origins. It sends selected domains and the session deadline only. The code remains in local desktop/extension storage; never commit or share it.

Stopping, expiry, and selection changes sync while the app is running. If the desktop connection disappears, the companion removes its rules after a five-second connection lease. Its timer and backup alarm recover after a background restart. Removing/disabling the extension bypasses tab enforcement; hosts rules remain an additional layer. This is a personal focus tool, not a tamper-proof parental-control mechanism.

If the dashboard shows a browser disconnected, check pairing and that browser's profile. If port 43821 is occupied, the dashboard reports the bridge error; the app does not terminate another process to claim that port.
