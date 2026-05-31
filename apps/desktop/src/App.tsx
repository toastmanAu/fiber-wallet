import {
  Activity,
  BadgeCheck,
  Cable,
  CircleDollarSign,
  KeyRound,
  Network,
  RadioTower,
  ReceiptText,
  Settings,
  Shield,
  TerminalSquare,
} from "lucide-react";
import { useState } from "react";
import { AuthVaultPanel } from "./features/auth/AuthVaultPanel";
import { ChannelsPanel } from "./features/channels/ChannelsPanel";
import { Dashboard } from "./features/dashboard/Dashboard";
import { ExternalSignerPanel } from "./features/external/ExternalSignerPanel";
import { GraphDiagnosticsPanel } from "./features/graph/GraphDiagnosticsPanel";
import { OnboardingPanel } from "./features/onboarding/OnboardingPanel";
import { PaymentsPanel } from "./features/payments/PaymentsPanel";
import { PeersPanel } from "./features/peers/PeersPanel";
import { NodeManagerPanel } from "./features/settings/NodeManagerPanel";
import { JsonRpcConsole } from "./features/terminal/JsonRpcConsole";
import { WalletKeyPanel } from "./features/wallet/WalletKeyPanel";
import { useProfileStore } from "./lib/profileStore";

type NavId =
  | "dashboard"
  | "profiles"
  | "wallet"
  | "auth"
  | "peers"
  | "channels"
  | "external"
  | "payments"
  | "graph"
  | "terminal"
  | "settings";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "profiles", label: "Profiles", icon: BadgeCheck },
  { id: "wallet", label: "Wallet", icon: CircleDollarSign },
  { id: "auth", label: "Auth Vault", icon: Shield },
  { id: "peers", label: "Peers", icon: RadioTower },
  { id: "channels", label: "Channels", icon: Cable },
  { id: "external", label: "External Signer", icon: KeyRound },
  { id: "payments", label: "Payments", icon: ReceiptText },
  { id: "graph", label: "Graph", icon: Network },
  { id: "terminal", label: "Terminal", icon: TerminalSquare },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function App() {
  const [activeView, setActiveView] = useState<NavId>("dashboard");
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const profiles = useProfileStore((state) => state.profiles);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  const activeNav = navItems.find((item) => item.id === activeView) ?? navItems[0];

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
            const isCurrent = item.id === activeView;
            return (
              <button
                className={isCurrent ? "nav-item active" : "nav-item"}
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id as NavId)}
              >
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
            <h1>{activeNav.label}</h1>
            <p>{activeProfile ? activeProfile.name : "Create a profile to begin"}</p>
          </div>
          <div className="status-pill">
            <span className="status-dot" aria-hidden="true" />
            {activeProfile?.rpcMode === "live" ? "Live RPC" : "Mock RPC"}
          </div>
        </header>

        {activeView === "terminal" ? <JsonRpcConsole /> : null}
        {activeView === "settings" ? <NodeManagerPanel /> : null}
        {activeView === "wallet" ? <WalletKeyPanel /> : null}
        {activeView === "auth" ? <AuthVaultPanel /> : null}
        {activeView === "peers" ? <PeersPanel /> : null}
        {activeView === "channels" ? <ChannelsPanel /> : null}
        {activeView === "external" ? <ExternalSignerPanel /> : null}
        {activeView === "payments" ? <PaymentsPanel /> : null}
        {activeView === "graph" ? <GraphDiagnosticsPanel /> : null}
        {activeView === "dashboard" || activeView === "profiles" ? (
          <section className="content-grid">
            <Dashboard />
            <OnboardingPanel />
          </section>
        ) : null}
        {activeView !== "dashboard" &&
        activeView !== "profiles" &&
        activeView !== "terminal" &&
        activeView !== "settings" &&
        activeView !== "wallet" &&
        activeView !== "auth" &&
        activeView !== "peers" &&
        activeView !== "channels" &&
        activeView !== "external" &&
        activeView !== "payments" &&
        activeView !== "graph" ? (
          <section className="placeholder-panel">
            <h2>{activeNav.label}</h2>
            <p>This section is queued behind the RPC connectivity slice.</p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
