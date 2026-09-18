export type Settings = { allowanceMinutes: number; blockMinutes: number };

export type Result =
  | { ok: true; value: Settings }
  | { ok: false; error: "INVALID_SETTINGS" | "STORAGE_FAILED" | "FORBIDDEN" };

export type SettingsAPI = {
  get(): Promise<Result>;
  update(patch: Partial<Settings>): Promise<Result>;
};
