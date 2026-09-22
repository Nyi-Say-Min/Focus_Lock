import { normalizeDomain } from "./websites";

const BEGIN = "# FocusLock BEGIN v1",
  END = "# FocusLock END v1";

export type HostsJournal = { version: 1; fragments: string[]; expiresAt: number };

// The privileged adapter must durably save the journal before replacing hosts.
// replace must compare the current bytes with expected, fail on conflicts, and preserve encoding/ACLs.
export type HostsStorage = {
  read(): Promise<string>;
  replace(expected: string, next: string): Promise<void>;
  readJournal(): Promise<unknown>;
  writeJournal(journal: HostsJournal): Promise<void>;
  clearJournal(): Promise<void>;
};

function validHost(host: string) {
  try {
    const canonical = normalizeDomain(host);
    return host === canonical || host === `www.${canonical}`;
  } catch {
    return false;
  }
}

function fragmentValid(fragment: unknown): fragment is string {
  if (typeof fragment !== "string" || fragment.length > 120000) return false;
  const lines = fragment.replace(/^\r?\n/, "").split(/\r?\n/);
  if (lines.shift() !== BEGIN || lines.pop() !== "" || lines.pop() !== END || !lines.length) return false;
  return (
    lines.length <= 400 &&
    lines.every((line) => {
      const parts = line.split(" ");
      return parts.length === 2 && ["0.0.0.0", "::"].includes(parts[0]) && validHost(parts[1]);
    })
  );
}

function journalValue(value: unknown): HostsJournal | null {
  if (value === null) return null;
  const item = value as Partial<HostsJournal> | undefined;
  if (
    !item ||
    item.version !== 1 ||
    !Number.isSafeInteger(item.expiresAt) ||
    !Array.isArray(item.fragments) ||
    item.fragments.length < 1 ||
    item.fragments.length > 2 ||
    !item.fragments.every(fragmentValid)
  )
    throw Error("HOSTS_INVALID_JOURNAL");
  return item as HostsJournal;
}

function unmanaged(text: string, journal: HostsJournal | null) {
  if (!text.includes(BEGIN) && !text.includes(END)) return { text, fragment: "" };
  const fragment = journal?.fragments.find((candidate) => text.includes(candidate));
  if (!fragment) throw Error("HOSTS_MANAGED_SECTION_CHANGED");
  const clean = text.replace(fragment, "");
  if (clean.includes(BEGIN) || clean.includes(END)) throw Error("HOSTS_MANAGED_SECTION_CHANGED");
  return { text: clean, fragment };
}

export function blockedHostnames(domains: unknown): string[] {
  if (
    !Array.isArray(domains) ||
    domains.length > 100 ||
    !domains.every((domain) => typeof domain === "string" && normalizeDomain(domain) === domain)
  )
    throw Error("HOSTS_INVALID_DOMAINS");
  return [
    ...new Set(domains.flatMap((domain) => [domain, `www.${domain}`].filter((host) => host.length <= 253))),
  ].sort();
}

export function createHostsBlocker(storage: HostsStorage, now = Date.now) {
  let tail = Promise.resolve();
  const serialized = (work: () => Promise<void>) => {
    const next = tail.then(work);
    tail = next.catch(() => {});
    return next;
  };
  async function release() {
    const journal = journalValue(await storage.readJournal());
    const previous = await storage.read(),
      clean = unmanaged(previous, journal);
    if (clean.fragment) await storage.replace(previous, clean.text);
    if (journal) await storage.clearJournal();
  }
  return {
    apply(domains: unknown, expiresAt: number) {
      return serialized(async () => {
        const hosts = blockedHostnames(domains);
        if (!hosts.length) return release();
        if (!Number.isSafeInteger(expiresAt) || expiresAt <= now() || expiresAt - now() > 86400000)
          throw Error("HOSTS_INVALID_EXPIRY");
        const journal = journalValue(await storage.readJournal());
        const previous = await storage.read(),
          clean = unmanaged(previous, journal);
        for (const line of clean.text.split(/\r?\n/)) {
          const aliases = line.split("#")[0].trim().split(/\s+/).slice(1);
          if (aliases.some((alias) => hosts.includes(alias.toLowerCase().replace(/\.$/, ""))))
            throw Error("HOSTS_EXISTING_MAPPING");
        }
        const eol = previous.includes("\r\n") ? "\r\n" : "\n";
        const rows = hosts.flatMap((host) => [`0.0.0.0 ${host}`, `:: ${host}`]);
        const fragment = `${clean.text && !clean.text.endsWith("\n") ? eol : ""}${[BEGIN, ...rows, END, ""].join(eol)}`;
        const next = clean.text + fragment;
        // Both fragments remain recoverable if interrupted before or after the replacement.
        await storage.writeJournal({
          version: 1,
          fragments: [...new Set([clean.fragment, fragment].filter(Boolean))],
          expiresAt,
        });
        if (expiresAt <= now()) return release();
        if (previous !== next) await storage.replace(previous, next);
      });
    },
    release: () => serialized(release),
    // On startup, remove rules from any interrupted session before accepting new work.
    recover: () => serialized(release),
    expire: () =>
      serialized(async () => {
        const journal = journalValue(await storage.readJournal());
        if (journal && journal.expiresAt <= now()) await release();
      }),
  };
}
