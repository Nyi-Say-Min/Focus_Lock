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
    const clientId = "11111111-1111-4111-8111-111111111111";
    const headers = { Authorization: `Bearer ${"a".repeat(64)}`, Origin: chromeOrigin, "X-FocusLock-Client": clientId };
    expect(bridge.status()).toEqual({ chrome: 0, edge: 0, firefox: 0, unavailable: false });
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
    expect(bridge.status()).toEqual({ chrome: 1, edge: 0, firefox: 0, unavailable: false });
    const second = { ...headers, "X-FocusLock-Client": "22222222-2222-4222-8222-222222222222" };
    expect((await fetch(url, { headers: second })).status).toBe(200);
    expect((await fetch(url, { headers: second })).status).toBe(200);
    expect(bridge.status()).toEqual({ chrome: 2, edge: 0, firefox: 0, unavailable: false });
    expect((await fetch(url, { headers: { ...headers, "X-FocusLock-Client": "invalid" } })).status).toBe(400);
    expect(bridge.status().chrome).toBe(2);
    expect(await (await fetch(url, { headers: { ...headers, "X-FocusLock-Browser": "edge" } })).json()).toMatchObject({
      domains: ["reddit.com"],
    });
    expect(bridge.status()).toEqual({ chrome: 2, edge: 1, firefox: 0, unavailable: false });
    const firefox = "moz-extension://12345678-1234-1234-1234-123456789abc";
    expect(
      (
        await fetch(url, {
          method: "OPTIONS",
          headers: {
            Origin: firefox,
            "Access-Control-Request-Headers": "authorization,x-focuslock-browser,x-focuslock-client",
          },
        })
      ).headers.get("access-control-allow-origin"),
    ).toBe(firefox);
    expect(
      (
        await fetch(url, {
          method: "OPTIONS",
          headers: { Origin: firefox, "Access-Control-Request-Headers": "x-focuslock-client" },
        })
      ).headers.get("access-control-allow-headers"),
    ).toContain("X-FocusLock-Client");
    expect((await fetch(url, { headers: { ...headers, Origin: "moz-extension://spoof" } })).status).toBe(403);
    expect((await fetch(url, { headers: { ...headers, Origin: firefox, Authorization: "Bearer wrong" } })).status).toBe(
      401,
    );
    expect(
      (await fetch(url, { headers: { ...headers, Origin: firefox, "X-FocusLock-Browser": "firefox" } })).status,
    ).toBe(200);
    expect(bridge.status()).toEqual({ chrome: 2, edge: 1, firefox: 1, unavailable: false });
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6000);
    expect(bridge.status()).toEqual({ chrome: 0, edge: 0, firefox: 0, unavailable: false });
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
  const profile: { token: string; clientId?: string } = { token: "a".repeat(64) };
  const local = { get: async () => profile, set: async (value: object) => Object.assign(profile, value) };
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
    expect(init.headers["X-FocusLock-Client"]).toBe("11111111-1111-4111-8111-111111111111");
    if (offline) throw Error("offline");
    return { ok: true, json: async () => incoming };
  };
  const context = createContext({
    chrome,
    navigator: { userAgent: "Mozilla/5.0 Edg/120" },
    URL,
    AbortSignal,
    Date: clock,
    crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
    setInterval: noop,
    fetch: fetchState,
  });
  runInContext(readFileSync("resources/chrome/background.js", "utf8"), context);
  await new Promise(setImmediate);
  expect(profile.clientId).toBe("11111111-1111-4111-8111-111111111111");
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
it("runs the Firefox background page with its promise API and replaces an existing tab", async () => {
  const now = Date.now();
  const update = vi.fn(),
    rules = vi.fn(),
    fetchState = vi.fn(async (_url: string, options: { headers: Record<string, string> }) => {
      expect(options.headers["X-FocusLock-Browser"]).toBe("firefox");
      expect(options.headers["X-FocusLock-Client"]).toBe("11111111-1111-4111-8111-111111111111");
      return { ok: true, json: async () => ({ domains: ["reddit.com"], until: now + 60000, leaseUntil: now + 5000 }) };
    });
  const event = { addListener() {} },
    noop = () => {};
  const browser = {
    runtime: {
      getURL: (path: string) => `moz-extension://12345678-1234-1234-1234-123456789abc/${path}`,
      onStartup: event,
    },
    storage: {
      local: { get: async () => ({ token: "a".repeat(64) }), set: async () => {} },
      session: { get: async () => ({}), set: noop },
      onChanged: event,
    },
    tabs: { query: async () => [{ id: 5, url: "https://www.reddit.com/r/test" }], update },
    declarativeNetRequest: { updateSessionRules: rules },
    action: { setBadgeText: noop },
    alarms: { create: noop, onAlarm: event },
  };
  runInContext(
    readFileSync("resources/chrome/background.js", "utf8"),
    createContext({
      browser,
      navigator: { userAgent: "Firefox/128.0" },
      URL,
      AbortSignal,
      Date,
      crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
      fetch: fetchState,
      setInterval: noop,
    }),
  );
  await new Promise(setImmediate);
  expect(fetchState).toHaveBeenCalledOnce();
  expect(rules.mock.lastCall?.[0].addRules).toHaveLength(2);
  expect(update).toHaveBeenCalledWith(5, {
    url: "moz-extension://12345678-1234-1234-1234-123456789abc/page.html#https://www.reddit.com/r/test",
  });
});
