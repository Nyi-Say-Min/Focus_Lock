import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { SessionResult } from "../shared/session";
import type { Website } from "../shared/websites";
import type { BrowserStatus } from "../shared/browser";
export const chromeOrigin = "chrome-extension://lagcombaaakcbdigjgoinbakanadojlk";
const firefoxOrigin = /^moz-extension:\/\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function createChromeBridge(token: string, port = 43821) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error("INVALID_BROWSER_TOKEN");
  let state = { domains: [] as string[], until: 0 },
    failed = false;
  let revision = randomUUID();
  const clients = new Map<string, { browser: "chrome" | "edge" | "firefox"; seen: number; report: string }>();
  function setState(next: typeof state) {
    if (JSON.stringify(next) !== JSON.stringify(state)) revision = randomUUID();
    state = next;
  }
  function status(): BrowserStatus {
    const now = Date.now();
    if (state.until && state.until <= now) setState({ domains: [], until: 0 });
    const counts = { chrome: 0, edge: 0, firefox: 0, unavailable: failed, sync: { applied: 0, pending: 0, failed: 0 } };
    for (const [key, client] of clients) {
      if (now - client.seen > 5000) clients.delete(key);
      else {
        counts[client.browser]++;
        const result =
          client.report === `${revision}:applied`
            ? "applied"
            : client.report === `${revision}:failed`
              ? "failed"
              : "pending";
        counts.sync[result]++;
      }
    }
    return counts;
  }
  const server = createServer({ maxHeaderSize: 8192 }, (request, response) => {
    const address = server.address();
    const credential = request.headers.authorization ?? "";
    const expected = `Bearer ${token}`;
    const origin = request.headers.origin;
    const allowed =
      (!origin || origin === chromeOrigin || firefoxOrigin.test(origin)) &&
      request.url === "/state" &&
      typeof address === "object" &&
      address &&
      request.headers.host === `127.0.0.1:${address.port}`;
    response.setHeader("Cache-Control", "no-store");
    if (!allowed) return response.writeHead(403).end();
    response.setHeader("Access-Control-Allow-Origin", origin || chromeOrigin);
    if (request.method === "OPTIONS") {
      response.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, X-FocusLock-Browser, X-FocusLock-Client, X-FocusLock-Report",
      );
      response.setHeader("Access-Control-Allow-Methods", "GET");
      return response.writeHead(204).end();
    }
    if (
      request.method !== "GET" ||
      Buffer.byteLength(credential) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(credential), Buffer.from(expected))
    )
      return response.writeHead(401).end();
    const browser =
      origin && firefoxOrigin.test(origin)
        ? "firefox"
        : request.headers["x-focuslock-browser"] === "edge"
          ? "edge"
          : "chrome";
    const seen = Date.now();
    const id = request.headers["x-focuslock-client"];
    if (id && (typeof id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)))
      return response.writeHead(400).end();
    const report = request.headers["x-focuslock-report"] || "";
    if (
      typeof report !== "string" ||
      (report && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}:(applied|failed)$/.test(report))
    )
      return response.writeHead(400).end();
    clients.set(`${browser}:${id || "legacy"}`, { browser, seen, report });
    status();
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ...state, revision, leaseUntil: seen + 5000 }));
  });
  server.on("error", () => {
    failed = true;
  });
  server.listen(port, "127.0.0.1");
  return {
    server,
    status,
    update(result: SessionResult, sites: Website[]) {
      const value = result.ok ? result.value : null;
      setState(
        value?.status === "blocking" && value.blockEndsAt > Date.now()
          ? { domains: sites.filter((site) => site.enabled).map((site) => site.domain), until: value.blockEndsAt }
          : { domains: [], until: 0 },
      );
      const { sync } = status();
      return state.domains.length
        ? failed
          ? "Browser connection unavailable: local port 43821 is busy."
          : sync.failed
            ? `Browser blocking failed in ${sync.failed} profile(s). Open the companion and reload it to retry.`
            : sync.pending
              ? `Waiting for ${sync.pending} browser profile(s) to confirm rules. Reload outdated companions.`
              : !sync.applied
                ? "Browser companion disconnected. Install and pair it to block open tabs."
                : `Browser rules confirmed in ${sync.applied} connected profile(s).`
        : "";
    },
    close() {
      server.close();
      server.closeAllConnections();
    },
  };
}
