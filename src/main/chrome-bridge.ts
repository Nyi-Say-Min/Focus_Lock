import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { SessionResult } from "../shared/session";
import type { Website } from "../shared/websites";
import type { BrowserStatus } from "../shared/browser";
export const chromeOrigin = "chrome-extension://lagcombaaakcbdigjgoinbakanadojlk";
export function createChromeBridge(token: string, port = 43821) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error("INVALID_BROWSER_TOKEN");
  let state = { domains: [] as string[], until: 0 },
    failed = false;
  const seen = { chrome: 0, edge: 0 };
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
      response.setHeader("Access-Control-Allow-Headers", "Authorization, X-FocusLock-Browser");
      response.setHeader("Access-Control-Allow-Methods", "GET");
      return response.writeHead(204).end();
    }
    if (
      request.method !== "GET" ||
      Buffer.byteLength(credential) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(credential), Buffer.from(expected))
    )
      return response.writeHead(401).end();
    const browser = request.headers["x-focuslock-browser"] === "edge" ? "edge" : "chrome";
    seen[browser] = Date.now();
    const current = state.until > seen[browser] ? state : { domains: [], until: 0 };
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ...current, leaseUntil: seen[browser] + 5000 }));
  });
  server.on("error", () => {
    failed = true;
  });
  server.listen(port, "127.0.0.1");
  return {
    server,
    status(): BrowserStatus {
      return {
        chrome: seen.chrome > 0 && Date.now() - seen.chrome <= 5000,
        edge: seen.edge > 0 && Date.now() - seen.edge <= 5000,
        unavailable: failed,
      };
    },
    update(result: SessionResult, sites: Website[]) {
      const value = result.ok ? result.value : null;
      state =
        value?.status === "blocking" && value.blockEndsAt > Date.now()
          ? { domains: sites.filter((site) => site.enabled).map((site) => site.domain), until: value.blockEndsAt }
          : { domains: [], until: 0 };
      return state.domains.length
        ? failed
          ? "Browser connection unavailable: local port 43821 is busy."
          : !Object.values(seen).some((time) => time > 0 && Date.now() - time <= 5000)
            ? "Browser companion disconnected. Install and pair it to block open tabs."
            : "Browser tab blocking connected."
        : "";
    },
    close() {
      server.close();
      server.closeAllConnections();
    },
  };
}
