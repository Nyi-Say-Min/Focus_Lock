import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { connect, type Socket } from "node:net";
import { createInterface } from "node:readline";
import { openElevatedHosts } from "../src/main/hosts-elevation";
vi.mock("electron-store", () => ({ default: class {} }));
import { createHostsBlocker } from "../src/main/hosts-blocker";

const roots: string[] = [],
  controllers: AbortController[] = [];
const resources = resolve("resources");
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "focuslock-hosts-test-"));
  roots.push(root);
  await writeFile(join(root, "hosts"), "\uFEFF127.0.0.1 localhost\r\n# café");
  const controller = new AbortController();
  controllers.push(controller);
  return { root, controller };
}
afterEach(async () => {
  controllers.splice(0).forEach((controller) => controller.abort());
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
describe.skipIf(process.platform !== "win32")("authenticated helper transport (no UAC; temp fixtures)", () => {
  it("authenticates both peers, blocks, disconnects, and recovers through a fresh helper", async () => {
    const { root, controller } = await fixture(),
      path = join(root, "hosts");
    const original = await readFile(path);
    const io = await openElevatedHosts(resources, controller.signal, root);
    await createHostsBlocker(io).apply(["youtube.com"], Date.now() + 60000);
    expect(await readFile(path, "utf8")).toContain("0.0.0.0 youtube.com");
    io.close();
    const next = await openElevatedHosts(resources, controller.signal, root);
    await createHostsBlocker(next).recover();
    expect(await readFile(path)).toEqual(original);
    next.close();
  }, 30000);
  it("aborts a connected helper and rejects subsequent requests", async () => {
    const { root, controller } = await fixture();
    const io = await openElevatedHosts(resources, controller.signal, root);
    controller.abort();
    await expect(io.read()).rejects.toThrow();
  }, 15000);
  it("does not launch when already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(openElevatedHosts(resources, controller.signal)).rejects.toThrow("HOSTS_ELEVATION_CANCELLED");
  });
  it("rejects invalid fixture directories without touching hosts", async () => {
    const { controller } = await fixture();
    await expect(openElevatedHosts(resources, controller.signal, tmpdir())).rejects.toThrow();
  }, 15000);
  it.each(["wrong secret", "reflected proof"])(
    "rejects a client using %s before accessing hosts",
    async (mode) => {
      const { root } = await fixture(),
        original = await readFile(join(root, "hosts"));
      const pipe = `FocusLock-${randomBytes(24).toString("hex")}`,
        secret = randomBytes(32).toString("hex");
      const q = (s: string) => `'${s.replaceAll("'", "''")}'`;
      const command = `& ${q(join(resources, "hosts-elevated.ps1"))} -PipeName '${pipe}' -Secret '${secret}' -CallerSid ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value) -FixtureRoot ${q(root)}`;
      const child = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")],
        { windowsHide: true, stdio: "ignore" },
      );
      let client: Socket | undefined;
      try {
        for (let n = 0; n < 50; n++) {
          client = connect(`\\\\.\\pipe\\${pipe}`);
          try {
            await once(client, "connect");
            break;
          } catch {
            client.destroy();
            client = undefined;
            await new Promise((done) => setTimeout(done, 100));
          }
        }
        expect(client).toBeDefined();
        const lines = createInterface({ input: client! });
        const response = once(lines, "line");
        client!.write(`${randomBytes(32).toString("hex")}\n`);
        const [proof] = await response;
        expect(proof).toMatch(/^[a-f0-9]{64}$/);
        const closed = once(client!, "close");
        client!.write(`${mode === "reflected proof" ? proof : "0".repeat(64)}\n`);
        await closed;
        expect(await readFile(join(root, "hosts"))).toEqual(original);
        await expect(readFile(join(root, "journal.json"))).rejects.toMatchObject({ code: "ENOENT" });
      } finally {
        client?.destroy();
        child.kill();
      }
    },
    15000,
  );
});
