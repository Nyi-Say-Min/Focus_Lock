export type Website = { domain: string; enabled: boolean };
export type WebsitesResult = { ok: true; value: Website[] } | { ok: false; error: string };
export type WebsitesAPI = {
  list(): Promise<WebsitesResult>;
  add(address: string): Promise<WebsitesResult>;
  setEnabled(domain: string, enabled: boolean): Promise<WebsitesResult>;
  remove(domain: string): Promise<WebsitesResult>;
};
export const popularSites: Record<string, string> = {
  "youtube.com": "YouTube",
  "facebook.com": "Facebook",
  "x.com": "X",
  "reddit.com": "Reddit",
};
