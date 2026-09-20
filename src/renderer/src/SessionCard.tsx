import { useEffect, useRef, useState } from "react";
import type { SessionAPI, SessionResult } from "../../shared/session";
import { explain } from "./utils/sessionErrorMessagesExplaination";

export default function SessionCard() {
  const [snapshot, setSnapshot] = useState<SessionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const changing = useRef(false);

  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );

  async function request(action: keyof SessionAPI) {
    if (action === "getCurrent" && changing.current) return;
    const id = ++sequence.current;
    if (action !== "getCurrent") {
      changing.current = true;
      setBusy(true);
    }
    try {
      const result = await window.focusLock.session[action]();
      if (id !== sequence.current) return;
      if (action === "getCurrent") setSnapshot(result);
      else if (result.ok) {
        setSnapshot(result);
        setError("");
      } else setError(explain(result.error));
    } catch {
      if (id === sequence.current) setSnapshot({ ok: false, error: "Session unavailable. Try again." });
    } finally {
      if (action !== "getCurrent") {
        changing.current = false;
        if (id === sequence.current) setBusy(false);
      }
    }
  }

  useEffect(() => {
    if (busy) return;
    void request("getCurrent");
    const timer = setInterval(() => void request("getCurrent"), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  const value = snapshot?.ok ? snapshot.value : null;
  const running = value?.status === "active" || value?.status === "blocking";
  const end = value?.status === "active" ? value.allowanceEndsAt : value?.blockEndsAt;
  const seconds = snapshot?.ok && end ? Math.max(0, Math.ceil((end - snapshot.now) / 1000)) : 0;
  const time = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <section className="panel mb-6" aria-label="Focus session">
      <h2 className="text-lg font-semibold">
        {running
          ? value.status === "active"
            ? "Social time remaining"
            : "Break time remaining"
          : value
            ? `Session ${value.status}`
            : "No active session"}
      </h2>
      <p className="my-4 font-mono text-4xl" aria-label="Time remaining">
        {running ? time : "00:00:00"}
      </p>
      <p className="mb-4 text-sm text-stone-400">Uses saved defaults. App blocking is not enabled yet.</p>
      <button disabled={busy || !snapshot?.ok} onClick={() => void request(running ? "stop" : "start")}>
        {busy ? "Please wait…" : running ? "Stop session" : "Start session"}
      </button>
      <p role="status" className="mt-3 text-sm text-emerald-200">
        {error || (snapshot && !snapshot.ok ? explain(snapshot.error) : "")}
      </p>
    </section>
  );
}
