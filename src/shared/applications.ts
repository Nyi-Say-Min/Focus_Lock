export type Application = { id: string; name: string; executableName: string; enabled: boolean };
export type InstalledApplication = { name: string; executableName: string; icon: string };
export type DiscoveryResult = { ok: true; value: InstalledApplication[] } | { ok: false; error: string };

export type ApplicationsResult =
  | { ok: true; value: (Application & { running: boolean | null })[]; scanFailed: boolean }
  | { ok: false; error: string };

export type ApplicationsAPI = {
  discover(): Promise<DiscoveryResult>;
  browse(): Promise<ApplicationsResult>;
  list(): Promise<ApplicationsResult>;
  add(executableName: string): Promise<ApplicationsResult>;
  setEnabled(id: string, enabled: boolean): Promise<ApplicationsResult>;
  remove(id: string): Promise<ApplicationsResult>;
};
