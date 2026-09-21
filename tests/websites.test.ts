import { expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeDomain, websiteRegistry, websiteStore } from "../src/main/websites";
it("normalizes URLs while rejecting unsupported or unsafe addresses", () => {
  expect(normalizeDomain(" HTTPS://WWW.YouTube.COM/watch?v=1 ")).toBe("youtube.com");
  expect(normalizeDomain("news.example.com.")).toBe("news.example.com");
  expect(normalizeDomain("bücher.de")).toBe("xn--bcher-kva.de");
  for (const input of [
    "",
    "localhost",
    "127.0.0.1",
    "[::1]",
    "ftp://example.com",
    "https://user:pw@example.com",
    "example.com:8080",
    "bad domain.com",
    "-bad.com",
    null,
  ])
    expect(() => normalizeDomain(input)).toThrow("INVALID_DOMAIN");
});
it("persists selections, detects duplicates and removes domains across store instances", () => {
  const cwd = mkdtempSync(join(tmpdir(), "focus-websites-"));
  try {
    const request = websiteStore(cwd);
    expect(request("list", [])).toMatchObject({ ok: true });
    expect(request("add", ["https://www.example.com/path"])).toMatchObject({ ok: true });
    expect(request("add", ["example.com"])).toEqual({ ok: false, error: "DUPLICATE_SITE" });
    expect(request("setEnabled", ["example.com", false])).toMatchObject({ ok: true });
    expect(websiteStore(cwd)("list", [])).toMatchObject({
      value: expect.arrayContaining([{ domain: "example.com", enabled: false }]),
    });
    expect(request("setEnabled", ["example.com", "yes"])).toEqual({ ok: false, error: "INVALID_REQUEST" });
    expect(request("remove", ["example.com"])).toMatchObject({ ok: true });
    expect(websiteStore(cwd)("remove", ["example.com"])).toEqual({ ok: false, error: "SITE_NOT_FOUND" });
    writeFileSync(join(cwd, "websites.json"), "{broken");
    expect(websiteStore(cwd)("add", ["test.com"])).toMatchObject({ ok: false });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
it("rejects invalid commands, full lists and failed persistence without changing saved data", () => {
  const items = Array.from({ length: 100 }, (_, i) => ({ domain: `site${i}.com`, enabled: false }));
  const request = websiteRegistry({
    read: () => items,
    write: () => {
      throw Error("disk full");
    },
  });
  expect(request("add", ["extra.com"])).toEqual({ ok: false, error: "SITE_LIMIT" });
  expect(request("list", ["extra"])).toEqual({ ok: false, error: "INVALID_REQUEST" });
  expect(request("anything", [])).toEqual({ ok: false, error: "INVALID_REQUEST" });
  expect(request("setEnabled", ["site0.com", true])).toEqual({ ok: false, error: "STORAGE_FAILED" });
  expect(items[0].enabled).toBe(false);
});
