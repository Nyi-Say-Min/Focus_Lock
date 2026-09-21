import { Icon } from "./Icon";
import { useState, type ReactNode } from "react";
import { Button } from "./index";
import { WorldDefinitions, WorldBackdrop, Sprite } from "./Scenery";

export function DashboardWorld({ children }: { children: ReactNode }) {
  const [active, setActive] = useState("Dashboard");
  return (
    <main className="dashboard-world">
      <WorldDefinitions />
      <WorldBackdrop />
      <aside className="world-sidebar">
        <header className="world-brand">
          <Sprite kind="lock" />
          <h1>FocusLock</h1>
        </header>
        <nav aria-label="Dashboard sections">
          {["Dashboard", "Applications", "Websites", "Settings"].map((name, index) => (
            <Button
              key={name}
              className={active === name ? "selected" : ""}
              onClick={() => {
                setActive(name);
                document.getElementById(index === 0 ? "session" : name.toLowerCase())?.focus({ preventScroll: true });
              }}
            >
              <Icon name={["home", "gamepad", "globe", "settings"][index]} />
              {name}
            </Button>
          ))}
        </nav>
        <div className="sidebar-scenery">
          <Sprite kind="pipe" />
          <Sprite kind="flower" />
          <p className="wooden-sign">
            Good focus
            <br />
            Brighter
            <br />
            Tomorrow
          </p>
        </div>
      </aside>
      <div className="dashboard-panels">{children}</div>
      <div className="world-flag" aria-hidden="true">
        <Sprite kind="flag" />
        <span>
          Focus
          <br />
          today
          <br />
          wins
          <br />
          tomorrow
        </span>
      </div>
      <footer className="world-ground">
        <span>FocusLock — A calmer, brighter you —</span>
      </footer>
    </main>
  );
}

export function AppArtwork({ name }: { name: string }) {
  return (
    <span className="app-avatar" aria-hidden="true">
      <Icon name={name} />
    </span>
  );
}
