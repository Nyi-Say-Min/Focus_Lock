import { createHostsBlocker, type HostsStorage } from "./hosts-blocker";
import type { SessionResult } from "../shared/session";
import type { Website } from "../shared/websites";
type Connection = HostsStorage & { close(): void };
export function createWebsiteBlocker(
  read: () => Website[],
  connect: (signal: AbortSignal) => Promise<Connection>,
  markRecovery: (needed: boolean) => void = () => {},
  clock = Date.now,
) {
  let desired = { domains: [] as string[], until: 0, session: -1 },
    revision = 0;
  let key = "",
    applied = "",
    attempted = -1,
    busy = false,
    recovering = false,
    closed = false,
    message = "";
  let io: Connection | undefined, controller: AbortController | undefined;
  async function work(recover = false) {
    if (busy || closed) return;
    const version = revision,
      target = desired,
      requestKey = key;
    busy = true;
    recovering = recover;
    try {
      if (!recover && requestKey === applied) {
        if (io) await io.readJournal();
        return;
      }
      if (!io && (recover || target.domains.length)) {
        if (!recover && attempted === target.session) return;
        attempted = target.session;
        markRecovery(true);
        message = "Websites: waiting for Windows administrator approval…";
        controller = new AbortController();
        io = await connect(controller.signal);
        if (closed) {
          io.close();
          io = undefined;
          return;
        }
        await createHostsBlocker(io, clock).recover();
      }
      if (io && (recover || version === revision)) {
        const blocker = createHostsBlocker(io, clock);
        if (!recover && target.domains.length && target.until > clock()) {
          markRecovery(true);
          await blocker.apply(target.domains, target.until);
          message = "Website rules applied during break. Existing tabs stay open; restart the browser to test.";
        } else {
          await blocker.release();
          markRecovery(false);
          const reuse = recover
            ? version !== revision && desired.domains.length
            : target.session >= 0 && target.until > clock();
          if (!reuse) {
            io.close();
            io = undefined;
          }
          message = "Website rules removed.";
        }
        if (version === revision) applied = requestKey;
      }
    } catch (error) {
      io?.close();
      io = undefined;
      message =
        "Website blocking/recovery failed or approval was cancelled. Use tray → Restore website access, then start a new session.";
      const code = error instanceof Error ? (error as NodeJS.ErrnoException).code || error.message : "";
      if (/^(HOSTS_[A-Z_]+|EACCES|EPERM|ENOENT|ENOSPC)$/.test(code)) message += ` (${code})`;
      applied = requestKey;
    } finally {
      busy = false;
      recovering = false;
    }
  }
  return {
    update(result: SessionResult) {
      let next = { domains: [] as string[], until: 0, session: -1 };
      try {
        if (result.ok && result.value?.status === "blocking" && result.value.blockEndsAt > clock())
          next = {
            domains: read()
              .filter((item) => item.enabled)
              .map((item) => item.domain)
              .sort(),
            until: result.value.blockEndsAt,
            session: result.value.startedAt,
          };
      } catch {
        message = "Cannot read website selections. Website rules will be removed.";
      }
      const current = JSON.stringify(next);
      if (key !== current) {
        desired = next;
        key = current;
        revision++;
      }
      if (busy && !recovering && !next.domains.length && !io) controller?.abort();
      void work();
      return message;
    },
    recover() {
      attempted = -1;
      applied = "";
      return work(true);
    },
    close() {
      closed = true;
      controller?.abort();
      io?.close();
      io = undefined;
    },
  };
}
