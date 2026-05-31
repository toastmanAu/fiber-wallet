import { invoke } from "@tauri-apps/api/core";
import { CheckCircle2, Plus, ServerCog, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { classifyRpcEndpoint } from "../../lib/endpointSafety";
import { fiberRpc, formatRpcError } from "../../lib/fiberRpc";
import { useProfileStore } from "../../lib/profileStore";

type CkbRpcHealth = {
  status: string;
  tip_block_number?: unknown;
  indexer_status: "ok" | "unavailable" | string;
  indexer_tip_block_number?: unknown;
  indexer_tip_block_hash?: unknown;
  indexer_lag_blocks?: number | null;
  indexer_message?: string | null;
};

const STALE_INDEXER_LAG_BLOCKS = 16;

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
  const [ckbHealthStatus, setCkbHealthStatus] = useState("");
  const [ckbIndexerWarning, setCkbIndexerWarning] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isCheckingCkb, setIsCheckingCkb] = useState(false);
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

  async function checkCkbRpcHealth() {
    if (!activeProfile) {
      return;
    }

    setIsCheckingCkb(true);
    setCkbHealthStatus("");
    setCkbIndexerWarning("");

    try {
      const response = await invoke<CkbRpcHealth>("ckb_rpc_health", {
        endpoint: activeProfile.ckbRpcEndpoint,
      });
      const tip = String(response.tip_block_number ?? "unknown");
      const indexerSummary = formatIndexerSummary(response);
      setCkbHealthStatus(`CKB RPC ${response.status} / tip ${tip} / ${indexerSummary}`);

      if (response.indexer_status !== "ok") {
        setCkbIndexerWarning(
          response.indexer_message ??
            "CKB indexer is unavailable on this endpoint. Wallet balance queries and cell lookups will not work until you connect to an endpoint with the indexer module enabled.",
        );
      } else if (
        typeof response.indexer_lag_blocks === "number" &&
        response.indexer_lag_blocks > STALE_INDEXER_LAG_BLOCKS
      ) {
        setCkbIndexerWarning(
          `Indexer is ${response.indexer_lag_blocks} blocks behind chain tip. Wallet balances may be stale until it catches up.`,
        );
      }
    } catch (error) {
      setCkbHealthStatus(formatRpcError(error));
    } finally {
      setIsCheckingCkb(false);
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
            <span>CKB RPC endpoint</span>
            <input
              value={activeProfile.ckbRpcEndpoint}
              onChange={(event) => updateActiveProfile({ ckbRpcEndpoint: event.target.value })}
              placeholder="https://testnet.ckbapp.dev/"
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

          <div className="health-check-row">
            <button className="command-button" type="button" onClick={checkCkbRpcHealth} disabled={isCheckingCkb}>
              {isCheckingCkb ? "Checking" : "Test CKB RPC"}
            </button>
            <span>{ckbHealthStatus || "No CKB health check yet"}</span>
          </div>

          {ckbIndexerWarning ? (
            <div className="safety-banner danger">
              <ShieldAlert size={17} aria-hidden="true" />
              <span>{ckbIndexerWarning}</span>
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}

function formatIndexerSummary(health: CkbRpcHealth): string {
  if (health.indexer_status !== "ok") {
    return `indexer ${health.indexer_status}`;
  }

  const tip = String(health.indexer_tip_block_number ?? "unknown");
  if (typeof health.indexer_lag_blocks === "number") {
    return `indexer ok / tip ${tip} / lag ${health.indexer_lag_blocks}`;
  }

  return `indexer ok / tip ${tip}`;
}

function shorten(value: string): string {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
