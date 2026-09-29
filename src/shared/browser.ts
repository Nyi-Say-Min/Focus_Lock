export type BrowserStatus = "connected" | "disconnected" | "unavailable";
export type BrowserResult =
  { ok: true; status: BrowserStatus } | { ok: false; error: string };
export type BrowserAPI = Record<
  "getStatus" | "copyCode" | "openFolder",
  () => Promise<BrowserResult>
>;
