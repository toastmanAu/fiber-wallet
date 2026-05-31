import {
  Activity,
  BadgeCheck,
  Cable,
  CircleDollarSign,
  KeyRound,
  Network,
  RadioTower,
  Settings,
  Shield,
  TerminalSquare,
} from "lucide-react";
import { Dashboard } from "./features/dashboard/Dashboard";
import { OnboardingPanel } from "./features/onboarding/OnboardingPanel";
import { useProfileStore } from "./lib/profileStore";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "profiles", label: "Profiles", icon: BadgeCheck },
  { id: "wallet", label: "Wallet", icon: CircleDollarSign },
  { id: "auth", label: "Auth Vault", icon: Shield },
  { id: "peers", label: "Peers", icon: RadioTower },
  { id: "channels", label: "Channels", icon: Cable },
  { id: "graph", label: "Graph", icon: Network },
  { id: "terminal", label: "Terminal", icon: TerminalSquare },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function App() {
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const profiles = useProfileStore((state) => state.profiles);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <KeyRound size={22} aria-hidden="true" />
          <div>
            <strong>Fiber Wallet</strong>
            <span>desktop control</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isCurrent = item.id === "dashboard";
            return (
              <button className={isCurrent ? "nav-item active" : "nav-item"} key={item.id} type="button">
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>{activeProfile ? activeProfile.name : "Create a profile to begin"}</p>
          </div>
          <div className="status-pill">
            <span className="status-dot" aria-hidden="true" />
            Mock RPC
          </div>
        </header>

        <section className="content-grid">
          <Dashboard />
          <OnboardingPanel />
        </section>
      </main>
    </div>
  );
}

