import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { openHostsStorage } from "../src/main/hosts-storage";
vi.mock("electron-store", () => ({ default: class {} }));
import { createHostsBlocker } from "../src/main/hosts-blocker";

const script = resolve("resources/hosts-io.ps1");
const roots: string[] = [];
const workers: Awaited<ReturnType<typeof openHostsStorage>>[] = [];
async function open(root: string) {
  const worker = await openHostsStorage(script, root);
  workers.push(worker);
  return worker;
}
async function fixture(bytes: Buffer = Buffer.from("127.0.0.1 localhost\r\n# personal")) {
  const root = await mkdtemp(join(tmpdir(), "focuslock-hosts-test-"));
  roots.push(root);
  await writeFile(join(root, "hosts"), bytes);
  return { root, path: join(root, "hosts"), io: await open(root) };
}
afterEach(async () => {
  workers.splice(0).forEach((worker) => worker.close());
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
describe.skipIf(process.platform !== "win32")("Windows hosts storage (temporary fixtures only)", () => {
  it.each(["utf8", "utf16le"] as const)(
    "recovers a persisted journal and preserves %s bytes",
    async (encoding) => {
      const original = Buffer.from("\uFEFF# café\r\n127.0.0.1 localhost", encoding);
      const { root, path, io } = await fixture(original);
      await createHostsBlocker(io).apply(["youtube.com"], Date.now() + 60000);
      expect((await readFile(path)).toString(encoding)).toContain("0.0.0.0 youtube.com");
      expect(JSON.parse(await readFile(join(root, "journal.json"), "utf8")).version).toBe(1);
      io.close();
      await createHostsBlocker(await open(root)).recover();
      expect(await readFile(path)).toEqual(original);
      await expect(readFile(join(root, "journal.json"))).rejects.toMatchObject({ code: "ENOENT" });
    },
    20000,
  );
  it("rejects stale byte snapshots without overwriting external edits", async () => {
    const { path, io } = await fixture();
    const before = await io.read();
    const edited = `${before}\r\n# other program`;
    await writeFile(path, edited);
    await expect(io.replace(before, "changed")).rejects.toThrow("HOSTS_CONFLICT");
    expect(await readFile(path, "utf8")).toBe(edited);
    expect(await io.read()).toBe(edited);
  }, 20000);
  it("preserves hosts permissions across replacement and serializes requests", async () => {
    const { path, io } = await fixture();
    const acl = () =>
      execFileSync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", "[IO.File]::GetAccessControl($env:FOCUSLOCK_TEST_FILE).Sddl"],
        { env: { ...process.env, FOCUSLOCK_TEST_FILE: path }, windowsHide: true, encoding: "utf8" },
      );
    const before = acl();
    const [text, journal] = await Promise.all([io.read(), io.readJournal()]);
    expect(journal).toBeNull();
    await io.replace(text, `${text}\r\n# retained ACL`);
    expect(acl()).toBe(before);
    io.close();
    await expect(io.read()).rejects.toThrow("HOSTS_HELPER_CLOSED");
  }, 20000);
  it("refuses competing workers and fixture paths outside the dedicated temp folder", async () => {
    const { root } = await fixture();
    await expect(open(root)).rejects.toThrow("HOSTS_HELPER_BUSY");
    await expect(open(tmpdir())).rejects.toThrow("HOSTS_INVALID_FIXTURE");
  }, 20000);
  it("retains the journal when restoration conflicts and allows a later retry", async () => {
    const { root, path, io } = await fixture();
    const blocker = createHostsBlocker(io);
    await blocker.apply(["discord.com"], Date.now() + 60000);
    const managed = await readFile(path, "utf8");
    await writeFile(path, managed.replace("0.0.0.0 discord.com", "127.0.0.2 discord.com"));
    await expect(blocker.recover()).rejects.toThrow("HOSTS_MANAGED_SECTION_CHANGED");
    expect(await readFile(join(root, "journal.json"), "utf8")).toContain("discord.com");
    await writeFile(path, managed);
    await blocker.recover();
    expect(await readFile(path, "utf8")).not.toContain("FocusLock BEGIN");
  }, 20000);
  it("leaves hosts untouched if durable journal storage fails", async () => {
    const { root, path, io } = await fixture();
    const original = await readFile(path);
    await mkdir(join(root, "journal.json"));
    await expect(createHostsBlocker(io).apply(["youtube.com"], Date.now() + 60000)).rejects.toThrow();
    expect(await readFile(path)).toEqual(original);
  }, 20000);
  it("rejects unsupported UTF-32 instead of corrupting it", async () => {
    const original = Buffer.from([255, 254, 0, 0, 35, 0, 0, 0]);
    const { path, io } = await fixture(original);
    await expect(io.read()).rejects.toThrow("HOSTS_UNSUPPORTED_ENCODING");
    expect(await readFile(path)).toEqual(original);
  }, 20000);
  it("rejects malformed UTF-16 instead of falling back to ANSI", async () => {
    const { io } = await fixture(Buffer.from([255, 254, 35]));
    await expect(io.read()).rejects.toThrow("HOSTS_UNSUPPORTED_ENCODING");
  }, 20000);
});
