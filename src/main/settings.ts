import Store from "electron-store";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { Result, Settings } from "../shared/types";

export const defaults: Settings = { allowanceMinutes: 30, blockMinutes: 30 };

export function valid(patch: unknown): patch is Partial<Settings> {
  return (
    !!patch &&
    typeof patch === "object" &&
    !Array.isArray(patch) &&
    Object.entries(patch).every(
      ([key, value]) =>
        Object.hasOwn(defaults, key) &&
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 1440,
    )
  );
}

export function settings(cwd: string, patch?: unknown): Result {
  if (patch !== undefined && !valid(patch))
    return { ok: false, error: "INVALID_SETTINGS" };
  try {
    const path = join(cwd, "settings.json");
    if (existsSync(path)) {
      let malformed = false;
      try {
        const data = JSON.parse(readFileSync(path, "utf8"));
        malformed = !valid(data);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        malformed = true;
      }
      if (malformed) renameSync(path, `${path}.invalid-${Date.now()}`);
    }
    const store = new Store<Settings>({
      cwd,
      name: "settings",
      defaults,
      clearInvalidConfig: false,
    });
    const value = {
      ...defaults,
      ...store.store,
      ...(patch as Partial<Settings> | undefined),
    };
    if (patch !== undefined) store.store = value;
    return { ok: true, value };
  } catch {
    return { ok: false, error: "STORAGE_FAILED" };
  }
}
