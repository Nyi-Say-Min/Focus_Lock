export type Application = { id: string; name: string; executableName: string; enabled: boolean };

export type ApplicationsResult =
  | { ok: true; value: (Application & { running: boolean | null })[]; scanFailed: boolean }
  | { ok: false; error: string };

export type ApplicationsAPI = {
  list(): Promise<ApplicationsResult>;
  add(executableName: string): Promise<ApplicationsResult>;
  setEnabled(id: string, enabled: boolean): Promise<ApplicationsResult>;
  remove(id: string): Promise<ApplicationsResult>;
};
