let busy = false,
  rulesKey = "",
  report = "";
const ext = typeof browser === "undefined" ? chrome : browser;
const blockedPage = ext.runtime.getURL("page.html");
const browserName = /\bFirefox\//.test(navigator.userAgent)
  ? "firefox"
  : /\bEdg\//.test(navigator.userAgent)
    ? "edge"
    : "chrome";
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
  const previousReport = report;
  report = "";
  try {
    let { token, clientId } = await ext.storage.local.get(["token", "clientId"]);
    if (token && !clientId) {
      clientId = crypto.randomUUID();
      await ext.storage.local.set({ clientId });
    }
    let { state } = await ext.storage.session.get("state");
    let status = token ? "FocusLock disconnected" : "Pair with FocusLock first";
    if (token) {
      try {
        const response = await fetch("http://127.0.0.1:43821/state", {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-FocusLock-Browser": browserName,
            "X-FocusLock-Client": clientId,
            "X-FocusLock-Report": previousReport,
          },
          signal: AbortSignal.timeout(2000),
          cache: "no-store",
        });
        if (!response.ok) throw Error("Connection refused");
        const incoming = await response.json();
        if (!valid(incoming)) throw Error("Invalid desktop state");
        state = incoming;
        if (typeof state.revision === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(state.revision))
          report = `${state.revision}:failed`;
        status = "Connected to FocusLock";
      } catch {
        /* Keep the last rules for at most five seconds during reconnection. */
      }
    }
    const domains = valid(state) && state.until > Date.now() && state.leaseUntil > Date.now() ? state.domains : [];
    const siteAccess =
      !domains.length ||
      (await ext.permissions.contains({
        origins: domains.flatMap((domain) => [`http://*.${domain}/*`, `https://*.${domain}/*`]),
      }));
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
      await ext.declarativeNetRequest.updateSessionRules({ removeRuleIds: [1, 2], addRules });
      rulesKey = key;
    }
    let tabFailed = false;
    if (domains.length) {
      for (const tab of await ext.tabs.query({})) {
        const url = tab.pendingUrl || tab.url;
        if (matches(url, domains)) {
          try {
            await ext.tabs.update(tab.id, { url: `${blockedPage}#${url}` });
          } catch {
            tabFailed = true;
          }
        }
      }
      status = tabFailed ? "Some tabs could not be blocked. Retrying…" : "Break active — selected websites are blocked";
    }
    if (!siteAccess)
      status = "Website access missing. Allow selected sites and their subdomains in the companion's browser settings.";
    if (report && !tabFailed && siteAccess) report = `${state.revision}:applied`;
    await ext.storage.session.set({ state: state || null, status });
    await ext.action.setBadgeText({
      text: tabFailed || !siteAccess ? "!" : domains.length ? "ON" : status.startsWith("Connected") ? "" : "!",
    });
  } catch {
    report = report.replace(/:applied$/, ":failed");
    await ext.storage.session.set({ status: "Browser blocking failed. Reload the extension." });
    await ext.action.setBadgeText({ text: "!" });
  } finally {
    busy = false;
  }
}
ext.runtime.onStartup.addListener(() => void poll());
for (const event of [ext.permissions.onAdded, ext.permissions.onRemoved])
  event.addListener(() => {
    rulesKey = "";
    void poll();
  });
ext.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") void poll();
});
ext.alarms.create("sync", { periodInMinutes: 0.5 });
ext.alarms.onAlarm.addListener(() => void poll());
setInterval(() => void poll(), 1000);
void poll();
