import { expect, it, vi } from "vitest";
import { applicationRegistry, defaultApplications } from "../src/main/application-registry";

it("persists case-insensitive registrations, selections and removals without restoring empty defaults", () => {
  let saved = defaultApplications;
  const storage = {
    read: () => saved,
    write: (items: typeof saved) => {
      saved = items;
    },
  };
  const registry = applicationRegistry(storage);
  registry.change("add", ["My 日本 App.exe"]);
  expect(() => registry.change("add", ["MY 日本 APP.EXE"])).toThrow("DUPLICATE_APPLICATION");
  registry.change("setEnabled", ["discord.exe", true]);
  expect(applicationRegistry(storage).list()[0].enabled).toBe(true);
  for (const item of registry.list()) registry.change("remove", [item.id]);
  expect(applicationRegistry(storage).list()).toEqual([]);
});

it.each(["C:\\bad.exe", "../bad.exe", "bad.exe\n", "bad", "a|b.exe", null, 42])(
  "rejects invalid executable %s without writing",
  (name) => {
    const write = vi.fn(),
      registry = applicationRegistry({ read: () => defaultApplications, write });
    expect(() => registry.change("add", [name])).toThrow("INVALID_EXECUTABLE");
    expect(write).not.toHaveBeenCalled();
  },
);

it("preserves stored selections on write failure and refuses corrupt records", () => {
  const registry = applicationRegistry({
    read: () => defaultApplications,
    write: () => {
      throw Error("disk full");
    },
  });
  expect(() => registry.change("setEnabled", ["discord.exe", true])).toThrow("disk full");
  expect(registry.list()[0].enabled).toBe(false);
  expect(() => registry.change("setEnabled", ["discord.exe", "true"])).toThrow("INVALID_APPLICATION");
  expect(() => applicationRegistry({ read: () => [{ executableName: "bad.exe" }], write: vi.fn() }).list()).toThrow(
    "INVALID_APPLICATIONS",
  );
});
