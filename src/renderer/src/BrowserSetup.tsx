import { useEffect, useRef, useState } from "react";
import type { BrowserStatus } from "../../shared/browser";
import { Button } from "./common/ui";
export default function BrowserSetup() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false),
    [status, setStatus] = useState<BrowserStatus | null>(null);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let live = true,
      pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const result = await window.focusLock.browser.getStatus();
        if (live) setStatus(result.ok ? result.status : null);
      } catch {
        if (live) setStatus(null);
      } finally {
        pending = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 1500);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [open]);
  async function action(name: "copyCode" | "openFolder") {
    setBusy(true);
    setMessage("");
    try {
      const result = await window.focusLock.browser[name]();
      setMessage(
        result.ok
          ? name === "copyCode"
            ? "Pairing code copied. Paste it only into the FocusLock companion."
            : "Extension folder opened. Select it in your browser’s Load unpacked dialog."
          : "Setup action failed. Please try again.",
      );
    } catch {
      setMessage("Could not connect to FocusLock. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="chrome-setup-trigger"
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        Set up browsers
      </button>
      <dialog
        ref={dialog}
        className="chrome-setup-dialog"
        aria-labelledby="chrome-setup-heading"
        onClose={() => setOpen(false)}
      >
        <h2 id="chrome-setup-heading">Browser website blocking</h2>
        <p role="status">
          {status
            ? status.unavailable
              ? "Connection unavailable: port 43821 is busy. Restart FocusLock after freeing it."
              : `Chrome: ${status.chrome ? "connected" : "disconnected"} · Edge: ${status.edge ? "connected" : "disconnected"} · Firefox: ${status.firefox ? "connected" : "disconnected"}`
            : "Checking desktop connection… If this persists, close and reopen setup."}
        </p>
        <ol>
          <li>
            Open <code>chrome://extensions</code> or{" "}
            <code>edge://extensions</code> yourself. Enable Developer mode, then
            choose Load unpacked.
          </li>
          <li>
            For Firefox, open <code>about:debugging</code>, choose This Firefox,
            then Load Temporary Add-on and select manifest.json in the same
            extension folder.
          </li>
          <li>
            Click Open extension folder below. Select that folder in Chrome’s
            Load unpacked dialog in each browser you want to block.
          </li>
          <li>
            Click Copy pairing code below. Open the companion’s options, paste
            the code, and click Pair browser.
          </li>
          <li>
            Wait for your browser to show connected above. During breaks,
            selected websites and their subdomains become break pages.
          </li>
        </ol>
        <p>
          Install and pair in every browser profile you use. Firefox's temporary
          add-on must be loaded again after Firefox restarts. Other browsers are
          not supported by this companion.
        </p>
        <p>
          URLs stay in your tabs; unsaved page state is lost. Return to website
          unlocks after Stop or the break ends.
        </p>
        <p>
          The companion reads tab URLs to block selected sites. It sends no
          browsing history or page content to external services. Keep your
          pairing code private.
        </p>
        <div className="chrome-setup-actions">
          <Button disabled={busy} onClick={() => void action("openFolder")}>
            Open extension folder
          </Button>
          <Button disabled={busy} onClick={() => void action("copyCode")}>
            Copy pairing code
          </Button>
          <Button onClick={() => dialog.current?.close()}>Close</Button>
        </div>
        <p role="status">{message}</p>
      </dialog>
    </>
  );
}
