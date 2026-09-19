import { afterEach, expect, it, vi } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
vi.mock("electron", () => ({
  default: {
    app: { getPath: () => tmpdir(), getVersion: () => "0.1.0" },
    ipcMain: { on: vi.fn() },
  },
}));
import Store from "electron-store";
import { defaults, settings } from "../src/main/settings";

const dirs: string[] = [];
const directory = () => {
  const dir = mkdtempSync(join(tmpdir(), "focuslock-test-"));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  vi.restoreAllMocks();
  dirs
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});
it("persists defaults and merges a partial update across repository reads", () => {
  const dir = directory();
  expect(settings(dir)).toEqual({ ok: true, value: defaults });
  expect(settings(dir, { allowanceMinutes: 1, blockMinutes: 1440 }).ok).toBe(
    true,
  );
  expect(settings(dir, { allowanceMinutes: 20 })).toEqual({
    ok: true,
    value: { allowanceMinutes: 20, blockMinutes: 1440 },
  });
  expect(settings(dir)).toEqual({
    ok: true,
    value: { allowanceMinutes: 20, blockMinutes: 1440 },
  });
});
it.each([
  null,
  [],
  "30",
  { extra: 30 },
  { allowanceMinutes: 0 },
  { allowanceMinutes: 1.5 },
  { blockMinutes: 1441 },
  { blockMinutes: NaN },
])("rejects malformed input without changing disk: %j", (patch) => {
  const dir = directory();
  settings(dir);
  const before = readFileSync(join(dir, "settings.json"), "utf8");
  expect(settings(dir, patch)).toEqual({
    ok: false,
    error: "INVALID_SETTINGS",
  });
  expect(readFileSync(join(dir, "settings.json"), "utf8")).toBe(before);
});
it.each(["{broken", '{"allowanceMinutes":-1}'])(
  "preserves malformed settings before recovery",
  (contents) => {
    const dir = directory();
    writeFileSync(join(dir, "settings.json"), contents);
    expect(settings(dir)).toEqual({ ok: true, value: defaults });
    expect(
      readFileSync(
        join(
          dir,
          readdirSync(dir).find((name) => name.includes(".invalid-"))!,
        ),
        "utf8",
      ),
    ).toBe(contents);
  },
);
it("returns a typed error when persistence fails", () => {
  const dir = directory();
  settings(dir);
  vi.spyOn(Store.prototype, "store", "set").mockImplementation(() => {
    throw new Error("private filesystem details");
  });
  expect(settings(dir, { blockMinutes: 50 })).toEqual({
    ok: false,
    error: "STORAGE_FAILED",
  });
});
it("does not rewrite settings during reads", () => {
  const dir = directory();
  settings(dir);
  const write = vi.spyOn(Store.prototype, "store", "set");
  expect(settings(dir).ok).toBe(true);
  expect(write).not.toHaveBeenCalled();
});
