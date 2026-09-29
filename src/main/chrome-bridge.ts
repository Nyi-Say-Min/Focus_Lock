import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { SessionResult } from "../shared/session";
import type { Website } from "../shared/websites";
import type { BrowserStatus } from "../shared/browser";
export const chromeOrigin = "chrome-extension://lagcombaaakcbdigjgoinbakanadojlk";
export function createChromeBridge(token: string, port = 43821) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error("INVALID_BROWSER_TOKEN");
  let state = { domains: [] as string[], until: 0 },
    seen = 0,
    failed = false;
  const server = createServer({ maxHeaderSize: 8192 }, (request, response) => {
    const address = server.address();
    const credential = request.headers.authorization ?? "";
    const expected = `Bearer ${token}`;
    const allowed =
      (!request.headers.origin || request.headers.origin === chromeOrigin) &&
      request.url === "/state" &&
      typeof address === "object" &&
      address &&
      request.headers.host === `127.0.0.1:${address.port}`;
    response.setHeader("Cache-Control", "no-store");
    if (!allowed) return response.writeHead(403).end();
    response.setHeader("Access-Control-Allow-Origin", chromeOrigin);
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Headers", "Authorization");
      response.setHeader("Access-Control-Allow-Methods", "GET");
      return response.writeHead(204).end();
    }
    if (
      request.method !== "GET" ||
      Buffer.byteLength(credential) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(credential), Buffer.from(expected))
    )
      return response.writeHead(401).end();
    seen = Date.now();
    const current = state.until > seen ? state : { domains: [], until: 0 };
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ...current, leaseUntil: seen + 5000 }));
  });
  server.on("error", () => {
    failed = true;
  });
  server.listen(port, "127.0.0.1");
  return {
    server,
    status(): BrowserStatus {
      return failed ? "unavailable" : seen > 0 && Date.now() - seen <= 5000 ? "connected" : "disconnected";
    },
    update(result: SessionResult, sites: Website[]) {
      const value = result.ok ? result.value : null;
      state =
        value?.status === "blocking" && value.blockEndsAt > Date.now()
          ? { domains: sites.filter((site) => site.enabled).map((site) => site.domain), until: value.blockEndsAt }
          : { domains: [], until: 0 };
      return state.domains.length
        ? failed
          ? "Chrome connection unavailable: local port 43821 is busy."
          : Date.now() - seen > 5000
            ? "Chrome extension disconnected. Install and pair it to block open tabs."
            : "Chrome tab blocking connected."
        : "";
    },
    close() {
      server.close();
      server.closeAllConnections();
    },
  };
}
