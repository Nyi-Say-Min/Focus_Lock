import { Button, Checkbox, Card, Input } from "./common/ui";
import { useEffect, useRef, useState } from "react";
import type { ApplicationsResult } from "../../shared/applications";
import { PipeList } from "./common/ui/PipeList";
import { Icon } from "./common/ui/Icon";
import ApplicationsPicker from "./ApplicationsPicker";
import { AppArtwork } from "./common/ui/DashboardWorld";

const messages: Record<string, string> = {
  INVALID_EXECUTABLE: "Choose an existing .exe file outside the Windows folder. FocusLock cannot block itself.",
  DUPLICATE_APPLICATION: "That application is already listed.",
  APPLICATION_LIMIT: "You can configure up to 100 applications.",
};

export default function ApplicationsCard() {
  const [result, setResult] = useState<ApplicationsResult | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const picker = useRef<HTMLDialogElement>(null);
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
    <Card as="fieldset" id="applications" tabIndex={-1} className="mb-6" aria-label="Applications" disabled={busy}>
      <h2>
        <Icon name="monitor" />
        Desktop apps
      </h2>
      <Input
        type="search"
        aria-label="Search configured apps"
        placeholder="Search installed apps…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <dialog ref={picker} className="app-dialog" aria-labelledby="picker-title">
        <h2 id="picker-title">Choose an application</h2>
        <Button className="close-picker" onClick={() => picker.current?.close()}>
          Close
        </Button>
        <p>Selected apps close during breaks. Save your work first.</p>
        <ApplicationsPicker added={result?.ok ? result.value.map((item) => item.id) : []} request={request} />
      </dialog>
      {result?.ok && (
        <PipeList>
          {result.value
            .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
            .map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 border-t border-white/10 py-3">
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <Checkbox
                    checked={item.enabled}
                    onChange={(event) =>
                      void request(() => window.focusLock.applications.setEnabled(item.id, event.target.checked), true)
                    }
                  />
                  <AppArtwork name={item.name} />
                  <span>
                    {item.name}
                    <small className="block text-stone-400">{item.executableName}</small>
                  </span>
                </label>
                <span className="text-sm">
                  {item.running === null ? "Unknown" : item.running ? "Running" : "Not running"}
                </span>
                <Button
                  aria-label={`Remove ${item.name}`}
                  onClick={() => void request(() => window.focusLock.applications.remove(item.id), true)}
                >
                  ×
                </Button>
              </li>
            ))}
        </PipeList>
      )}
      {result?.ok && !result.value.length && <p>No applications configured. Choose Add app below.</p>}
      <Button className="add-application" onClick={() => picker.current?.showModal()}>
        ＋ Add app
      </Button>
      <p role="status" className="mt-3 text-sm text-emerald-200">
        {error || (result?.ok && result.scanFailed ? "Running status unavailable. Retrying automatically." : "")}
      </p>
    </Card>
  );
}
