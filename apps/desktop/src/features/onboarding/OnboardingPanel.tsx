import { CheckCircle2, Plus, ServerCog, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { classifyRpcEndpoint } from "../../lib/endpointSafety";
import { fiberRpc, formatRpcError } from "../../lib/fiberRpc";
import { useProfileStore } from "../../lib/profileStore";

export function OnboardingPanel() {
  const profiles = useProfileStore((state) => state.profiles);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  const sessionBiscuitToken = useProfileStore((state) => state.sessionBiscuitToken);
  const createMockProfile = useProfileStore((state) => state.createMockProfile);
  const setActiveProfile = useProfileStore((state) => state.setActiveProfile);
  const updateActiveProfile = useProfileStore((state) => state.updateActiveProfile);
  const setSessionBiscuitToken = useProfileStore((state) => state.setSessionBiscuitToken);
  const endpointSafety = activeProfile ? classifyRpcEndpoint(activeProfile.fiberRpcEndpoint) : null;
  const [healthStatus, setHealthStatus] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [mainnetEnabled, setMainnetEnabled] = useState(false);

  async function checkRpcHealth() {
    if (!activeProfile) {
      return;
    }

    setIsChecking(true);
    setHealthStatus("");

    try {
      const response = await fiberRpc<Record<string, unknown>>("node_info", [], {
        profile: activeProfile,
        token: sessionBiscuitToken,
      });
      const version = typeof response.version === "string" ? response.version : "unknown version";
      const pubkey = typeof response.pubkey === "string" ? response.pubkey : "mock node";
      setHealthStatus(`node_info ok / ${version} / ${shorten(pubkey)}`);
    } catch (error) {
      setHealthStatus(formatRpcError(error));
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <section className="setup-panel">
      <div className="section-heading">
        <div>
          <h2>Profiles</h2>
          <p>Milestone 1 stores non-secret profile metadata locally.</p>
        </div>
        <button className="icon-button" type="button" onClick={createMockProfile} aria-label="Create mock profile">
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="profile-list">
        {profiles.map((profile) => (
          <button
            className={profile.id === activeProfileId ? "profile-row active" : "profile-row"}
            key={profile.id}
            type="button"
            onClick={() => setActiveProfile(profile.id)}
          >
            <ServerCog size={18} aria-hidden="true" />
            <span>
              <strong>{profile.name}</strong>
              <small>
                {profile.mode} / {profile.network} / PQR {profile.preferredPqrLock.toUpperCase()} /{" "}
                {profile.recoveryFormat.toUpperCase()}
              </small>
            </span>
          </button>
        ))}
      </div>

      {activeProfile ? (
        <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
          {endpointSafety ? (
            <div className={endpointSafety.kind === "public" && !sessionBiscuitToken ? "safety-banner danger" : "safety-banner"}>
              {endpointSafety.kind === "public" && !sessionBiscuitToken ? (
                <ShieldAlert size={17} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={17} aria-hidden="true" />
              )}
              <span>{endpointSafety.message}</span>
            </div>
          ) : null}
          {activeProfile.network === "mainnet" ? (
            <div className="safety-banner danger">
              <ShieldAlert size={17} aria-hidden="true" />
              <span>Mainnet is enabled for this early wallet build. Keep backups current and verify every RPC endpoint before use.</span>
            </div>
          ) : null}

          <label>
            <span>Network</span>
            <select
              value={activeProfile.network}
              onChange={(event) => {
                const network = event.target.value === "mainnet" ? "mainnet" : "testnet";
                updateActiveProfile({
                  network,
                  mainnetAcknowledgedAt:
                    network === "mainnet" && !activeProfile.mainnetAcknowledgedAt
                      ? new Date().toISOString()
                      : activeProfile.mainnetAcknowledgedAt,
                  ckbRpcEndpoint: network === "mainnet" ? "https://mainnet.ckbapp.dev/" : "https://testnet.ckbapp.dev/",
                });
              }}
            >
              <option value="testnet">Testnet</option>
              <option disabled={!mainnetEnabled && activeProfile.network !== "mainnet"} value="mainnet">
                Mainnet
              </option>
            </select>
          </label>

          <label className="checkbox-row">
            <input checked={mainnetEnabled} onChange={(event) => setMainnetEnabled(event.target.checked)} type="checkbox" />
            <span>Enable mainnet selection for this session</span>
          </label>

          <label>
            <span>RPC mode</span>
            <select
              value={activeProfile.rpcMode}
              onChange={(event) => updateActiveProfile({ rpcMode: event.target.value === "live" ? "live" : "mock" })}
            >
              <option value="mock">Mock fixtures</option>
              <option value="live">Live Fiber RPC</option>
            </select>
          </label>

          <label>
            <span>Fiber RPC endpoint</span>
            <input
              value={activeProfile.fiberRpcEndpoint}
              onChange={(event) => updateActiveProfile({ fiberRpcEndpoint: event.target.value })}
              placeholder="http://127.0.0.1:8227"
            />
          </label>

          <label>
            <span>Session Biscuit token</span>
            <input
              value={sessionBiscuitToken}
              onChange={(event) => setSessionBiscuitToken(event.target.value)}
              placeholder="Bearer token, not persisted"
              type="password"
            />
          </label>

          <div className="health-check-row">
            <button className="command-button" type="button" onClick={checkRpcHealth} disabled={isChecking}>
              {isChecking ? "Checking" : "Test node_info"}
            </button>
            <span>{healthStatus || "No health check yet"}</span>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function shorten(value: string): string {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
