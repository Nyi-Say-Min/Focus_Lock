import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

function page(hash = "") {
  const elements = new Map<
    string,
    { textContent: string; hidden: boolean; disabled: boolean; addEventListener: () => void }
  >();
  const getElementById = (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: "", hidden: false, disabled: true, addEventListener() {} });
    return elements.get(id)!;
  };
  const contains = vi.fn().mockResolvedValue(false);
  const privateAccess = vi.fn().mockResolvedValue(false);
  const context = createContext({
    document: { getElementById },
    location: { hash },
    URL,
    setInterval() {},
    browser: {
      permissions: { contains },
      extension: { isAllowedIncognitoAccess: privateAccess },
      storage: { session: { get: async () => ({ status: "Connected to FocusLock" }) } },
    },
  });
  runInContext(readFileSync("resources/chrome/page.js", "utf8"), context);
  return { context, getElementById, contains, privateAccess };
}

it("shows limited site and private access, recovers when granted, and reports unavailable checks", async () => {
  const { context, getElementById, contains, privateAccess } = page();
  await new Promise(setImmediate);
  expect(getElementById("coverage").hidden).toBe(false);
  expect(getElementById("site-access").textContent).toMatch(/Website access: limited/);
  expect(getElementById("private-access").textContent).toMatch(/Private\/incognito access: off/);
  expect(contains).toHaveBeenCalledWith({ origins: ["http://*/*", "https://*/*"] });
  contains.mockResolvedValue(true);
  privateAccess.mockResolvedValue(true);
  await runInContext("render()", context);
  expect(getElementById("site-access").textContent).toBe("Website access: all sites allowed.");
  expect(getElementById("private-access").textContent).toMatch(/access: allowed/);
  contains.mockRejectedValue(Error("unavailable"));
  privateAccess.mockRejectedValue(Error("unavailable"));
  await runInContext("render()", context);
  expect(getElementById("site-access").textContent).toMatch(/could not be checked/);
  expect(getElementById("private-access").textContent).toMatch(/could not be checked/);
});

it("keeps access diagnostics out of the blocked tab and preserves its return control", async () => {
  const { getElementById, contains, privateAccess } = page("#https://reddit.com/r/test");
  await new Promise(setImmediate);
  expect(getElementById("coverage").hidden).toBe(true);
  expect(getElementById("pair").hidden).toBe(true);
  expect(getElementById("return").hidden).toBe(false);
  expect(getElementById("site").textContent).toBe("reddit.com");
  expect(contains).not.toHaveBeenCalled();
  expect(privateAccess).not.toHaveBeenCalled();
});
