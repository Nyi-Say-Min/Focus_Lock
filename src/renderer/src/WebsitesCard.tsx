import { useEffect, useRef, useState } from "react";
import { popularSites, type Website, type WebsitesResult } from "../../shared/websites";
import { Button, Card, Checkbox, Input } from "./common/ui";
import { Icon } from "./common/ui/Icon";
const errors: Record<string, string> = {
  INVALID_DOMAIN: "Enter a domain or HTTP(S) URL without credentials or a custom port.",
  DUPLICATE_SITE: "That website is already listed.",
  SITE_LIMIT: "You can save up to 100 websites.",
};
export default function WebsitesCard() {
  const [items, setItems] = useState<Website[]>([]),
    [query, setQuery] = useState(""),
    [address, setAddress] = useState("");
  const [busy, setBusy] = useState(true),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState("");
  const sequence = useRef(0),
    locked = useRef(false);
  async function request(work: () => Promise<WebsitesResult>, saved = false) {
    if (locked.current) return;
    const current = ++sequence.current;
    locked.current = true;
    setBusy(true);
    try {
      const result = await work();
      if (current !== sequence.current) return;
      if (result.ok) {
        setItems(result.value);
        setLoaded(true);
        setMessage(saved ? "Selection saved. Blocking is not active yet." : "");
        return true;
      }
      setMessage(errors[result.error] ?? "Could not load or save websites. Please try again.");
    } catch {
      if (current === sequence.current) setMessage("Could not connect to FocusLock. Please try again.");
    } finally {
      if (current === sequence.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    void request(() => window.focusLock.websites.list());
    return () => {
      sequence.current++;
      locked.current = false;
    };
  }, []);
  return (
    <Card id="websites" tabIndex={-1} aria-label="Websites">
      <h2>
        <Icon name="globe" />
        Websites
      </h2>
      <Input
        type="search"
        aria-label="Search websites"
        placeholder="Search saved websites…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="website-tiles" tabIndex={0} aria-label="Saved websites">
        {items
          .filter((item) =>
            `${item.domain} ${popularSites[item.domain] ?? ""}`.toLowerCase().includes(query.toLowerCase()),
          )
          .map((item) => (
            <div key={item.domain}>
              <label>
                <Checkbox
                  aria-label={`Select ${item.domain}`}
                  checked={item.enabled}
                  disabled={busy}
                  onChange={(event) =>
                    void request(() => window.focusLock.websites.setEnabled(item.domain, event.target.checked), true)
                  }
                />
                <Icon name={popularSites[item.domain] ?? item.domain} />
                <span title={item.domain}>{popularSites[item.domain] ?? item.domain}</span>
              </label>
              <button
                type="button"
                className="remove-site"
                aria-label={`Remove ${item.domain}`}
                disabled={busy}
                onClick={() => void request(() => window.focusLock.websites.remove(item.domain), true)}
              >
                ×
              </button>
            </div>
          ))}
        {!items.length && loaded && <p>No saved websites. Add a domain below.</p>}
      </div>
      <form
        className="website-add"
        onSubmit={async (event) => {
          event.preventDefault();
          if (await request(() => window.focusLock.websites.add(address), true)) {
            setAddress("");
            setQuery("");
          }
        }}
      >
        <Input
          aria-label="Website address"
          placeholder="Enter website address (e.g. example.com)"
          value={address}
          disabled={busy || !loaded}
          maxLength={2048}
          onChange={(event) => setAddress(event.target.value)}
        />
        <Button type="submit" disabled={busy || !loaded || !address.trim()}>
          ＋ Add site
        </Button>
      </form>
      {!loaded && !busy && (
        <Button className="website-retry" onClick={() => void request(() => window.focusLock.websites.list())}>
          Retry websites
        </Button>
      )}
      <p role="status">
        {message || (busy ? "Saving / loading websites…" : "Saved selections only — website blocking is not active.")}
      </p>
    </Card>
  );
}
