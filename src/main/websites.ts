import Store from "electron-store";
import { isIP } from "node:net";
import { popularSites, type Website, type WebsitesResult } from "../shared/websites";

export function normalizeDomain(input: unknown): string {
  if (typeof input !== "string" || !input.trim() || input.length > 2048 || /\s/.test(input.trim()))
    throw Error("INVALID_DOMAIN");
  let url: URL;
  try {
    url = new URL(input.includes("://") ? input.trim() : `https://${input.trim()}`);
  } catch {
    throw Error("INVALID_DOMAIN");
  }
  const domain = url.hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    isIP(domain) ||
    domain.length > 253 ||
    !domain.includes(".") ||
    !domain.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    throw Error("INVALID_DOMAIN");
  return domain;
}
export function websiteRegistry(storage: { read(): unknown; write(items: Website[]): void }) {
  return (action: unknown, args: unknown): WebsitesResult => {
    try {
      if (
        !Array.isArray(args) ||
        typeof action !== "string" ||
        !["list", "add", "setEnabled", "remove"].includes(action) ||
        args.length !== (action === "list" ? 0 : action === "setEnabled" ? 2 : 1)
      )
        throw Error("INVALID_REQUEST");
      const stored = storage.read();
      if (
        !Array.isArray(stored) ||
        stored.length > 100 ||
        !stored.every(
          (item) =>
            item &&
            typeof item.domain === "string" &&
            normalizeDomain(item.domain) === item.domain &&
            typeof item.enabled === "boolean",
        ) ||
        new Set(stored.map((item) => item.domain)).size !== stored.length
      )
        throw Error("INVALID_WEBSITES");
      const items: Website[] = stored.map((item) => ({ domain: item.domain, enabled: item.enabled }));
      if (action !== "list") {
        const domain = normalizeDomain(args[0]),
          index = items.findIndex((item) => item.domain === domain);
        if (action === "add") {
          if (index >= 0) throw Error("DUPLICATE_SITE");
          if (items.length >= 100) throw Error("SITE_LIMIT");
          items.push({ domain, enabled: true });
        } else {
          if (index < 0) throw Error("SITE_NOT_FOUND");
          if (action === "remove") items.splice(index, 1);
          else {
            if (typeof args[1] !== "boolean") throw Error("INVALID_REQUEST");
            items[index].enabled = args[1];
          }
        }
        storage.write(items);
      }
      return { ok: true, value: items };
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      return { ok: false, error: /^(INVALID_|DUPLICATE_SITE$|SITE_)/.test(code) ? code : "STORAGE_FAILED" };
    }
  };
}
export function websiteStore(cwd?: string) {
  let store: Store<{ items: Website[] }>;
  const open = () =>
    (store ??= new Store<{ items: Website[] }>({
      name: "websites",
      ...(cwd ? { cwd } : {}),
      clearInvalidConfig: false,
      defaults: { items: Object.keys(popularSites).map((domain) => ({ domain, enabled: false })) },
    }));
  return websiteRegistry({ read: () => open().get("items"), write: (items) => open().set("items", items) });
}
