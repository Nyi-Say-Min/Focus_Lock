# Chrome companion — first integration phase

This extension replaces selected HTTP/HTTPS tabs with a FocusLock break page, blocks new navigation and requests to those domains (including subdomains), and preserves each original URL in that tab's fragment. The return button unlocks when the break ends or Stop is pressed. Unsaved page state is not preserved.

## Install and pair

1. Run `npm run dev` in FocusLock.
2. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this `resources/chrome` folder. In packaged builds, the folder is under the application's `resources/resources/chrome` directory.
3. Right-click the FocusLock tray icon and choose **Copy Chrome pairing code**.
4. Open the extension's options or toolbar popup, paste the code, and click **Pair Chrome**. Wait for **Connected to FocusLock**.
5. Leave a selected site open and start a session. At the transition from social time to break, its tab should become a break page within approximately one second. Unselected tabs stay available. Attempting to open a selected site during the break should also show that page.
6. Press Stop in FocusLock. The return button should unlock; click it to reopen the preserved URL.

## Scope and connection

Chrome 120+ is required. Install and pair the extension in each Chrome profile you use. Incognito requires Chrome's separate **Allow in incognito** setting. Other browsers are not included in this phase.

The extension needs tab URLs and access to HTTP/HTTPS sites to enforce user-selected domains. It does not upload browsing history, page content, or original URLs. The desktop bridge listens only on `127.0.0.1:43821`, checks a random per-install pairing code, and rejects web origins. It sends selected domains and the session deadline only. The code remains in local desktop/extension storage; never commit or share it.

Stopping, expiry, and selection changes sync while the app is running. If the desktop connection disappears, Chrome removes its rules after a five-second connection lease. The timer and backup Chrome alarm recover after a worker restart. Removing/disabling the extension bypasses Chrome tab enforcement; hosts rules remain an additional layer. This is a personal focus tool, not a tamper-proof parental-control mechanism.

If the dashboard says **Chrome extension disconnected**, check pairing and this Chrome profile. If port 43821 is occupied, the dashboard reports the bridge error; the app does not terminate another process to claim that port.
