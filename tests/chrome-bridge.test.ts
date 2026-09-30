import { expect, it, vi } from "vitest";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createChromeBridge, chromeOrigin } from "../src/main/chrome-bridge";
it("authenticates Chrome, rejects websites, exposes only active selections, and clears on stop", async () => {
  const bridge = createChromeBridge("a".repeat(64), 0);
  try {
    await once(bridge.server, "listening");
    const address = bridge.server.address();
    if (!address || typeof address === "string") throw Error("No listener");
    const url = `http://127.0.0.1:${address.port}/state`;
    const headers = { Authorization: `Bearer ${"a".repeat(64)}`, Origin: chromeOrigin };
    expect(bridge.status()).toEqual({ chrome: false, edge: false, unavailable: false });
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url, { headers: { ...headers, Origin: "https://reddit.com" } })).status).toBe(403);
    expect((await fetch(url, { headers, method: "POST" })).status).toBe(401);
    const now = Date.now(),
      session = { startedAt: now, allowanceEndsAt: now + 1, blockEndsAt: now + 60000, status: "blocking" as const };
    bridge.update({ ok: true, now, value: session }, [
      { domain: "reddit.com", enabled: true },
      { domain: "x.com", enabled: false },
    ]);
    const state = (await (await fetch(url, { headers })).json()) as {
      leaseUntil: number;
      domains: string[];
      until: number;
    };
    expect(state).toMatchObject({ domains: ["reddit.com"], until: session.blockEndsAt });
    expect(state.leaseUntil).toBeGreaterThan(now);
    expect(bridge.status()).toEqual({ chrome: true, edge: false, unavailable: false });
    expect(await (await fetch(url, { headers: { ...headers, "X-FocusLock-Browser": "edge" } })).json()).toMatchObject({
      domains: ["reddit.com"],
    });
    expect(bridge.status()).toEqual({ chrome: true, edge: true, unavailable: false });
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6000);
    expect(bridge.status()).toEqual({ chrome: false, edge: false, unavailable: false });
    clock.mockRestore();
    bridge.update({ ok: true, now, value: { ...session, status: "cancelled" } }, []);
    expect(await (await fetch(url, { headers })).json()).toMatchObject({ domains: [], until: 0 });
  } finally {
    vi.restoreAllMocks();
    bridge.close();
  }
});
it("replaces existing matching tabs, blocks new requests, and releases on expiry, stop or disconnection", async () => {
  let now = 1000,
    offline = false;
  let incoming = { domains: [] as string[], until: 0, leaseUntil: 6000 };
  const saved: Record<string, unknown> = {};
  const event = { addListener() {} };
  const noop = () => {};
  const clock = { now: () => now };
  const session = { get: async () => saved, set: async (value: object) => Object.assign(saved, value) };
  const local = { get: async () => ({ token: "a".repeat(64) }) };
  const rules = vi.fn(),
    update = vi.fn();
  const chrome = {
    runtime: { getURL: (path: string) => `${chromeOrigin}/${path}`, onStartup: event, onInstalled: event },
    storage: { local, onChanged: event, session },
    tabs: {
      onUpdated: event,
      update,
      query: async () => [
        { id: 1, url: "https://www.reddit.com/r/test" },
        { id: 2, url: "https://reddit.com.evil.test/" },
        { id: 3, pendingUrl: "https://old.reddit.com/" },
        { id: 4, url: "https://example.com/" },
      ],
    },
    declarativeNetRequest: { updateSessionRules: rules },
    action: { setBadgeText: noop },
    alarms: { create: noop, onAlarm: event },
  };
  const fetchState = async (_url: string, init: { headers: Record<string, string> }) => {
    expect(init.headers["X-FocusLock-Browser"]).toBe("edge");
    if (offline) throw Error("offline");
    return { ok: true, json: async () => incoming };
  };
  const context = createContext({
    chrome,
    navigator: { userAgent: "Mozilla/5.0 Edg/120" },
    URL,
    AbortSignal,
    Date: clock,
    setInterval: noop,
    fetch: fetchState,
  });
  runInContext(readFileSync("resources/chrome/background.js", "utf8"), context);
  await new Promise(setImmediate);
  incoming = { domains: ["reddit.com"], until: 10000, leaseUntil: 6000 };
  await runInContext("poll()", context);
  expect(update.mock.calls.map((call) => call[0])).toEqual([1, 3]);
  expect(rules.mock.lastCall?.[0].addRules).toHaveLength(2);
  expect(rules.mock.lastCall?.[0].addRules[0].action.redirect.regexSubstitution).toContain("#\\0");
  offline = true;
  now = 6001;
  await runInContext("poll()", context);
  expect(rules.mock.lastCall?.[0].addRules).toEqual([]);
  offline = false;
  incoming = { domains: ["reddit.com"], until: 10000, leaseUntil: 12000 };
  await runInContext("poll()", context);
  now = 10001;
  await runInContext("poll()", context);
  expect(rules.mock.lastCall?.[0].addRules).toEqual([]);
  incoming = { domains: [], until: 0, leaseUntil: 15000 };
  await runInContext("poll()", context);
  expect(saved.status).toBe("Connected to FocusLock");
});
