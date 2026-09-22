import { expect, it } from "vitest";
import { blockedHostnames, createHostsBlocker, type HostsJournal, type HostsStorage } from "../src/main/hosts-blocker";

function fixture(original = "127.0.0.1 localhost\r\n# Personal rules\r\n") {
  let text = original,
    journal: unknown = null,
    failWrite = false,
    failJournal = false;
  const calls: string[] = [];
  const io: HostsStorage = {
    read: async () => text,
    replace: async (expected, next) => {
      calls.push("replace");
      if (failWrite) throw Error("ACCESS_DENIED");
      if (text !== expected) throw Error("CONFLICT");
      text = next;
    },
    readJournal: async () => journal,
    writeJournal: async (value) => {
      calls.push("journal");
      if (failJournal) throw Error("DISK_FULL");
      journal = structuredClone(value);
    },
    clearJournal: async () => {
      calls.push("clear");
      journal = null;
    },
  };
  return {
    io,
    calls,
    text: () => text,
    journal: () => journal,
    edit: (value: string) => {
      text = value;
    },
    corrupt: (value: unknown) => {
      journal = value;
    },
    failWrite: (value: boolean) => {
      failWrite = value;
    },
    failJournal: () => {
      failJournal = true;
    },
    blocker: createHostsBlocker(io, () => 1000),
  };
}

it("expands only explicit domains and www aliases, with strict validation", () => {
  expect(blockedHostnames(["youtube.com", "youtube.com", "m.example.com"])).toEqual([
    "m.example.com",
    "www.m.example.com",
    "www.youtube.com",
    "youtube.com",
  ]);
  for (const bad of [
    ["https://youtube.com"],
    ["bad\n127.0.0.1 evil.com"],
    ["127.0.0.1"],
    ["*.example.com"],
    null,
    Array(101).fill("example.com"),
  ])
    expect(() => blockedHostnames(bad)).toThrow();
});

it.each(["127.0.0.1 localhost", "# header\r\n", "\uFEFF# header\n", ""])(
  "restores original bytes represented by text: %j",
  async (original) => {
    const f = fixture(original);
    await f.blocker.apply(["example.com"], 10000);
    expect(f.text()).toContain("0.0.0.0 example.com");
    expect(f.text()).toContain(":: www.example.com");
    expect(f.calls).toEqual(["journal", "replace"]);
    await f.blocker.release();
    expect(f.text()).toBe(original);
    expect(f.journal()).toBeNull();
  },
);

it("preserves unrelated edits made while rules are active", async () => {
  const f = fixture();
  await f.blocker.apply(["youtube.com"], 10000);
  f.edit(`# added before\r\n${f.text()}10.0.0.1 internal.example\r\n`);
  await f.blocker.apply(["discord.com"], 11000);
  expect(f.text()).not.toContain("youtube.com");
  await f.blocker.release();
  expect(f.text()).toBe("# added before\r\n127.0.0.1 localhost\r\n# Personal rules\r\n10.0.0.1 internal.example\r\n");
});

it("does not replace hosts if journaling fails or overwrite existing mappings", async () => {
  const f = fixture("1.2.3.4 EXAMPLE.COM # existing entry\n");
  await expect(f.blocker.apply(["example.com"], 10000)).rejects.toThrow("HOSTS_EXISTING_MAPPING");
  expect(f.calls).toEqual([]);
  f.failJournal();
  await expect(f.blocker.apply(["other.com"], 10000)).rejects.toThrow("DISK_FULL");
  expect(f.text()).toContain("1.2.3.4 EXAMPLE.COM");
});

it("recovers when interrupted on either side of a hosts replacement", async () => {
  for (const afterReplacement of [false, true]) {
    const f = fixture();
    await f.blocker.apply(["first.com"], 10000);
    f.failWrite(!afterReplacement);
    await f.blocker.apply(["second.com"], 11000).catch(() => {});
    f.failWrite(false);
    await createHostsBlocker(f.io).recover();
    expect(f.text()).toBe("127.0.0.1 localhost\r\n# Personal rules\r\n");
    expect(f.journal()).toBeNull();
  }
});

it("retains the journal after restoration fails and supports retry", async () => {
  const f = fixture();
  await f.blocker.apply(["example.com"], 10000);
  f.failWrite(true);
  await expect(f.blocker.release()).rejects.toThrow("ACCESS_DENIED");
  expect(f.journal()).not.toBeNull();
  f.failWrite(false);
  await f.blocker.release();
  expect(f.journal()).toBeNull();
});

it("refuses modified, duplicated, unowned or corrupt managed sections", async () => {
  for (const alteration of ["tamper", "duplicate", "missing-journal", "bad-journal"]) {
    const f = fixture();
    await f.blocker.apply(["example.com"], 10000);
    if (alteration === "tamper") f.edit(f.text().replace("0.0.0.0 example.com", "1.2.3.4 example.com"));
    if (alteration === "duplicate") f.edit(f.text() + (f.journal() as HostsJournal).fragments[0]);
    if (alteration === "missing-journal") f.corrupt(null);
    if (alteration === "bad-journal") f.corrupt({ version: 1, fragments: ["127.0.0.1 localhost"], expiresAt: 10000 });
    const before = f.text();
    await expect(f.blocker.recover()).rejects.toThrow();
    expect(f.text()).toBe(before);
  }
});

it("serializes operations and clears only expired leases", async () => {
  const f = fixture();
  await Promise.all([f.blocker.apply(["first.com"], 10000), f.blocker.apply(["second.com"], 11000)]);
  expect(f.text()).not.toContain("first.com");
  await createHostsBlocker(f.io, () => 10999).expire();
  expect(f.text()).toContain("second.com");
  await createHostsBlocker(f.io, () => 11000).expire();
  expect(f.text()).not.toContain("second.com");
  await expect(f.blocker.apply(["example.com"], 999)).rejects.toThrow("HOSTS_INVALID_EXPIRY");
  await f.blocker.apply([], 0);
  expect(f.journal()).toBeNull();
});

it("keeps a concurrent edit when the adapter rejects a stale replacement", async () => {
  const f = fixture(),
    save = f.io.writeJournal;
  f.io.writeJournal = async (value) => {
    await save(value);
    f.edit(f.text() + "# concurrent edit\r\n");
  };
  await expect(f.blocker.apply(["example.com"], 10000)).rejects.toThrow("CONFLICT");
  expect(f.text()).not.toContain("0.0.0.0 example.com");
  await f.blocker.recover();
  expect(f.text()).toContain("# concurrent edit\r\n");
  expect(f.journal()).toBeNull();
});

it("does not activate rules if the lease expires while writing the journal", async () => {
  const f = fixture(),
    save = f.io.writeJournal;
  let clock = 1000;
  f.io.writeJournal = async (value) => {
    await save(value);
    clock = 10000;
  };
  await createHostsBlocker(f.io, () => clock).apply(["example.com"], 10000);
  expect(f.calls).toEqual(["journal", "clear"]);
  expect(f.text()).not.toContain("example.com");
});

it("clears a stale journal when its rules have already been removed externally", async () => {
  const f = fixture();
  await f.blocker.apply(["example.com"], 10000);
  f.edit("# User restored their hosts file\n");
  await f.blocker.recover();
  expect(f.text()).toBe("# User restored their hosts file\n");
  expect(f.journal()).toBeNull();
});
