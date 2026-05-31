import { invoke } from "@tauri-apps/api/core";
import { FileCog, Play, ScrollText, Square, WandSparkles } from "lucide-react";
import { useState } from "react";
import { useProfileStore } from "../../lib/profileStore";
import { redactSecrets } from "../../lib/redaction";

type NodePreflightReport = {
  profile_id: string;
  blockers: string[];
  warnings: string[];
  log_path: string;
};

type NodeStatus = {
  profile_id: string;
  state: string;
  pid?: number;
  started_at_ms?: number;
  log_path?: string;
};

type NodeCommandError = {
  kind: string;
  message: string;
};

export function NodeManagerPanel() {
  const activeProfile = useProfileStore((state) =>
    state.profiles.find((profile) => profile.id === state.activeProfileId),
  );
  const updateActiveProfile = useProfileStore((state) => state.updateActiveProfile);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [rustLog, setRustLog] = useState("info");
  const [status, setStatus] = useState("No node action yet");
  const [details, setDetails] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  if (!activeProfile) {
    return (
      <section className="settings-panel">
        <h2>Local Node Manager</h2>
        <p>No active profile.</p>
      </section>
    );
  }

  async function run(action: () => Promise<string>) {
    setIsBusy(true);
    setDetails("");
    try {
      setStatus(redactSecrets(await action()));
    } catch (error) {
      setStatus(formatNodeError(error));
    } finally {
      setIsBusy(false);
    }
  }

  const preflightInput = {
    profile_id: activeProfile.id,
    fnn_binary_path: activeProfile.fnnBinaryPath,
    data_dir: activeProfile.dataDir,
    config_path: activeProfile.configPath,
    rpc_endpoint: activeProfile.fiberRpcEndpoint,
  };

  return (
    <section className="settings-panel">
      <div className="section-heading">
        <div>
          <h2>Local Node Manager</h2>
          <p>Managed-node controls for a user-supplied FNN binary.</p>
        </div>
      </div>

      <div className="settings-form">
        <label>
          <span>FNN binary path</span>
          <input
            value={activeProfile.fnnBinaryPath}
            onChange={(event) => updateActiveProfile({ fnnBinaryPath: event.target.value })}
            placeholder="/path/to/fnn"
          />
        </label>

        <label>
          <span>Data directory</span>
          <input
            value={activeProfile.dataDir}
            onChange={(event) => updateActiveProfile({ dataDir: event.target.value })}
            placeholder="/path/to/fnn-data"
          />
        </label>

        <label>
          <span>Config path</span>
          <input
            value={activeProfile.configPath}
            onChange={(event) => updateActiveProfile({ configPath: event.target.value })}
            placeholder="/path/to/fnn-data/config.yml"
          />
        </label>

        <div className="settings-row">
          <label>
            <span>RPC listen</span>
            <input
              value={activeProfile.rpcListeningAddr}
              onChange={(event) => {
                const rpcListeningAddr = event.target.value;
                updateActiveProfile({
                  rpcListeningAddr,
                  fiberRpcEndpoint: `http://${rpcListeningAddr}`,
                });
              }}
              placeholder="127.0.0.1:8227"
            />
          </label>

          <label>
            <span>P2P listen</span>
            <input
              value={activeProfile.p2pListeningAddr}
              onChange={(event) => updateActiveProfile({ p2pListeningAddr: event.target.value })}
              placeholder="/ip4/127.0.0.1/tcp/8228"
            />
          </label>
        </div>

        <label>
          <span>Biscuit public key for generated config</span>
          <input
            value={activeProfile.biscuitPublicKey}
            onChange={(event) => updateActiveProfile({ biscuitPublicKey: event.target.value })}
            placeholder="ed25519/..."
          />
        </label>

        <div className="settings-row">
          <label>
            <span>Unlock password</span>
            <input
              value={unlockPassword}
              onChange={(event) => setUnlockPassword(event.target.value)}
              placeholder="FIBER_SECRET_KEY_PASSWORD"
              type="password"
            />
          </label>

          <label>
            <span>RUST_LOG</span>
            <input value={rustLog} onChange={(event) => setRustLog(event.target.value)} placeholder="info" />
          </label>
        </div>

        <div className="node-actions">
          <button
            className="command-button"
            disabled={isBusy}
            type="button"
            onClick={() =>
              run(async () => {
                const report = await invoke<NodePreflightReport>("node_preflight", { input: preflightInput });
                setDetails(formatPreflight(report));
                return report.blockers.length ? "Preflight blocked" : "Preflight passed";
              })
            }
          >
            <FileCog size={16} aria-hidden="true" />
            <span>Preflight</span>
          </button>

          <button
            className="command-button"
            disabled={isBusy}
            type="button"
            onClick={() =>
              run(async () => {
                const contents = await invoke<string>("node_generate_config", {
                  input: {
                    network: activeProfile.network,
                    ckb_rpc_endpoint: activeProfile.ckbRpcEndpoint,
                    rpc_listening_addr: activeProfile.rpcListeningAddr,
                    p2p_listening_addr: activeProfile.p2pListeningAddr,
                    biscuit_public_key: activeProfile.biscuitPublicKey || null,
                  },
                });
                await invoke("node_write_config", {
                  input: {
                    config_path: activeProfile.configPath,
                    contents,
                  },
                });
                setDetails(contents);
                return "Generated config.yml";
              })
            }
          >
            <WandSparkles size={16} aria-hidden="true" />
            <span>Write Config</span>
          </button>

          <button
            className="command-button"
            disabled={isBusy}
            type="button"
            onClick={() =>
              run(async () => {
                const nodeStatus = await invoke<NodeStatus>("node_start", {
                  input: {
                    ...preflightInput,
                    secret_key_password: unlockPassword,
                    rust_log: rustLog,
                  },
                });
                return formatStatus(nodeStatus);
              })
            }
          >
            <Play size={16} aria-hidden="true" />
            <span>Start</span>
          </button>

          <button
            className="command-button"
            disabled={isBusy}
            type="button"
            onClick={() =>
              run(async () => {
                const nodeStatus = await invoke<NodeStatus>("node_stop", { profileId: activeProfile.id });
                return formatStatus(nodeStatus);
              })
            }
          >
            <Square size={16} aria-hidden="true" />
            <span>Stop</span>
          </button>

          <button
            className="command-button"
            disabled={isBusy}
            type="button"
            onClick={() =>
              run(async () => {
                const logs = await invoke<string>("node_read_logs", {
                  dataDir: activeProfile.dataDir,
                  maxLines: 120,
                });
                setDetails(logs);
                return "Loaded node logs";
              })
            }
          >
            <ScrollText size={16} aria-hidden="true" />
            <span>Logs</span>
          </button>
        </div>

        <div className="node-status">
          <strong>{isBusy ? "Working" : status}</strong>
          {details ? <pre>{details}</pre> : null}
        </div>
      </div>
    </section>
  );
}

function formatNodeError(error: unknown): string {
  if (error && typeof error === "object" && "kind" in error && "message" in error) {
    const typed = error as NodeCommandError;
    return `${typed.kind}: ${typed.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatPreflight(report: NodePreflightReport): string {
  return JSON.stringify(report, null, 2);
}

function formatStatus(status: NodeStatus): string {
  return `${status.state}${status.pid ? ` / pid ${status.pid}` : ""}`;
}
