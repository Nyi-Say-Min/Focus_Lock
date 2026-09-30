let busy = false,
  rulesKey = "";
const blockedPage = chrome.runtime.getURL("page.html");
const browserName = /\bEdg\//.test(navigator.userAgent) ? "edge" : "chrome";
function matches(url, domains) {
  try {
    const parsed = new URL(url);
    return (
      /^https?:$/.test(parsed.protocol) &&
      domains.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`))
    );
  } catch {
    return false;
  }
}
function valid(state) {
  return (
    state &&
    Number.isSafeInteger(state.until) &&
    Number.isSafeInteger(state.leaseUntil) &&
    state.until >= 0 &&
    state.until <= Date.now() + 86400000 &&
    Array.isArray(state.domains) &&
    state.domains.length <= 100 &&
    state.domains.every(
      (domain) =>
        typeof domain === "string" &&
        domain.length <= 253 &&
        domain.includes(".") &&
        domain.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)),
    )
  );
}
async function poll() {
  if (busy) return;
  busy = true;
  try {
    const { token } = await chrome.storage.local.get("token");
    let { state } = await chrome.storage.session.get("state");
    let status = token ? "FocusLock disconnected" : "Pair with FocusLock first";
    if (token) {
      try {
        const response = await fetch("http://127.0.0.1:43821/state", {
          headers: { Authorization: `Bearer ${token}`, "X-FocusLock-Browser": browserName },
          signal: AbortSignal.timeout(2000),
          cache: "no-store",
        });
        if (!response.ok) throw Error("Connection refused");
        const incoming = await response.json();
        if (!valid(incoming)) throw Error("Invalid desktop state");
        state = incoming;
        status = "Connected to FocusLock";
      } catch {
        /* Keep the last rules for at most five seconds during reconnection. */
      }
    }
    const domains = valid(state) && state.until > Date.now() && state.leaseUntil > Date.now() ? state.domains : [];
    const key = JSON.stringify(domains);
    if (key !== rulesKey) {
      const action = { type: "redirect", redirect: { regexSubstitution: `${blockedPage}#\\0` } };
      const main = { requestDomains: domains, regexFilter: "^https?://.*", resourceTypes: ["main_frame"] };
      const embedded = { requestDomains: domains, excludedResourceTypes: ["main_frame"] };
      const addRules = domains.length
        ? [
            { id: 1, priority: 1, action, condition: main },
            { id: 2, priority: 1, action: { type: "block" }, condition: embedded },
          ]
        : [];
      await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [1, 2], addRules });
      rulesKey = key;
    }
    if (domains.length) {
      for (const tab of await chrome.tabs.query({})) {
        const url = tab.pendingUrl || tab.url;
        if (matches(url, domains)) {
          try {
            await chrome.tabs.update(tab.id, { url: `${blockedPage}#${url}` });
          } catch {
            /* A tab can be closed between the query and update. Retry next poll. */
          }
        }
      }
      status = "Break active — selected websites are blocked";
    }
    await chrome.storage.session.set({ state: state || null, status });
    await chrome.action.setBadgeText({ text: domains.length ? "ON" : status.startsWith("Connected") ? "" : "!" });
  } catch {
    await chrome.storage.session.set({ status: "Chrome blocking failed. Reload the extension." });
  } finally {
    busy = false;
  }
}
chrome.runtime.onStartup.addListener(() => void poll());
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") void poll();
});
chrome.alarms.create("sync", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => void poll());
setInterval(() => void poll(), 1000);
void poll();
