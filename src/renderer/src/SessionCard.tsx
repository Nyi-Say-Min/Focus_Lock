import { Button, Card } from "./common/ui";
import { useEffect, useRef, useState } from "react";
import type { SessionAPI, SessionResult } from "../../shared/session";
import { Landscape, Sprite } from "./common/ui/Scenery";
import { explain } from "./utils/sessionErrorMessagesExplaination";

export default function SessionCard({ idleMinutes = 25 }: { idleMinutes?: number }) {
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
    <Card id="session" tabIndex={-1} className="mb-6" aria-label="Focus session">
      <Landscape />
      <span className="session-caption">
        Small steps
        <br />
        Big results
      </span>
      <div className="session-coins" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((coin) => (
          <Sprite key={coin} kind="coin" className={coin ? "empty-coin" : ""} />
        ))}
      </div>
      <h2 className="text-lg font-semibold">
        {running
          ? value.status === "active"
            ? "Social time remaining"
            : "Break time remaining"
          : value
            ? `Session ${value.status}`
            : "Focus session"}
      </h2>
      <p
        className={`game-clock my-4 ${running ? (seconds >= 3600 ? "long-clock" : "") : idleMinutes >= 100 ? "long-clock" : ""}`}
        aria-label="Time remaining"
      >
        {running ? time.replace(/^00:/, "") : `${idleMinutes}:00`}
      </p>
      <p className="session-note">
        Breaks forcibly close selected apps. Save work first. Stop or quit to end blocking.
      </p>
      <Button disabled={busy || !snapshot?.ok} onClick={() => void request(running ? "stop" : "start")}>
        {busy ? "Please wait…" : running ? "Stop session" : "Start session"}
        {!running && (
          <span className="start-arrow" aria-hidden="true">
            ▶
          </span>
        )}
      </Button>
      <p role="status" className="mt-3 text-sm text-emerald-200">
        {error || (snapshot?.ok ? snapshot.blockingError : snapshot ? explain(snapshot.error) : "")}
      </p>
    </Card>
  );
}
