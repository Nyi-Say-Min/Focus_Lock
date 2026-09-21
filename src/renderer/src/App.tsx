import { Button, Card, NumberInput } from "./common/ui";
import { useEffect, useState } from "react";
import type { Settings } from "../../shared/types";
import { Landscape, Sprite } from "./common/ui/Scenery";
import { Icon } from "./common/ui/Icon";
import SessionCard from "./SessionCard";
import ApplicationsCard from "./ApplicationsCard";
import WebsitesCard from "./WebsitesCard";
import { DashboardWorld } from "./common/ui/DashboardWorld";

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
    <DashboardWorld>
      <SessionCard idleMinutes={value?.allowanceMinutes} />
      <ApplicationsCard />
      <WebsitesCard />
      <Card
        as="form"
        id="settings"
        tabIndex={-1}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h2>
          <Icon name="settings" />
          Session settings
        </h2>
        <p className="settings-description">
          Default durations for future sessions.
        </p>
        <Sprite kind="flower" className="settings-flower" />
        <div className="settings-scenery" aria-hidden="true">
          <Landscape variant="settings" />
          <p className="wooden-sign">
            Discipline
            <br />
            creates
            <br />
            freedom
          </p>
        </div>
        {value ? (
          <>
            <div className="duration-fields">
              {(["allowanceMinutes", "blockMinutes"] as const).map((key) => (
                <div key={key} className="text-sm">
                  <Icon name="clock" />
                  {key === "allowanceMinutes" ? "Social time" : "Break time"}
                  <NumberInput
                    label={
                      key === "allowanceMinutes"
                        ? "Social allowance"
                        : "Blocking period"
                    }
                    disabled={busy}
                    value={Number.isNaN(value[key]) ? "" : value[key]}
                    onValueChange={(number) =>
                      setValue({ ...value, [key]: number })
                    }
                  />
                  <span className="text-xs text-stone-400">minutes</span>
                </div>
              ))}
            </div>
            <Button
              type="submit"
              aria-label="Save defaults"
              disabled={busy}
              className="save-settings"
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        ) : (
          <Button type="button" disabled={busy} onClick={() => void load()}>
            {busy ? "Loading…" : "Retry loading"}
          </Button>
        )}
        <p role="status" className="mt-3 min-h-5 text-sm text-emerald-200">
          {message}
        </p>
      </Card>
    </DashboardWorld>
  );
}
