import { useEffect, useState } from "react";
import type { Settings } from "../../shared/types";
import SessionCard from "./SessionCard";

export default function App() {
  const [value, setValue] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    setBusy(true);
    try {
      const result = await window.focusLock.settings.get();
      if (result.ok) {
        setValue(result.value);
        setMessage("");
      } else setMessage("Could not load settings. Try again.");
    } catch {
      setMessage("Could not connect to FocusLock. Try again.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save() {
    if (!value) return;
    setBusy(true);
    try {
      const result = await window.focusLock.settings.update(value);
      if (result.ok) {
        setValue(result.value);
        setMessage("Settings saved.");
      } else
        setMessage(
          result.error === "INVALID_SETTINGS"
            ? "Enter whole minutes from 1 to 1,440."
            : "Could not save settings. Try again.",
        );
    } catch {
      setMessage(
        "Could not connect to FocusLock. Your changes were not saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-2xl px-8 py-8">
      <header className="mb-8 flex items-center justify-between">
        <span className="font-mono text-xl font-bold tracking-tight">
          ▣ FocusLock
        </span>
        <span className="badge">DESKTOP / 01</span>
      </header>
      <section className="panel mb-6">
        <span className="badge">YOUR SPACE TO FOCUS</span>
        <h1 className="mt-5 text-4xl font-semibold">
          A little less distraction.
        </h1>
        <p className="mt-4 text-stone-400">
          Choose your defaults. Make room for what matters.
        </p>
      </section>
      <SessionCard />
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h2 className="text-lg font-semibold">Your rhythm</h2>
        <p className="mb-6 mt-1 text-sm text-stone-400">
          Default durations for future sessions.
        </p>
        {value ? (
          <>
            <div className="grid grid-cols-2 gap-6">
              {(["allowanceMinutes", "blockMinutes"] as const).map((key) => (
                <label key={key} className="text-sm">
                  {key === "allowanceMinutes"
                    ? "Social allowance"
                    : "Blocking period"}
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    step="1"
                    required
                    disabled={busy}
                    value={Number.isNaN(value[key]) ? "" : value[key]}
                    onChange={(event) =>
                      setValue({ ...value, [key]: event.target.valueAsNumber })
                    }
                  />
                  <span className="text-xs text-stone-400">minutes</span>
                </label>
              ))}
            </div>
            <button disabled={busy} className="mt-6">
              {busy ? "Saving…" : "Save defaults"}
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => void load()}>
            {busy ? "Loading…" : "Retry loading"}
          </button>
        )}
        <p role="status" className="mt-3 min-h-5 text-sm text-emerald-200">
          {message}
        </p>
      </form>
      <footer className="mt-6 text-center text-xs text-stone-400">
        Close the window to keep FocusLock in your tray. Quit from the tray
        menu.
      </footer>
    </main>
  );
}
