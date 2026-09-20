import { useEffect, useRef, useState } from "react";
import type { ApplicationsResult } from "../../shared/applications";

const messages: Record<string, string> = {
  INVALID_EXECUTABLE: "Enter an executable name such as Discord.exe, without a folder path.",
  DUPLICATE_APPLICATION: "That application is already listed.",
  APPLICATION_LIMIT: "You can configure up to 100 applications.",
};

export default function ApplicationsCard() {
  const [result, setResult] = useState<ApplicationsResult | null>(null),
    [name, setName] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    mounted = useRef(false),
    revision = useRef(0);
  async function request(work = () => window.focusLock.applications.list(), change = false) {
    if (lock.current && !change) return;
    lock.current = true;
    const current = ++revision.current;
    if (change) setBusy(true);
    try {
      const next: ApplicationsResult = await work().catch(() => ({ ok: false, error: "UNAVAILABLE" }));
      if (!mounted.current || revision.current !== current) return;
      if (next.ok) {
        setResult(next);
        setError("");
      } else {
        setError(messages[next.error] ?? "Could not load or save applications. Please try again.");
        if (!change) setResult(next);
      }
    } finally {
      if (revision.current === current) {
        lock.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    const refresh = () => {
      if (!document.hidden) void request();
    };
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <fieldset className="panel mb-6" aria-label="Applications" disabled={busy}>
      <legend className="text-lg font-semibold">Applications</legend>
      <p className="my-3 text-sm text-stone-400">Choose apps to track. App blocking is not enabled yet.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void request(() => window.focusLock.applications.add(name.trim()), true);
        }}
        className="mb-4"
      >
        <label className="text-sm">
          Executable name
          <input
            value={name}
            maxLength={120}
            required
            placeholder="Discord.exe"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button disabled={!result?.ok} type="submit">
          Add application
        </button>
      </form>
      {result?.ok && (
        <ul>
          {result.value.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 border-t border-white/10 py-3">
              <label className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  className="!m-0 !w-auto"
                  checked={item.enabled}
                  onChange={(event) =>
                    void request(() => window.focusLock.applications.setEnabled(item.id, event.target.checked), true)
                  }
                />
                {item.executableName}
              </label>
              <span className="text-sm">
                {item.running === null ? "Unknown" : item.running ? "Running" : "Not running"}
              </span>
              <button
                aria-label={`Remove ${item.name}`}
                onClick={() => void request(() => window.focusLock.applications.remove(item.id), true)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {result?.ok && !result.value.length && <p>No applications configured. Add an executable above.</p>}
      <p role="status" className="mt-3 text-sm text-emerald-200">
        {error || (result?.ok && result.scanFailed ? "Running status unavailable. Retrying automatically." : "")}
      </p>
    </fieldset>
  );
}
