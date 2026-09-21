import { useState } from "react";
import type { ApplicationsResult, InstalledApplication } from "../../shared/applications";
export default function ApplicationsPicker({
  added,
  request,
}: {
  added: string[];
  request: (work: () => Promise<ApplicationsResult>, change: boolean) => Promise<void>;
}) {
  const [items, setItems] = useState<InstalledApplication[] | null>(null),
    [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await window.focusLock.applications.discover();
      if (result.ok) setItems(result.value);
      else setError("Could not find installed apps. Retry or browse for an executable.");
    } catch {
      setError("Could not find installed apps. Retry or browse for an executable.");
    } finally {
      setLoading(false);
    }
  }
  const matches = items?.filter((item) =>
    `${item.name} ${item.executableName}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="mb-4">
      <button type="button" disabled={loading} onClick={() => void load()}>
        {loading ? "Finding apps…" : items ? "Refresh apps" : "Choose installed apps"}
      </button>
      <button
        type="button"
        className="ml-3"
        onClick={() => void request(() => window.focusLock.applications.browse(), true)}
      >
        Browse for an executable
      </button>
      <p className="my-3 text-sm text-stone-400">
        Apps found in Windows Start menu. Some Store or portable apps may be missing. Adding an app selects it for
        blocking.
      </p>
      {items && (
        <label>
          Search installed apps
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      )}
      <ul className="max-h-64 overflow-auto" aria-label="Installed apps">
        {matches?.map((item) => (
          <li key={item.executableName.toLowerCase()} className="flex items-center gap-3 py-2">
            {item.icon && <img src={item.icon} alt="" width={24} height={24} />}
            <span className="min-w-0 flex-1 break-all">
              {item.name}
              <small className="block text-stone-400">{item.executableName}</small>
            </span>
            <button
              type="button"
              aria-label={`Add ${item.name}`}
              disabled={added.includes(item.executableName.toLowerCase())}
              onClick={() => void request(() => window.focusLock.applications.add(item.executableName), true)}
            >
              {added.includes(item.executableName.toLowerCase()) ? "Added" : "Add"}
            </button>
          </li>
        ))}
      </ul>
      {matches?.length === 0 && <p>No matching apps. Try browsing for an executable.</p>}
      <p role="status">{error}</p>
    </div>
  );
}
